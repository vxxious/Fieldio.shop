import { expect, test, type Page } from "@playwright/test";

async function openFirstProduct(page: Page) {
  await page.goto("/");
  const link = page.locator(".product-card-media a").first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/products\//);
}

test("boot loader is centred before the client bundle starts", async ({ page }) => {
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<script type="module" src="\/src\/main\.tsx"><\/script>|<script type="module" crossorigin src="\/assets\/index-[^"]+"><\/script>/, "");
    await route.fulfill({ response, body: html });
  });
  await page.goto("/");
  const loader = page.getByRole("status").filter({ hasText: "Loading Fieldio" });
  await expect(loader).toBeVisible();
  const box = await loader.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs(box!.x + box!.width / 2 - viewport!.width / 2)).toBeLessThan(2);
  expect(Math.abs(box!.y + box!.height / 2 - viewport!.height / 2)).toBeLessThan(2);
  await expect(loader).toHaveCSS("font-family", /Manrope/);
});

test("customer can build a request from product to checkout", async ({ page }) => {
  await openFirstProduct(page);
  const firstVariant = page.locator('input[type="radio"]:not([disabled])').first();
  await expect(firstVariant).toBeVisible();
  await firstVariant.check();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();
  await page.getByRole("link", { name: "Checkout via WhatsApp" }).click();
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
  await page.getByRole("button", { name: "Continue on WhatsApp" }).click();
  expect(decodeURIComponent((await whatsappRequest).url())).toContain("Fieldio Order Request");
});

test("mobile navigation opens, traps focus, and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation test");
  await page.goto("/");
  await expect(page.locator(".header-actions .mobile-account-button + .bag-button")).toHaveCount(1);
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(dialog.getByRole("link", { name: "Bags", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Shoes", exact: true })).toHaveCount(0);
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

test("seller entry is clear, responsive, and returns to the protected flow after sign in", async ({ page }) => {
  await page.goto("/sell");
  await expect(page.getByRole("heading", { name: "Sell with Fieldio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create seller account" })).toHaveAttribute("href", "/account?mode=signup&returnTo=%2Fsell");
  await expect(page.getByRole("link", { name: /Already have an account/ })).toHaveAttribute("href", "/account?returnTo=%2Fsell");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

test("empty bag offers account sign in", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await expect(page.getByRole("link", { name: "Account", exact: true })).toHaveAttribute("href", "/account");
  }
  await page.getByRole("button", { name: "Open bag, 0 items" }).click();
  const dialog = page.getByRole("dialog", { name: /Your bag/ });
  await expect(dialog).toContainText("Have an account?");
  await expect(dialog.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/account");
});

test("collection filtering, wishlist, and search are usable", async ({ page, isMobile }) => {
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
  await page.getByRole("button", { name: `Add ${productName} to wishlist` }).click();
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
  await expect(page.getByRole("heading", { name: "The Fieldio edit" })).toBeVisible();
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
    body: `window.google={accounts:{id:{initialize:()=>{},renderButton:(parent)=>{const button=document.createElement("button");button.textContent="Continue with Google";button.style.width="200px";parent.append(button)}}}};`
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
