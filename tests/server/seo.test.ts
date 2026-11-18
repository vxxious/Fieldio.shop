import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => null) }));
vi.mock("../../api/_lib/server", async () => ({
  ...await vi.importActual<typeof import("../../api/_lib/server")>("../../api/_lib/server"),
  checkRateLimit: vi.fn(async () => true)
}));
vi.mock("node:fs/promises", async () => ({
  ...await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises"),
  readFile: async () => '<!doctype html><html><head><title>Fallback</title><script type="module" src="/assets/app.js"></script></head><body><div id="root"><main><h1>Fieldio Shop</h1></main></div></body></html>'
}));

import { GET as renderPage } from "../../api/render";
import { GET as renderSitemap } from "../../api/sitemap";
import { collectionBody, homeBody, productBody } from "../../api/_lib/public-html";
import { discoveryEmpty } from "../../src/lib/discovery-empty";
import { escapeMarkup, publicPages } from "../../api/_lib/public-catalog";
import { brandSeo } from "../../src/lib/brand-seo";

const seededBrands = [...readFileSync("supabase/migrations/202611160001_public_brand_catalogue.sql", "utf8")
  .matchAll(/^\s*\('((?:''|[^'])+)', '([a-z0-9-]+)'/gm)]
  .map(([, name, slug]) => [name!.replaceAll("''", "'"), slug!] as const);
const approvedBrands = [
  ["Dior", "dior"], ["Gucci", "gucci"], ["Louis Vuitton", "louis-vuitton"],
  ["Prada", "prada"], ["Yves Saint Laurent", "yves-saint-laurent"], ["Zara", "zara"],
  ...seededBrands
] as const;

it("serves and indexes all approved brands but keeps a seller store out of the brand catalogue", async () => {
  expect(seededBrands).toHaveLength(190);
  expect(new Set(approvedBrands.map(([, slug]) => slug)).size).toBe(approvedBrands.length);
  expect(approvedBrands).toContainEqual(["Celine", "celine"]);
  expect(approvedBrands).toContainEqual(["Maison Margiela", "maison-margiela"]);
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  const brands = approvedBrands.map(([name, slug]) => ({ id: slug, name, slug, description: slug === "maison-margiela" ? "Explore Maison Margiela on Fieldio. Browse available pieces when listed, or ask for sourcing assistance." : ["dior", "gucci", "louis-vuitton", "prada", "yves-saint-laurent"].includes(slug) ? "Fieldio personal sourcing selection." : null, seo_title: null, seo_description: null, updated_at: "2026-11-16T00:00:00Z", is_active: true, is_catalogued: true }));
  brands.push({ id: "seller", name: "VXXIOUS Store", slug: "vxxious-store-2eeafa", description: null, seo_title: null, seo_description: null, updated_at: "2026-11-16T00:00:00Z", is_active: true, is_catalogued: false });
  let productSlugs = ["available-piece"];
  const db = { from(table: string) {
    let selection = "";
    const filters: Record<string, unknown> = {};
    const query = {
      select(value: string) { selection = value; return query; },
      eq(key: string, value: unknown) { filters[key] = value; return query; },
      lte() { return query; }, not(key: string, operator: string, value: string) { if (key === "sku" && operator === "ilike" && value === "TEST-%") filters.excludeTestSkus = true; return query; }, order() { return query; }, limit() { return query; }, range() { return query; },
      async maybeSingle() { return { data: brands.find((item) => item.slug === filters.slug && item.is_active === filters.is_active && item.is_catalogued === filters.is_catalogued) ?? (table === "products" && filters.seller_store_slug ? { seller_store_name: "VXXIOUS Store", seller_country_code: "GB" } : null), error: null }; },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        const data = table === "brands" ? brands.filter((item) => item.is_active === filters.is_active && item.is_catalogued === filters.is_catalogued)
          : table === "products" && selection.includes("seller_store_slug") ? [{ seller_store_slug: "vxxious-store-2eeafa", updated_at: "2026-11-16T00:00:00Z" }]
          : table === "products" ? [...productSlugs, ...(!filters.excludeTestSkus ? ["test-piece"] : [])].map((slug) => ({ slug, updated_at: "2026-11-16T00:00:00Z" }))
          : table === "discovery_products" && filters.brand_id === "zara" && productSlugs.length ? [{ slug: "available-piece", name: "Available Zara piece", short_description: "A live piece.", description: "A live piece.", price: 10000, original_price: null, saving_percent: null, currency: "GBP", brand: { name: "Zara" }, images: [] }] : [];
        return Promise.resolve(resolve({ data, error: null }));
      }
    };
    return query;
  } };
  vi.mocked(createClient).mockReturnValue(db as unknown as ReturnType<typeof createClient>);
  try {
    const directory = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/brands"))).text();
    const descriptions = new Set<string>();
    for (const [name, slug] of approvedBrands) {
      const path = `/brands/${slug}`;
      const response = await renderPage(new Request(`https://fieldio.shop/api/render?path=${path}`));
      const html = await response.text();
      const meta = brandSeo(name, brands.find((brand) => brand.slug === slug)?.description);
      descriptions.add(meta.description);
      expect(response.status, path).toBe(200);
      expect(directory, path).toContain(`href="${path}"`);
      expect(html, path).toContain(`<title>${escapeMarkup(meta.title)}</title>`);
      expect(html, path).toContain(`<meta name="description" content="${escapeMarkup(meta.description)}">`);
      expect(html, path).toContain(`<link rel="canonical" href="https://fieldio.shop${path}">`);
      expect(html, path).toContain(`<h1>${escapeMarkup(name)}</h1>`);
      expect(html, path).toContain('"@type":"Brand"');
    }
    expect(descriptions.size).toBe(approvedBrands.length);
    expect(directory).not.toContain("VXXIOUS Store");
    expect(directory).not.toContain("/brands/vxxious-store-2eeafa");
    expect(await (await renderPage(new Request("https://fieldio.shop/api/render?path=/brands/zara"))).text()).toContain("Available Zara piece");
    const hidden = await renderPage(new Request("https://fieldio.shop/api/render?path=/brands/vxxious-store-2eeafa"));
    expect(hidden.status).toBe(404);
    expect(await hidden.text()).toContain('content="noindex,nofollow"');
    const store = await renderPage(new Request("https://fieldio.shop/api/render?path=/stores/vxxious-store-2eeafa"));
    expect(store.status).toBe(200);
    let sitemap = await (await renderSitemap(new Request("https://fieldio.shop/api/sitemap"))).text();
    expect(sitemap).toContain("https://fieldio.shop/brands/maison-margiela");
    expect(sitemap).not.toContain("/brands/vxxious-store-2eeafa");
    expect(sitemap).toContain("/stores/vxxious-store-2eeafa");
    expect(sitemap).toContain("/products/available-piece");
    expect(sitemap).not.toContain("/products/test-piece");
    brands.push({ id: "future", name: "Future Brand", slug: "future-brand", description: null, seo_title: null, seo_description: null, updated_at: "2026-11-16T00:00:00Z", is_active: true, is_catalogued: true });
    sitemap = await (await renderSitemap(new Request("https://fieldio.shop/api/sitemap"))).text();
    expect(sitemap).toContain("/brands/future-brand");
    brands.pop();
    productSlugs = [];
    sitemap = await (await renderSitemap(new Request("https://fieldio.shop/api/sitemap"))).text();
    expect(sitemap).not.toContain("/products/available-piece");
    expect(await (await renderPage(new Request("https://fieldio.shop/api/render?path=/brands/zara"))).text()).not.toContain("Available Zara piece");
  } finally {
    vi.mocked(createClient).mockReset();
    vi.unstubAllEnvs();
  }
});

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
  expect(home).toContain('<a href="/collections">Explore the edit</a>');
  expect(home).toContain("Explore the Fieldio edit");
  expect(home).toContain('href="/brands"');
  expect(home).toContain('href="/collections/new-arrivals"');
  expect(home).toContain("No current offers.");
  expect(home).not.toContain('href="/collections/sale"');
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
  const men = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/collections/men"))).text();
  expect(men).toContain('href="/collections/men?category=underwear"');

  const shoes = await (await renderPage(new Request("https://fieldio.shop/api/render?path=/collections/shoes"))).text();
  expect(shoes).toContain("Designer Shoes | Fieldio");
  expect(shoes).toContain('href="/collections/shoes?category=loafers"');

  const bags = await renderPage(new Request("https://fieldio.shop/api/render?path=/collections/bags"));
  expect(bags.status).toBe(200);
  expect(await bags.text()).toContain("Designer Bags | Fieldio");

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
  expect(sitemap).toContain("https://fieldio.shop/collections/sale");
  expect(sitemap).toContain("https://fieldio.shop/promise");
  expect(sitemap).toContain("https://fieldio.shop/how-it-works");
  expect(sitemap).not.toContain("/account");
  expect(sitemap).toContain("https://fieldio.shop/collections/bags");
});

it("escapes public product content before placing it in server HTML", () => {
  const html = productBody({ slug: "example", sku: "sku", name: '<script>alert("x")</script>', short_description: "A piece", description: "<b>Untrusted</b>", price: 12500, currency: "GBP" });
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<b>Untrusted</b>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("£125.00");
});

it("renders active offer prices in raw homepage and product HTML", () => {
  const product = { slug: "offer", sku: "OFFER", name: "Offer piece", short_description: "Current offer", description: "Current offer", price: 8000, originalPrice: 10000, savingPercent: 20, currency: "GBP" };
  expect(homeBody([], [], [product])).toContain("20% off");
  expect(homeBody([], [], [product])).toContain('href="/collections/sale"');
  expect(homeBody([], [product], [])).toContain('href="/collections/new-arrivals"');
  expect(productBody(product)).toContain("<s>");
});

it("serves responsive Zara images before client rendering", () => {
  const product = { slug: "zara-boxers", sku: "ZARA-BOXERS", name: "Zara Boxers", short_description: "Boxers", description: "Boxers", price: 2900, currency: "GBP", image: "https://fieldio.shop/images/brand-catalog/zara/zara-boxers-01.webp?v=20261016" };
  expect(homeBody([product], [], [])).toContain("zara-boxers-01-480.webp?v=20261016 480w");
  expect(productBody(product)).toContain("zara-boxers-01-960.webp?v=20261016 960w");
  expect(productBody(product)).toContain('fetchpriority="high"');
});

it("keeps empty New In and Sale copy and paths consistent in server HTML", () => {
  const home = homeBody([], [], []);
  for (const [kind, path] of [["new", "/collections/new-arrivals"], ["sale", "/collections/sale"]] as const) {
    const collection = collectionBody(path, []);
    expect(home).toContain(`${discoveryEmpty[kind].title} ${discoveryEmpty[kind].description}`);
    expect(collection).toContain(discoveryEmpty[kind].title);
    expect(collection).toContain(discoveryEmpty[kind].description);
    expect(collection).toContain('href="/collections"');
    expect(collection).toContain('href="/personal-shopping"');
    expect(home).not.toContain(`href="${path}"`);
  }
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
