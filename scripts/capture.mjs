import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir(".impeccable/review", { recursive: true });
const browser = await chromium.launch();

async function capture(name, viewport, path = "/") {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`http://127.0.0.1:4173${path}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((resolve) => window.setTimeout(resolve, 5000))]));
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => window.setTimeout(resolve, 70));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true });
  await page.close();
}

await capture("desktop", { width: 1440, height: 1000 });
await capture("mobile", { width: 390, height: 844 });
await capture("product-desktop", { width: 1440, height: 1000 }, "/products/louis-vuitton-personal-sourcing");
await capture("product-mobile", { width: 390, height: 844 }, "/products/taupe-suede-overshirt");
await capture("collection-desktop", { width: 1440, height: 1000 }, "/collections/luxury");
await capture("collection-mobile", { width: 390, height: 844 }, "/collections/men");

const stickyPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await stickyPage.emulateMedia({ reducedMotion: "reduce" });
await stickyPage.goto("http://127.0.0.1:4173/products/taupe-suede-overshirt", { waitUntil: "domcontentloaded" });
await stickyPage.getByRole("radio", { name: "M", exact: true }).check();
await stickyPage.getByRole("button", { name: "Increase quantity for Taupe Suede Overshirt" }).click();
await stickyPage.getByRole("heading", { name: "You may also like" }).scrollIntoViewIfNeeded();
await stickyPage.locator(".mobile-purchase-bar").waitFor();
await stickyPage.screenshot({ path: ".impeccable/review/product-sticky-mobile.png" });
await stickyPage.close();

const cartPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await cartPage.emulateMedia({ reducedMotion: "reduce" });
await cartPage.goto("http://127.0.0.1:4173/products/louis-vuitton-personal-sourcing", { waitUntil: "domcontentloaded" });
await cartPage.getByRole("button", { name: "Add to bag" }).first().click();
await cartPage.getByRole("dialog").waitFor();
await cartPage.screenshot({ path: ".impeccable/review/cart-desktop.png" });
await cartPage.getByRole("link", { name: "Checkout via WhatsApp" }).click();
await cartPage.waitForURL("**/checkout");
await cartPage.getByRole("heading", { name: "Complete your request" }).waitFor();
await cartPage.waitForTimeout(800);
await cartPage.evaluate(() => window.scrollTo(0, 0));
await cartPage.screenshot({ path: ".impeccable/review/checkout-desktop.png", fullPage: true });
await cartPage.close();

for (const theme of ["light", "dark"]) {
  const menuPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await menuPage.addInitScript((selectedTheme) => {
    localStorage.setItem("fieldio-analytics-consent", "declined");
    localStorage.setItem("fieldio-theme", selectedTheme);
  }, theme);
  await menuPage.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await menuPage.getByRole("button", { name: "Open menu" }).click();
  await menuPage.getByRole("dialog", { name: "Mobile navigation" }).waitFor();
  await menuPage.screenshot({ path: `.impeccable/review/menu-mobile-${theme}.png` });
  await menuPage.close();
}

for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
  const regionPage = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await regionPage.addInitScript(() => {
    localStorage.setItem("fieldio-analytics-consent", "declined");
    localStorage.removeItem("fieldio-locale-v1");
  });
  await regionPage.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  if (label === "mobile") {
    await regionPage.getByRole("button", { name: "Open menu" }).click();
  }
  await regionPage.getByRole("button", { name: /Change region and language/ }).click();
  await regionPage.getByRole("dialog", { name: "Region and language" }).waitFor();
  await regionPage.screenshot({ path: `.impeccable/review/region-${label}.png` });
  await regionPage.getByRole("searchbox").fill("United Arab Emirates");
  await regionPage.getByRole("button", { name: /United Arab Emirates.*AED/ }).click();
  await regionPage.screenshot({ path: `.impeccable/review/region-arabic-${label}.png` });
  await regionPage.close();
}
await browser.close();
