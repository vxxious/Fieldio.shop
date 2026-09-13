import { expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => null }));
vi.mock("node:fs/promises", async () => ({
  ...await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises"),
  readFile: async () => "<!doctype html><html><head><title>Fallback</title></head><body></body></html>"
}));

import { GET as renderPage } from "../../api/render";
import { GET as renderSitemap } from "../../api/sitemap";

it("serves a distinct Fieldio search identity and crawlable public sitemap", async () => {
  const home = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/"))).text();
  expect(home).toContain("Fieldio | Luxury Fashion Sourcing &amp; Personal Shopping");
  expect(home).toContain('"@type":"WebSite"');
  expect(home).toContain('<link rel="canonical" href="https://fieldio.shop/">');

  const sitemapResponse = await renderSitemap();
  const sitemap = await sitemapResponse.text();
  expect(sitemapResponse.headers.get("content-type")).toContain("application/xml");
  expect(sitemap).toContain("https://fieldio.shop/collections/men");
  expect(sitemap).not.toContain("/account");
  expect(sitemap).not.toContain("/collections/bags");
});
