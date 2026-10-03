import { expect, test, type Page } from "@playwright/test";
import { loadEnv } from "vite";

const previewEnv = loadEnv("preview", process.cwd(), "VITE_");
const supabaseUrl = process.env.VITE_SUPABASE_URL || previewEnv.VITE_SUPABASE_URL;
const authStorageKey = supabaseUrl ? `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token` : "";
const buyer = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "buyer@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Test Buyer" },
  created_at: "2026-09-01T00:00:00.000Z",
  factors: []
};

test.beforeEach(async ({ page }) => {
  const savedWishlist = new Set<string>();
  await page.route("http://127.0.0.1:54321/rest/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/wishlist_items")) {
      if (route.request().method() === "POST") {
        const item = route.request().postDataJSON() as { product_id?: string };
        if (item.product_id) savedWishlist.add(item.product_id);
      }
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": "0-0/0" }, body: JSON.stringify(Array.from(savedWishlist, (product_id) => ({ product_id }))) });
    }
    const body = path.endsWith("/rpc/product_review_summary")
      ? { averageRating: 0, total: 0, breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }, withPhotos: 0, verified: 0, tags: [] }
      : path.endsWith("/rpc/current_account_role")
        ? "buyer"
        : path.endsWith("/wishlists")
          ? { id: "22222222-2222-4222-8222-222222222222" }
          : [];
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": "0-0/0" }, body: JSON.stringify(body) });
  });
});

function tokenPart(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function signInBuyer(page: Page) {
  if (!authStorageKey) throw new Error("Preview Supabase URL is required for authenticated browser tests.");
  const expiresAt = Math.floor(Date.now() / 1000) + 3_600;
  const accessToken = `${tokenPart({ alg: "none", typ: "JWT" })}.${tokenPart({ sub: buyer.id, role: buyer.role, aud: buyer.aud, email: buyer.email, aal: "aal1", exp: expiresAt })}.e2e`;
  await page.route("**/auth/v1/user", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buyer) }));
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: authStorageKey,
    session: { access_token: accessToken, refresh_token: "e2e-refresh", expires_at: expiresAt, expires_in: 3_600, token_type: "bearer", user: buyer }
  });
}

async function openFirstProduct(page: Page) {
  await page.goto("/");
  const link = page.locator(".product-card-media a").first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/products\//);
}

test("a 300px reload stays styled before and after hydration", async ({ page }) => {
  await page.setViewportSize({ width: 300, height: 600 });
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<script type="module" src="\/src\/main\.tsx"><\/script>|<script type="module" crossorigin src="\/assets\/index-[^"]+"><\/script>/, "");
    await route.fulfill({ response, body: html });
  });
  await page.goto("/");
  const fallback = page.locator(".seo-fallback");
  const heading = page.getByRole("heading", { name: "Fieldio Shop" });
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveCSS("font-family", /Manrope/);
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS("font-family", /Schibsted Grotesk/);
  await expect(page.getByRole("link", { name: "How Fieldio works" })).toHaveAttribute("href", "/how-it-works");
  const overflow = await page.locator("body *").evaluateAll((elements) => elements.flatMap((element) => {
    const box = element.getBoundingClientRect();
    return box.left < -1 || box.right > document.documentElement.clientWidth + 1 ? [`${element.tagName.toLowerCase()}.${element.className}: ${box.left}-${box.right}`] : [];
  }));
  expect(overflow).toEqual([]);
  await page.unroute("**/");
  await page.reload();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("home catalogue controls fit without page overflow across viewports", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".catalog-controls")).toBeVisible();

  for (const width of [320, 360, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await page.locator(".catalog-controls").evaluate((controls) => {
      const bounds = controls.getBoundingClientRect();
      const links = Array.from(controls.querySelectorAll("a"));
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        controlOverflow: controls.scrollWidth - controls.clientWidth,
        links: links.map((link) => {
          const rect = link.getBoundingClientRect();
          return { text: link.textContent?.trim(), left: rect.left, right: rect.right, height: rect.height, width: rect.width, withinControls: rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 };
        })
      };
    });
    expect(layout.pageOverflow, `${width}px page overflow`).toBe(0);
    expect(layout.controlOverflow, `${width}px catalogue overflow`).toBe(0);
    expect(layout.links.every((link) => link.withinControls), `${width}px control clipping`).toBe(true);
    if (width <= 768) expect(layout.links.every((link) => link.height >= 44 && link.width >= 44), `${width}px touch targets`).toBe(true);
  }
});

test("customer can build a request from product to checkout", async ({ page, isMobile }) => {
  await signInBuyer(page);
  await page.goto("/products/architectural-column-dress");
  await expect(page.getByRole("heading", { name: "Architectural Column Dress" })).toBeVisible();
  if (isMobile) expect(await page.locator(".variant-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);
  const firstVariant = page.locator('input[type="radio"]:not([disabled])').first();
  await expect(firstVariant).toBeVisible();
  await firstVariant.check();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Complete your request" })).toBeVisible();
  await expect(page.getByText("No payment is taken here.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Delivery destination" })).toBeVisible();
  await expect(page.locator(".checkout-assurance section").first().locator("strong")).toContainText(/ · [A-Z]{3}$/);
  await expect(page.getByText(/cryptocurrency may be available by arrangement/i)).toBeVisible();
  await page.getByLabel("Full name").fill("Ada Example");
  await page.getByLabel("Phone number").fill("+447000000000");
  await page.locator(".checkout-form").getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Shipping address").fill("10 Example Street, London, United Kingdom");
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  const whatsappRequest = page.waitForRequest(/^https:\/\/wa\.me\/447344059705\?text=/);
  await page.getByRole("button", { name: "Send order request" }).click();
  expect(decodeURIComponent((await whatsappRequest).url())).toContain("Fieldio Order Request");
});

test("public shopping uses safe variant availability without reading inventory rows", async ({ page }) => {
  let availabilityCalls = 0;
  let operationalInventoryRequested = false;
  await page.route("http://127.0.0.1:54321/rest/v1/products?*", (route) => {
    operationalInventoryRequested ||= new URL(route.request().url()).searchParams.get("select")?.includes("inventory(") ?? false;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{
      id: "privacy-product", sku: "PRIVACY-P1", slug: "privacy-test-coat", name: "Privacy Test Coat", description: "A tailored black coat.", short_description: "A tailored black coat.", price: 12000, currency: "GBP",
      materials: null, care_information: null, featured: false, is_new_arrival: false, is_sale: false, inquiry_only: false,
      tags: [], seo_title: null, seo_description: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
      brand: { name: "Fieldio" }, category: { name: "Clothing" }, images: [{ id: "image", public_url: "/images/luxury-travel.png", storage_path: "", alt_text: "Black coat", position: 0 }],
      variants: [{ id: "privacy-variant", sku: "PRIVACY-V1", name: "Black / M", size: "M", color: "Black", price_override: null, is_active: true }],
      collection_products: []
    }]) });
  });
  await page.route("http://127.0.0.1:54321/rest/v1/rpc/shop_variant_availability", (route) => {
    availabilityCalls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ variant_id: "privacy-variant", available_quantity: 2 }]) });
  });
  await page.goto("/products/privacy-test-coat");
  await expect(page.getByRole("heading", { name: "Privacy Test Coat" })).toBeVisible();
  await page.locator('input[type="radio"][value="privacy-variant"]').check();
  await expect(page.getByRole("button", { name: "Add to bag" }).first()).toBeEnabled();
  expect(availabilityCalls).toBeGreaterThan(0);
  expect(operationalInventoryRequested).toBe(false);
});

test("order confirmation stays usable across Fieldio breakpoints and themes", async ({ page }) => {
  await signInBuyer(page);
  await page.addInitScript(({ id }) => sessionStorage.setItem("fieldio-checkout-confirmation-v1", JSON.stringify({
    userId: id,
    reference: "FLD-202610-02001",
    paymentStatus: "pending",
    groups: [{ storeName: "Atelier A", itemCount: 2 }, { storeName: "Studio B", itemCount: 1 }],
    cartSignature: "[]"
  })), { id: buyer.id });

  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/checkout");
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark") await page.getByRole("button", { name: "Switch to dark mode" }).click();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("heading", { name: "Order request received" })).toBeVisible();
      await expect(page.getByText("FLD-202610-02001")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      const actions = page.locator(".checkout-confirmation-actions a");
      for (let index = 0; index < await actions.count(); index += 1) expect((await actions.nth(index).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Order request received" })).toBeVisible();
  await expect(page.getByText("FLD-202610-02001")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("multi-store bag stays scannable across Fieldio breakpoints and themes", async ({ page, isMobile }) => {
  test.skip(isMobile, "One browser project covers the explicit viewport matrix.");
  await signInBuyer(page);
  await page.addInitScript(() => localStorage.setItem("fieldio-cart-v1", JSON.stringify({ state: { items: [
    { key: "product-a:variant-a", productId: "product-a", variantId: "variant-a", sku: "A-1", productName: "Editorial coat", brand: "Atelier A", image: "/images/luxury-travel.png", selectedVariant: "Black / M", quantity: 1, availableQuantity: 4, unitPrice: 12000, currency: "GBP", sellerStoreName: "Atelier A", sellerStoreSlug: "atelier-a" },
    { key: "product-b:variant-b", productId: "product-b", variantId: "variant-b", sku: "B-1", productName: "Leather bag", brand: "Studio B", image: "/images/olive-silk-look.png", selectedVariant: "Oxblood", quantity: 2, availableQuantity: 5, unitPrice: 9000, currency: "GBP", sellerStoreName: "Studio B", sellerStoreSlug: "studio-b" }
  ] }, version: 0 })));

  for (const theme of ["light", "dark"] as const) {
    await page.addInitScript((value) => localStorage.setItem("fieldio-theme", value), theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator('.bag-button[aria-label*="3 items"]')).toBeVisible();
      await page.locator(".bag-button:visible").click();
      const drawer = page.getByRole("dialog", { name: /Your bag/ });
      await expect(drawer.getByRole("heading", { name: "Atelier A" })).toBeVisible();
      await expect(drawer.getByRole("heading", { name: "Studio B" })).toBeVisible();
      await expect(drawer.getByText(/different stores/i)).toBeVisible();
      await expect.poll(() => drawer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      const quantityControls = drawer.locator(".quantity-stepper");
      for (let index = 0; index < await quantityControls.count(); index += 1) expect((await quantityControls.nth(index).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("mobile navigation opens, traps focus, and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation test");
  await page.goto("/");
  await expect(page.locator(".header-actions .mobile-account-button + .bag-button")).toHaveCount(1);
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(dialog.getByRole("link", { name: "Bags", exact: true })).toHaveAttribute("href", "/collections/bags");
  await expect(dialog.getByRole("link", { name: "Shoes", exact: true })).toHaveAttribute("href", "/collections/shoes");
  await expect(dialog.getByRole("link", { name: "Brands", exact: true })).toHaveAttribute("href", "/brands");
  const controls = dialog.locator('a[href], button:not([disabled])');
  await controls.last().focus();
  await page.keyboard.press("Tab");
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("homepage keeps top-level shopping grouped by gender", async ({ page }) => {
  await page.goto("/");
  const categories = page.getByRole("navigation", { name: "Product categories" });
  await expect(categories.getByRole("link")).toHaveText(["All", "Women", "Men"]);
});

test("product cards and details do not show request-only labels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Request only", { exact: true })).toHaveCount(0);
  await openFirstProduct(page);
  await expect(page.getByText("Request only", { exact: true })).toHaveCount(0);
});

test("product reviews load without overflow and keep touch-safe controls", async ({ page }) => {
  await openFirstProduct(page);
  const reviews = page.locator("#reviews");
  await reviews.scrollIntoViewIfNeeded();
  await expect(reviews.getByRole("heading", { name: "Customer reviews" })).toBeVisible();
  await expect(reviews.getByText(/No reviews yet|\d+ ratings?/)).toBeVisible();
  await expect(reviews.getByText("Reviews are temporarily unavailable.")).toHaveCount(0);
  await expect.poll(() => reviews.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const ratingControls = reviews.locator(".review-breakdown button");
  for (let index = 0; index < await ratingControls.count(); index += 1) {
    expect((await ratingControls.nth(index).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});

test("seller entry is clear, responsive, and returns to the protected flow after sign in", async ({ page }) => {
  await page.goto("/sell");
  await expect(page.getByRole("heading", { name: "Sell with Fieldio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create seller account" })).toHaveAttribute("href", "/account?mode=signup&returnTo=%2Fsell");
  await expect(page.getByRole("link", { name: /Already have an account/ })).toHaveAttribute("href", "/account?returnTo=%2Fsell");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("vendor attention and reserved inventory stay readable across breakpoints", async ({ page }) => {
  await signInBuyer(page);
  await page.route("http://127.0.0.1:54321/rest/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const name = pathname.split("/").pop();
    const rows: Record<string, unknown> = {
      seller_applications: { id: "application", owner_id: buyer.id, status: "approved" },
      seller_stores: { id: "store", owner_id: buyer.id, name: "Atelier Fieldio", slug: "atelier-fieldio", description: "Independent fashion studio.", logo_path: null, status: "active", updated_at: "2026-09-24T00:00:00Z" },
      seller_listings: [{ id: "listing", title: "Tailored coat", description: "A tailored coat.", status: "approved", price: 12000, currency: "GBP", review_reason: null, published_product_id: null, created_at: "2026-09-24T00:00:00Z", images: [], variants: [{ id: "matrix", color: "Black", size: "M", quantity: 4, published_variant_id: "variant" }] }],
      inventory: [{ variant_id: "variant", quantity: 4, reserved_quantity: 2, low_stock_threshold: 2 }],
      categories: [],
      seller_order_fulfillments: [],
      seller_review_summary: { averageRating: 0, total: 0, breakdown: {} },
      seller_payouts: [
        { id: "payout-gbp", amount: 24000, currency: "GBP", status: "held", reference: null, note: null, created_at: "2026-09-24T00:00:00Z", paid_at: null, items: [] },
        { id: "payout-usd", amount: 10000, currency: "USD", status: "approved", reference: "P-USD", note: null, created_at: "2026-09-23T00:00:00Z", paid_at: null, items: [] }
      ],
      payout_adjustments: [],
      vendor_notifications: [{ id: 1, kind: "payment_confirmed", title: "Order ready for your response", body: "Payment is confirmed for order FLD-123.", href: "/sell#seller-fulfillments", created_at: "2026-09-24T00:00:00Z" }],
      marketplace_returns: [],
      marketplace_disputes: []
    };
    const body = JSON.stringify(rows[name ?? ""] ?? []);
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": "0-0/0" }, body });
  });
  await page.goto("/sell");
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await expect(page.getByRole("link", { name: /1 variant low on available stock/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Updates for your store" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "On hold" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Approved" })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}px dashboard overflow`).toBeLessThanOrEqual(0);
  }
  await page.getByRole("button", { name: "Manage inventory" }).click();
  await expect(page.getByRole("heading", { name: "Manage inventory" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: /Stock on hand for Black, M/ })).toHaveAttribute("min", "2");
  await expect(page.getByLabel("Available stock for Black, M")).toHaveText("2");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}px inventory overflow`).toBeLessThanOrEqual(0);
  }
  const themeBefore = await page.locator("html").getAttribute("data-theme");
  await page.getByRole("button", { name: /Switch to (dark|light) mode/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", themeBefore ?? "");
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "320px alternate-theme overflow").toBeLessThanOrEqual(0);
});

test("mobile purchase bar appears only after the in-flow controls are passed", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile purchase bar test");
  await page.addInitScript(() => {
    const state = window as Window & { __fieldioEvents: string[] };
    state.__fieldioEvents = [];
    window.addEventListener("fieldio:analytics", (event) => state.__fieldioEvents.push((event as CustomEvent<{ name: string }>).detail.name));
  });
  await openFirstProduct(page);
  await expect(page.locator(".mobile-purchase-bar")).toHaveCount(0);
  const variant = page.locator('input[type="radio"]:not([disabled])').first();
  if (!await variant.isChecked()) await variant.check();
  await page.getByRole("button", { name: /Increase quantity for/ }).click();
  await page.getByRole("heading", { name: "You may also like" }).scrollIntoViewIfNeeded();
  const purchaseBar = page.locator(".mobile-purchase-bar");
  await expect(purchaseBar).toContainText(/Qty 2/);
  await expect(purchaseBar).toContainText(/Bag 0/);
  await expect.poll(() => page.evaluate(() => (window as Window & { __fieldioEvents: string[] }).__fieldioEvents)).toContain("quantity_change");
});

test("related rail supports keyboard browsing and quick request", async ({ page }) => {
  await signInBuyer(page);
  await openFirstProduct(page);
  const rail = page.getByRole("list", { name: /Related products/ });
  await rail.scrollIntoViewIfNeeded();
  await rail.focus();
  const before = await rail.evaluate((element) => element.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
  const related = rail.locator("article").first();
  await related.locator(".quick-action").click();
  const sizeOptions = related.locator(".quick-size-options button:not([disabled])");
  if (await sizeOptions.count()) await sizeOptions.first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();
});

test("Shadcn product accordion remains accessible within the motion system", async ({ page }) => {
  await openFirstProduct(page);
  const trigger = page.getByRole("button", { name: "Materials & care" });
  await expect(trigger).toHaveAttribute("data-slot", "accordion-trigger");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-slot="accordion-content"][data-state="open"]')).not.toBeEmpty();
  await expect(page.locator("#main-content .editorial-word")).not.toHaveCount(0);
});

test("route transitions restore keyboard context and announce the destination", async ({ page }) => {
  await openFirstProduct(page);
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.locator("#status-region")).toContainText("Navigated to");
});

test("product purchase content stops before the details section", async ({ page }) => {
  await openFirstProduct(page);
  const details = page.locator(".product-editorial-details");
  await expect(details).toBeVisible();
  const detailsTop = await details.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((top) => window.scrollTo(0, top - 24), detailsTop);
  await expect.poll(() => page.evaluate(() => {
    const purchase = document.querySelector(".product-purchase")!.getBoundingClientRect();
    const editorial = document.querySelector(".product-editorial-details")!.getBoundingClientRect();
    return purchase.bottom <= editorial.top;
  })).toBe(true);
});

test("bag traps focus after quantity changes and restores its trigger", async ({ page }) => {
  await signInBuyer(page);
  await openFirstProduct(page);
  const variant = page.locator('input[type="radio"]:not([disabled])').first();
  if (!await variant.isChecked()) await variant.check();
  const trigger = page.getByRole("button", { name: "Add to bag" }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /Your bag/ });
  await dialog.getByRole("button", { name: "Increase quantity" }).click();
  await expect(dialog.locator("output")).toHaveText("02");
  await dialog.getByRole("button", { name: "Continue shopping" }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close cart" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("empty bag offers a clear route back to shopping", async ({ page, isMobile }) => {
  await signInBuyer(page);
  await page.goto("/");
  if (isMobile) {
    await expect(page.getByRole("link", { name: "Account", exact: true })).toHaveAttribute("href", "/account");
  }
  await page.getByRole("button", { name: "Open bag, 0 items" }).click();
  const dialog = page.getByRole("dialog", { name: /Your bag/ });
  await expect(dialog).toContainText("Your edit is empty.");
  await expect(dialog.getByRole("button", { name: "Continue shopping" })).toBeVisible();
});

test("collection filtering, wishlist, and search are usable", async ({ page, isMobile }) => {
  await signInBuyer(page);
  await page.goto("/collections/men");
  await expect(page.getByRole("navigation", { name: "Men's categories" })).toBeVisible();
  await page.getByRole("navigation", { name: "Shop by gender" }).getByRole("link", { name: "Women", exact: true }).click();
  await expect(page).toHaveURL(/\/collections\/women$/);
  await expect(page.getByRole("navigation", { name: "Women's categories" })).toContainText("Dresses");
  await page.getByRole("navigation", { name: "Shop by gender" }).getByRole("link", { name: "Men", exact: true }).click();
  await expect(page).toHaveURL(/\/collections\/men$/);
  await page.goto("/collections");
  const firstCard = page.locator(".product-card").first();
  await expect(firstCard).toBeVisible();
  const productLink = firstCard.locator(".product-card-media a");
  const productLabel = await productLink.getAttribute("aria-label");
  const productName = productLabel?.replace(/^View /, "") ?? "";
  const brand = (await firstCard.locator(".product-brand").textContent())?.trim() ?? "";
  if (isMobile) await page.getByRole("button", { name: "Filter & sort" }).click();
  await page.getByRole("combobox", { name: "Brand", exact: true }).selectOption({ label: brand });
  if (isMobile) await page.getByRole("button", { name: /View \d+ pieces?/ }).click();
  await expect(page.getByRole("link", { name: productLabel! })).toBeVisible();
  const wishlistSync = page.waitForRequest((request) => request.url().includes("/rest/v1/wishlist_items") && request.method() === "POST");
  await page.getByRole("button", { name: `Add ${productName} to wishlist` }).click();
  await wishlistSync;
  await page.goto("/wishlist");
  await expect(page.getByRole("link", { name: productLabel! })).toBeVisible();
  await page.goto("/search");
  await page.getByRole("searchbox").or(page.getByLabel("Search products")).fill(brand);
  await expect(page.locator(".search-count")).toContainText(/\d+ results?/);
});

test("newsletter failures have a recovery message", async ({ page }) => {
  await page.route("**/api/newsletter", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Subscriptions are temporarily unavailable. Please try again later." }) }));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email address", exact: true }).fill("ada@example.com");
  await page.getByRole("checkbox", { name: /I agree to receive Fieldio/ }).check();
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  await expect(page.locator(".newsletter .form-message")).toContainText("Subscriptions are temporarily unavailable");
});

test("contact form recovers from a lost network connection", async ({ page }) => {
  await page.route("**/api/contact", (route) => route.abort("failed"));
  await page.goto("/contact");
  const form = page.locator(".service-form");
  await form.getByLabel("Name", { exact: true }).fill("Ada Example");
  await form.getByLabel("Email", { exact: true }).fill("ada@example.com");
  await form.getByLabel(/^Phone/).fill("+447000000000");
  await form.getByLabel("Subject", { exact: true }).fill("Product request");
  await form.getByLabel("Message", { exact: true }).fill("I would like help sourcing a specific piece.");
  await form.getByRole("button", { name: "Send enquiry" }).click();
  await expect(form.locator(".form-message")).toContainText("offline");
});

test("availability requests prefill the contact form", async ({ page }) => {
  await page.goto("/contact?subject=Availability%20alert&message=Please%20notify%20me");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("Availability alert");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Please notify me");
});

test("Arabic customer pages use translated copy and RTL layout", async ({ page, isMobile }) => {
  await page.route("**/api/locale", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ country: "GB", language: "en-GB" }) }));
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("fieldio-locale-v1"));
  await page.reload();
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: /Change region and language/ }).click();
  await page.getByRole("dialog", { name: "Region and language" }).getByText("العربية", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar-AE");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.keyboard.press("Escape");
  await page.goto("/search");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ابحث في المختارات");
  await expect(page.locator("#site-search")).toHaveAttribute("placeholder", "منتج أو علامة أو فئة");
});

test("theme follows the system, persists a choice, and remains keyboard operable", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("fieldio-theme"));
  await page.reload();

  const toggle = page.getByRole("button", { name: "Switch to dark mode" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fieldio-theme"))).toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
});

test("homepage account invitation opens account creation directly", async ({ page }) => {
  await page.goto("/");
  const brandLedger = page.getByRole("region", { name: "A worldwide luxury desk" });
  await expect(brandLedger.locator(".brand-list > a")).toHaveCount(6);
  await expect(brandLedger.getByRole("link", { name: "View all brands" })).toHaveAttribute("href", "/brands");
  const invitation = page.getByRole("region", { name: "Keep your edit close." });
  await expect(invitation).toContainText("save your wishlist, details, and order requests");
  await invitation.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account\?mode=signup$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("guest protected routes redirect once and preserve their original destination", async ({ page }) => {
  for (const path of ["/wishlist", "/checkout"]) {
    const expected = `/account?mode=signup&returnTo=${encodeURIComponent(path)}`;
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${expected.replace(/[?]/g, "\\?")}$`));
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.waitForTimeout(400);
    expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(expected);
  }
});

test("brand directory searches and filters the available brands", async ({ page }) => {
  await page.goto("/brands");
  const search = page.getByRole("searchbox", { name: "Search brands" });
  await expect(search).toBeVisible();
  await expect(page.getByRole("link", { name: "Prada", exact: true })).toBeVisible();

  await search.fill("Prada");
  await expect(page.getByText("1 brand", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Prada", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gucci", exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "G", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("button", { name: "G", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Gucci", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Prada", exact: true })).not.toBeVisible();
});

test("scroll-to-top appears near the footer, rests quietly, and returns to the top", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".catalog-intro h1")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const control = page.locator(".scroll-to-top");
  await expect(control).not.toHaveAttribute("data-visible", "true");

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(control).toHaveAttribute("data-visible", "true");
  await expect(control).toHaveCSS("position", "fixed");

  await expect(control).not.toHaveAttribute("data-visible", "true", { timeout: 2_500 });
  await page.evaluate(() => window.scrollBy(0, -2));
  await expect(control).toHaveAttribute("data-visible", "true");
  await control.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
});

test("account methods fit cleanly at desktop and mobile widths", async ({ page, isMobile }) => {
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.google={accounts:{id:{initialize:()=>{},renderButton:(parent)=>{const button=document.createElement("button");button.textContent="Continue with Google";parent.append(button)}}}};`
  }));
  await page.goto("/account");
  const google = page.getByRole("button", { name: "Continue with Google" });
  const email = page.getByRole("button", { name: "Continue with email" });
  await expect(google).toBeVisible();
  await expect(email).toBeVisible();
  const [googleBox, emailBox] = await Promise.all([google.boundingBox(), email.boundingBox()]);
  expect(googleBox).not.toBeNull();
  expect(emailBox).not.toBeNull();
  expect(await page.locator(".google-signin-button").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  if (isMobile) {
    expect(emailBox!.y).toBeGreaterThanOrEqual(googleBox!.y + googleBox!.height);
  } else {
    expect(Math.abs(emailBox!.y - googleBox!.y)).toBeLessThan(1);
    expect(emailBox!.x).toBeGreaterThanOrEqual(googleBox!.x + googleBox!.width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByText("Email and password", { exact: true })).toBeVisible();
});

test("primary public routes do not overflow the viewport", async ({ page }) => {
  for (const path of ["/", "/collections", "/collections/women", "/collections/men", "/brands", "/search", "/wishlist", "/account", "/sell", "/personal-shopping", "/wholesale", "/contact", "/about", "/promise", "/how-it-works", "/shipping", "/returns", "/privacy", "/terms", "/cookies"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${path} overflows the viewport`).toBe(true);
  }
});


test("region choice localizes the storefront and persists", async ({ page }, testInfo) => {
  await page.route("**/api/locale", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ country: "GB", language: "en-GB" }) }));
  await page.route("**/api/rates?*", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ base: "GBP", rates: { GBP: 1, EUR: 1.16, USD: 1.34 } }) }));
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("fieldio-locale-v1"));
  await page.reload();

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Fieldio on Instagram" })).toHaveAttribute("href", "https://www.instagram.com/fieldio_wrd/");
  }
  await page.getByRole("button", { name: /Change region and language/ }).click();
  const panel = page.getByRole("dialog", { name: "Region and language" });
  await panel.getByRole("searchbox").fill("France");
  await panel.getByRole("button", { name: /France.*EUR/ }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByText("Sourcing et expédition dans le monde entier")).toBeVisible();
  await page.getByRole("button", { name: "Fermer la région et la langue" }).click();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
  await expect(page.getByText("La sélection Fieldio")).toBeVisible();
});
