import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => null) }));
vi.mock("node:fs/promises", async () => ({
  ...await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises"),
  readFile: async () => '<!doctype html><html><head><title>Fallback</title><script type="module" src="/assets/app.js"></script></head><body><div id="root"><main><h1>Fieldio Shop</h1></main></div></body></html>'
}));

import { GET as renderPage } from "../../api/render";
import { GET as renderSitemap } from "../../api/sitemap";
import { productBody } from "../../api/_lib/public-html";
import { publicPages } from "../../api/_lib/public-catalog";

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
  expect(home).toContain("A worldwide luxury desk");
  expect(home).toContain("Sell with Fieldio");
  expect(home).not.toContain("Loading Fieldio");

  const about = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/about"))).text();
  expect(about).toContain("Who can sell on Fieldio?");
  expect(about).toContain("Fieldio coordinates worldwide delivery");
  expect(about).toContain('<link rel="canonical" href="https://fieldio.shop/about">');

  const returns = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/returns"))).text();
  expect(returns).toContain("Return eligibility depends on the item");
  expect(returns).toContain('href="mailto:returns@fieldio.shop"');

  const contact = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/contact"))).text();
  expect(contact).toContain('href="mailto:hello@fieldio.shop"');
  expect(contact).toContain('href="mailto:orders@fieldio.shop"');
  expect(contact).toContain('href="mailto:support@fieldio.shop"');
  expect(contact).toContain('href="mailto:returns@fieldio.shop"');

  const women = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/collections/women"))).text();
  expect(women).toContain('href="/collections/women?category=footwear"');
  expect(women).toContain('<meta name="robots" content="index,follow">');

  const shoes = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/collections/shoes"))).text();
  expect(shoes).toContain("Designer Shoes | Fieldio");
  expect(shoes).toContain('href="/collections/shoes?category=loafers"');

  const account = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/account"))).text();
  expect(account).toContain('<meta name="robots" content="noindex,nofollow">');
  expect(account).toContain("Your account | Fieldio");
  expect(account).toContain("Loading Fieldio");

  const missing = await renderPage(new Request("https://fieldio.shop/api/render?path=/not-a-real-page"));
  expect(missing.status).toBe(404);
  expect(await missing.text()).toContain('<meta name="robots" content="noindex,nofollow">');

  const sitemapResponse = await renderSitemap(new Request("https://fieldio.shop/api/sitemap"));
  const sitemap = await sitemapResponse.text();
  expect(sitemapResponse.headers.get("content-type")).toContain("application/xml");
  expect(sitemap).toContain("https://fieldio.shop/collections/men");
  expect(sitemap).toContain("https://fieldio.shop/collections/shoes");
  expect(sitemap).toContain("https://fieldio.shop/promise");
  expect(sitemap).toContain("https://fieldio.shop/how-it-works");
  expect(sitemap).not.toContain("/account");
  expect(sitemap).not.toContain("/collections/bags");
});

it("escapes public product content before placing it in server HTML", () => {
  const html = productBody({ slug: "example", sku: "sku", name: '<script>alert("x")</script>', short_description: "A piece", description: "<b>Untrusted</b>", price: 12500, currency: "GBP" });
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<b>Untrusted</b>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("£125.00");
});

it("gives every static public route its own crawlable metadata and server content", async () => {
  for (const [path, [title]] of Object.entries(publicPages)) {
    const response = await renderPage(new Request(`https://fieldio.shop/api/render?path=${encodeURIComponent(path)}`));
    const html = await response.text();
    expect(response.status, path).toBe(200);
    expect(html, path).toContain(`<title>${title.replaceAll("&", "&amp;")}</title>`);
    expect(html, path).toContain(`<link rel="canonical" href="https://fieldio.shop${path}">`);
    expect(html, path).toContain('<meta name="robots" content="index,follow">');
    expect(html, path).toContain('class="server-public"');
  }
});

it("renders a published product's details in the initial response", async () => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  const product = { slug: "sample-piece", name: "Sample Piece", sku: "SAMPLE-1", seo_title: null, seo_description: null, short_description: "A considered piece.", description: "Full product description before JavaScript.", price: 12500, currency: "GBP", materials: "Cotton", care_information: "Gentle wash", inquiry_only: false, seller_store_name: null, seller_store_slug: null, seller_verified: false, average_rating: 0, rating_count: 0, brand: { name: "Fieldio" }, category: { name: "Clothing" }, images: [{ public_url: "/images/sample.webp", storage_path: "", alt_text: "Sample piece", position: 0 }] };
  const query = { select: () => query, eq: () => query, lte: () => query, maybeSingle: async () => ({ data: product, error: null }) };
  vi.mocked(createClient).mockReturnValueOnce({ from: () => query } as unknown as ReturnType<typeof createClient>);
  try {
    const response = await renderPage(new Request("https://fieldio.shop/api/render?path=/products/sample-piece"));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Full product description before JavaScript.");
    expect(html).toContain("Cotton");
    expect(html).toContain("£125.00");
    expect(html).toContain('<link rel="canonical" href="https://fieldio.shop/products/sample-piece">');
  } finally {
    vi.unstubAllEnvs();
  }
});
