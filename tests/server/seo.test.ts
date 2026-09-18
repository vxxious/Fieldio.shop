import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => null }));
vi.mock("node:fs/promises", async () => ({
  ...await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises"),
  readFile: async () => "<!doctype html><html><head><title>Fallback</title></head><body></body></html>"
}));

import { GET as renderPage } from "../../api/render";
import { GET as renderSitemap } from "../../api/sitemap";

it("centres the boot loader before the client bundle starts", () => {
  const html = readFileSync("index.html", "utf8");
  expect(html.indexOf(".app-boot-loader")).toBeLessThan(html.indexOf('<div id="root">'));
  expect(html).toContain("min-height: 100svh; display: flex; flex-direction: column; align-items: center; justify-content: center");
});

it("serves a distinct Fieldio search identity and crawlable public sitemap", async () => {
  expect(readFileSync("index.html", "utf8")).toContain('<script id="fieldio-identity" type="application/ld+json">');
  const home = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/"))).text();
  expect(home).toContain("Fieldio | Luxury Fashion Sourcing &amp; Personal Shopping");
  expect(home).toContain('"@type":"WebSite"');
  expect(home).toContain('<link rel="canonical" href="https://fieldio.shop/">');

  const sitemapResponse = await renderSitemap(new Request("https://fieldio.shop/api/sitemap"));
  const sitemap = await sitemapResponse.text();
  expect(sitemapResponse.headers.get("content-type")).toContain("application/xml");
  expect(sitemap).toContain("https://fieldio.shop/collections/men");
  expect(sitemap).not.toContain("/account");
  expect(sitemap).not.toContain("/collections/bags");
});
