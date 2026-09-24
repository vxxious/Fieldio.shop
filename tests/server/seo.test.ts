import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => null }));
vi.mock("node:fs/promises", async () => ({
  ...await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises"),
  readFile: async () => '<!doctype html><html><head><title>Fallback</title></head><body><div id="root"><div class="route-loading app-boot-loader" role="status"><span>Loading Fieldio</span></div></div><script type="module" src="/assets/app.js"></script></body></html>'
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
  expect(home).toContain("Fieldio Shop | Designer Fashion &amp; Personal Shopping");
  expect(home).toContain('"@type":"OnlineStore"');
  expect(home).toContain('"@type":"WebSite"');
  expect(home).toContain('<link rel="canonical" href="https://fieldio.shop/">');
  expect(home).toContain("Fieldio is an independent designer fashion marketplace");
  expect(home).toContain('<a href="/about">About Fieldio</a>');
  expect(home).not.toContain("Loading Fieldio");

  const sitemapResponse = await renderSitemap(new Request("https://fieldio.shop/api/sitemap"));
  const sitemap = await sitemapResponse.text();
  expect(sitemapResponse.headers.get("content-type")).toContain("application/xml");
  expect(sitemap).toContain("https://fieldio.shop/collections/men");
  expect(sitemap).toContain("https://fieldio.shop/promise");
  expect(sitemap).toContain("https://fieldio.shop/how-it-works");
  expect(sitemap).not.toContain("/account");
  expect(sitemap).not.toContain("/collections/bags");
});
