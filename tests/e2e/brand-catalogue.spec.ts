import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seededBrands = [...readFileSync("supabase/migrations/202611160001_public_brand_catalogue.sql", "utf8")
  .matchAll(/^\s*\('((?:''|[^'])+)', '([a-z0-9-]+)'/gm)]
  .map(([, name, slug]) => [name!.replaceAll("''", "'"), slug!] as const);
const brands = [
  ["Dior", "dior"], ["Gucci", "gucci"], ["Louis Vuitton", "louis-vuitton"],
  ["Prada", "prada"], ["Yves Saint Laurent", "yves-saint-laurent"], ["Zara", "zara"],
  ...seededBrands
].map(([name, slug], index) => ({ id: String(index), name, slug, description: name === "Maison Margiela" ? "Explore Maison Margiela on Fieldio. Browse available pieces when listed, or ask for sourcing assistance." : null, seo_title: null, seo_description: null }));

test.beforeEach(async ({ page }) => {
  await page.route("**/rest/v1/brands?*", (route) => {
    const slug = new URL(route.request().url()).searchParams.get("slug")?.replace("eq.", "");
    const selected = slug ? brands.find((brand) => brand.slug === slug) : null;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(slug ? selected ?? null : brands) });
  });
  await page.route("**/rest/v1/categories?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/discovery_products?*", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": "*/0" }, body: "[]" }));
});

test("brand directory remains usable across mobile and desktop", async ({ page }) => {
  await page.goto("/brands");
  await expect(page.locator(".brand-directory-group a")).toHaveCount(brands.length);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("link", { name: "Maison Margiela" })).toBeVisible();
    await expect(page.locator(".brand-directory-group a")).toHaveCount(brands.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px brand directory overflow`).toBe(true);
    if (width === 1440) {
      const buttons = page.locator(".brand-alphabet button");
      const first = await buttons.first().boundingBox();
      const last = await buttons.last().boundingBox();
      expect(first).not.toBeNull();
      expect(last).not.toBeNull();
      expect(Math.abs(first!.y - last!.y)).toBeLessThan(0.5);
    }
  }
  await page.getByRole("link", { name: "Maison Margiela" }).click();
  await expect(page.getByRole("heading", { name: "Maison Margiela" })).toBeVisible();
});

test("empty Maison Margiela page remains responsive", async ({ page }) => {
  await page.goto("/brands/maison-margiela");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "Maison Margiela" })).toBeVisible();
    await expect(page.getByText("No pieces in this edit yet.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px brand page overflow`).toBe(true);
  }
});

test("representative brand routes remain usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const name of ["Pull&Bear", "Bottega Veneta", "Yves Saint Laurent", "Celine", "A.P.C."]) {
    const slug = brands.find((brand) => brand.name === name)?.slug;
    expect(slug).toBeTruthy();
    await page.goto(`/brands/${slug}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} page overflow`).toBe(true);
  }
});
