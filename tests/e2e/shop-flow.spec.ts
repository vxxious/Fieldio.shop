import { expect, test } from "@playwright/test";

test("customer can build a request from product to checkout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Fieldio edit" })).toBeVisible();
  await page.getByRole("link", { name: "View Louis Vuitton Personal Sourcing" }).click();
  await expect(page.getByRole("heading", { name: "Louis Vuitton Personal Sourcing" })).toBeVisible();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();
  await page.getByRole("link", { name: "Checkout via WhatsApp" }).click();
  await expect(page.getByRole("heading", { name: "Complete your request" })).toBeVisible();
  await expect(page.getByText("No payment is taken here.")).toBeVisible();
  await page.getByLabel("Full name").fill("Ada Example");
  await page.getByLabel("Phone number").fill("+447000000000");
  await page.locator(".checkout-form").getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Shipping address").fill("10 Example Street, London, United Kingdom");
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.getByRole("button", { name: "Continue on WhatsApp" }).click();
  const handoff = page.getByRole("link", { name: "Open prepared WhatsApp message" });
  await expect(handoff).toHaveAttribute("href", /^https:\/\/wa.me\/447344059705\?text=/);
  expect(decodeURIComponent(await handoff.getAttribute("href") || "")).toContain("Fieldio Order Request");
});

test("mobile navigation opens, traps focus, and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation test");
  await page.goto("/");
  await expect(page.locator(".header-actions .mobile-account-button + .bag-button")).toHaveCount(1);
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  const controls = dialog.locator('a[href], button:not([disabled])');
  await controls.last().focus();
  await page.keyboard.press("Tab");
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("mobile purchase bar appears only after the in-flow controls are passed", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile purchase bar test");
  await page.addInitScript(() => {
    const state = window as Window & { __fieldioEvents: string[] };
    state.__fieldioEvents = [];
    window.addEventListener("fieldio:analytics", (event) => state.__fieldioEvents.push((event as CustomEvent<{ name: string }>).detail.name));
  });
  await page.goto("/products/taupe-suede-overshirt");
  await expect(page.locator(".mobile-purchase-bar")).toHaveCount(0);
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.getByRole("button", { name: "Increase quantity for Taupe Suede Overshirt" }).click();
  await page.getByRole("heading", { name: "You may also like" }).scrollIntoViewIfNeeded();
  const purchaseBar = page.locator(".mobile-purchase-bar");
  await expect(purchaseBar).toContainText("M · Qty 2");
  await expect(purchaseBar).toContainText("Bag 0 · To be confirmed");
  await expect.poll(() => page.evaluate(() => (window as Window & { __fieldioEvents: string[] }).__fieldioEvents)).toEqual(expect.arrayContaining(["size_selection", "quantity_change"]));
});

test("related rail supports keyboard browsing and quick request", async ({ page }) => {
  await page.goto("/products/taupe-suede-overshirt");
  const rail = page.getByRole("list", { name: /Related products/ });
  await rail.scrollIntoViewIfNeeded();
  await rail.focus();
  const before = await rail.evaluate((element) => element.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
  await rail.locator("article").first().getByRole("button", { name: "Quick request" }).click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();
});

test("Shadcn product accordion remains accessible within the motion system", async ({ page }) => {
  await page.goto("/products/taupe-suede-overshirt");
  const trigger = page.getByRole("button", { name: "Materials & care" });
  await expect(trigger).toHaveAttribute("data-slot", "accordion-trigger");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-slot="accordion-content"][data-state="open"]')).toContainText("Material confirmed on request");
  await expect(page.locator("#main-content .editorial-word")).not.toHaveCount(0);
});

test("route transitions restore keyboard context and announce the destination", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "View Louis Vuitton Personal Sourcing" }).click();
  await expect(page).toHaveURL(/products\/louis-vuitton-personal-sourcing/);
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.locator("#status-region")).toContainText("Navigated to Louis Vuitton Personal Sourcing");
});

test("bag traps focus after quantity changes and restores its trigger", async ({ page }) => {
  await page.goto("/products/taupe-suede-overshirt");
  await page.getByRole("radio", { name: "M", exact: true }).check();
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
  if (isMobile) await page.getByRole("button", { name: "Filter & sort" }).click();
  await page.getByRole("combobox", { name: "Size", exact: true }).selectOption("M");
  if (isMobile) await page.getByRole("button", { name: /View \d+ pieces?/ }).click();
  await expect(page.getByRole("link", { name: "View Taupe Suede Overshirt" })).toBeVisible();
  await page.getByRole("button", { name: "Add Taupe Suede Overshirt to wishlist" }).click();
  await page.goto("/wishlist");
  await expect(page.getByRole("link", { name: "View Taupe Suede Overshirt" })).toBeVisible();
  await page.goto("/search");
  await page.getByRole("searchbox").or(page.getByLabel("Search products")).fill("Louis Vuitton");
  await expect(page.getByText("1 result", { exact: true })).toBeVisible();
});

test("newsletter failures have a recovery message", async ({ page }) => {
  await page.route("**/api/newsletter", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Subscriptions are temporarily unavailable. Please try again later." }) }));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email address", exact: true }).fill("ada@example.com");
  await page.getByRole("checkbox", { name: /I agree to receive Fieldio/ }).check();
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  await expect(page.locator(".newsletter .form-message")).toContainText("Subscriptions are temporarily unavailable");
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

test("account methods form a full-width mobile stack", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile account layout test");
  await page.goto("/account");
  const google = page.getByRole("button", { name: "Continue with Google" });
  const email = page.getByRole("button", { name: "Continue with email" });
  await expect(google).toBeVisible();
  await expect(email).toBeVisible();
  const [googleBox, emailBox] = await Promise.all([google.boundingBox(), email.boundingBox()]);
  expect(googleBox).not.toBeNull();
  expect(emailBox).not.toBeNull();
  expect(emailBox!.y).toBeGreaterThan(googleBox!.y + googleBox!.height);
  expect(Math.abs(emailBox!.width - googleBox!.width)).toBeLessThan(1);
  await expect(page.getByText("Email and password", { exact: true })).toBeVisible();
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
