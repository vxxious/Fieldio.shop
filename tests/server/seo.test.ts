import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@supabase/supabase-js", () => ({ createClient: () => null }));
vi.mock("node:fs/promises", async () => ({
  ...await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises"),
  readFile: async () => '<!doctype html><html><head><title>Fallback</title><script type="module" src="/assets/app.js"></script></head><body><div id="root"><main><h1>Fieldio Shop</h1></main></div></body></html>'
}));

import { GET as renderPage } from "../../api/render";
import { GET as renderSitemap } from "../../api/sitemap";

it("ships crawlable Fieldio content before the client bundle starts", () => {
  const html = readFileSync("index.html", "utf8");
  expect(html).toContain("<h1>Fieldio Shop</h1>");
  expect(html).toContain('<a href="/about">About Fieldio</a>');
  expect(html).not.toContain("<span>Loading Fieldio</span>");
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

  const account = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/account"))).text();
  expect(account).toContain('<meta name="robots" content="noindex,nofollow">');
  expect(account).toContain("Loading Fieldio");

  const sitemapResponse = await renderSitemap(new Request("https://fieldio.shop/api/sitemap"));
  const sitemap = await sitemapResponse.text();
  expect(sitemapResponse.headers.get("content-type")).toContain("application/xml");
  expect(sitemap).toContain("https://fieldio.shop/collections/men");
  expect(sitemap).toContain("https://fieldio.shop/promise");
  expect(sitemap).toContain("https://fieldio.shop/how-it-works");
  expect(sitemap).not.toContain("/account");
  expect(sitemap).not.toContain("/collections/bags");
});
