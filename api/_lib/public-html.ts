import { contentPages } from "../../src/data/content-pages.js";
import { translate, type TranslationKey } from "../../src/lib/translations.js";
import { escapeMarkup } from "./public-catalog.js";

export interface PublicProduct {
  slug: string;
  name: string;
  short_description: string;
  description: string;
  price: number | null;
  currency: string;
  image?: string;
  imageAlt?: string;
  brand?: string;
}

const link = (href: string, label: string) => `<a href="${escapeMarkup(href)}">${escapeMarkup(label)}</a>`;
const paragraph = (value: string) => `<p>${escapeMarkup(value)}</p>`;

function productCards(products: PublicProduct[]) {
  if (!products.length) return `<p>No pieces in this edit yet. ${link("/personal-shopping", "Ask a personal shopper to source a piece")}</p>`;
  return `<section class="product-grid" aria-label="Products">${products.map((product) => {
    const href = `/products/${encodeURIComponent(product.slug)}`;
    const price = product.price === null ? "Price on request" : new Intl.NumberFormat("en-GB", { style: "currency", currency: product.currency }).format(product.price / 100);
    return `<article class="product-card"><div class="product-card-media">${product.image ? `<a href="${href}"><img src="${escapeMarkup(product.image)}" alt="${escapeMarkup(product.imageAlt || product.name)}" loading="lazy"></a>` : ""}</div><div class="product-card-info"><div><h3>${link(href, product.name)}</h3>${product.brand ? paragraph(product.brand) : ""}</div><p>${escapeMarkup(price)}</p></div></article>`;
  }).join("")}</section>`;
}

export function publicShell(heading: string, description: string, body: string) {
  const primary = [["/collections", "Shop"], ["/collections/new-arrivals", "New arrivals"], ["/brands", "Brands"]];
  const services = [["/personal-shopping", "Personal shopping"], ["/about", "About Fieldio"]];
  const footer = [["/contact", "Contact"], ["/shipping", "Shipping"], ["/returns", "Returns"], ["/privacy", "Privacy"], ["/terms", "Terms"]];
  return `<div id="root"><div class="server-public"><header class="site-header"><nav class="desktop-nav" aria-label="Primary">${primary.map(([href, label]) => link(href!, label!)).join("")}</nav><a href="/" class="fieldio-wordmark" aria-label="Fieldio home"><img class="fieldio-monogram" src="/brand/fieldio-monogram.webp" width="34" height="44" alt=""><span>Fieldio</span></a><nav class="header-actions" aria-label="Services">${services.map(([href, label]) => link(href!, label!)).join("")}</nav></header><main><article class="content-page"><header><h1>${escapeMarkup(heading)}</h1>${paragraph(description)}</header>${body}</article></main><footer><div class="site-footer"><div class="footer-brand">${link("/", "Fieldio")}${paragraph("Worldwide sourcing and shipment.")}</div><nav class="footer-links" aria-label="Information">${footer.map(([href, label]) => link(href!, label!)).join(" ")}</nav></div></footer></div></div>`;
}

export function contentBody(pathname: string) {
  const page = contentPages[pathname];
  if (!page) return "";
  const sections = page.sections.map(([title, body]) => `<section><h2>${escapeMarkup(title)}</h2>${paragraph(body)}</section>`).join("");
  const contact = pathname === "/returns" ? link("mailto:returns@fieldio.shop", "Email returns@fieldio.shop") : link("/contact", "Contact Fieldio");
  return `${page.updated ? `<time datetime="${page.updated.dateTime}">${escapeMarkup(page.updated.label)}</time>` : ""}<div class="content-sections">${sections}</div>${page.updated ? paragraph("This launch-stage policy copy should be reviewed by Fieldio’s legal adviser before a final effective date is published.") : ""}${contact}`;
}

export function homeBody(products: PublicProduct[]) {
  return `<section><h2>The Fieldio Edit</h2>${paragraph("An independent marketplace for designer fashion and personal sourcing, delivered worldwide.")}${link("/collections", "Explore the edit")}</section><section><h2>Featured products</h2>${productCards(products)}</section><section><h2>A worldwide luxury desk</h2>${paragraph("From a specific Louis Vuitton piece to a hard-to-find runway size, Fieldio makes the search personal. Send the reference; we return with availability, condition, final price, and shipping options.")}${link("/brands", "Explore designer brands")}</section><section><h2>Your personal shopper, wherever you are.</h2>${paragraph("Share a product link, screenshot, name, or brief. Fieldio sources across luxury, sportswear, accessories, and everyday fashion, then coordinates worldwide delivery.")}${link("/how-it-works", "How Fieldio works")}</section><section><h2>Sell with Fieldio</h2>${paragraph("Independent boutiques, collectors, and trusted vendors can submit authentic fashion for review.")}${link("/sell", "Create a seller account")}</section>`;
}

export function collectionBody(pathname: string, products: PublicProduct[]) {
  const slug = pathname.split("/")[2];
  const categoryLinks = slug === "men" || slug === "women" ? ["sale", "new-in", "tops", "bottoms", "outerwear", "accessories", "footwear", "all"].map((category) => link(`${pathname}?category=${category}`, category.replaceAll("-", " "))) : [];
  const directoryLinks: Record<string, string[]> = { shoes: ["sneakers", "boots", "pumps", "loafers", "ballet-flats", "sandals"], accessories: ["sunglasses", "belts", "scarves", "jewellery"], jewellery: ["bracelets", "earrings", "necklaces", "rings", "watches"] };
  const directory = directoryLinks[slug || ""]?.map((category) => link(`${pathname}?category=${category}`, category.replaceAll("-", " "))) || [];
  if (categoryLinks.length || directory.length) return `<nav aria-label="Categories">${[...categoryLinks, ...directory].join(" ")}</nav>${link("/brands", "Browse brands")}`;
  return `<section><h2>Browse the edit</h2>${productCards(products)}</section>${link("/personal-shopping", "Ask a personal shopper")}`;
}

export function brandDirectoryBody(brands: Array<{ name: string; slug: string }>) {
  return `<section><h2>Browse brands</h2><nav aria-label="Designer brands">${brands.map(({ name, slug }) => link(`/brands/${encodeURIComponent(slug)}`, name)).join(" ")}</nav></section>${link("/personal-shopping", "Request a piece not listed")}`;
}

export function brandBody(brandName: string, products: PublicProduct[]) {
  return `<section><h2>${escapeMarkup(brandName)} pieces</h2>${productCards(products)}</section>${link("/personal-shopping", `Ask Fieldio to source ${brandName}`)}`;
}

export function storeBody(storeName: string, products: PublicProduct[]) {
  return `<section><h2>Approved listings from ${escapeMarkup(storeName)}</h2>${productCards(products)}</section>${paragraph("Identity and listings reviewed by Fieldio. Ask for any additional product evidence you need before payment.")}${link("/promise", "Fieldio Promise")}`;
}

export function productBody(product: PublicProduct & { sku: string; materials?: string | null; care?: string | null; seller?: string | null; sellerSlug?: string | null; inquiryOnly?: boolean }) {
  return `<section class="server-product">${product.image ? `<img src="${escapeMarkup(product.image)}" alt="${escapeMarkup(product.imageAlt || product.name)}" width="600" loading="eager">` : ""}<div>${product.brand ? paragraph(product.brand) : ""}<p>${product.price === null ? "Price on request" : escapeMarkup(new Intl.NumberFormat("en-GB", { style: "currency", currency: product.currency }).format(product.price / 100))}</p>${paragraph(product.short_description)}${product.inquiryOnly ? paragraph("Sourced on request. Fieldio confirms the final price, condition and availability before payment.") : ""}<h2>Description</h2>${paragraph(product.description)}${product.materials ? `<h2>Materials</h2>${paragraph(product.materials)}` : ""}${product.care ? `<h2>Care</h2>${paragraph(product.care)}` : ""}${product.seller && product.sellerSlug ? `<h2>Seller</h2>${link(`/stores/${encodeURIComponent(product.sellerSlug)}`, product.seller)}` : ""}${paragraph("Availability, delivery and return terms are confirmed before payment.")}${link("/contact", `Enquire about ${product.name}`)}</div></section>`;
}

const servicePages: Record<string, { title: TranslationKey; intro: TranslationKey; points: TranslationKey[] }> = {
  "/personal-shopping": { title: "service.personalTitle", intro: "service.personalIntro", points: ["service.personalPoint1", "service.personalPoint2", "service.personalPoint3", "service.personalPoint4"] },
  "/wholesale": { title: "service.wholesaleTitle", intro: "service.wholesaleIntro", points: ["service.wholesalePoint1", "service.wholesalePoint2", "service.wholesalePoint3", "service.wholesalePoint4"] },
  "/contact": { title: "service.contactTitle", intro: "service.contactIntro", points: ["service.contactPoint1", "service.contactPoint2", "service.contactPoint4", "service.contactReturns"] }
};

export function serviceContent(pathname: string) {
  const page = servicePages[pathname];
  if (!page) return null;
  const emails: Partial<Record<TranslationKey, string>> = { "service.contactPoint1": "hello@fieldio.shop", "service.contactPoint2": "orders@fieldio.shop", "service.contactPoint4": "support@fieldio.shop", "service.contactReturns": "returns@fieldio.shop" };
  return {
    heading: translate("en", page.title),
    description: translate("en", page.intro),
    body: `<ul class="contact-channels">${page.points.map((point) => `<li><span>${escapeMarkup(translate("en", point))}</span>${emails[point] && pathname === "/contact" ? link(`mailto:${emails[point]}`, emails[point]) : ""}</li>`).join("")}</ul>${link("/how-it-works", "How Fieldio works")}`
  };
}

export function sellerBody() {
  return `${paragraph("Create an account or sign in before applying. Every seller and vendor is verified before products can be listed.")}${link("/account?mode=signup&returnTo=%2Fsell", "Create seller account")} ${link("/account?returnTo=%2Fsell", "Already have an account? Sign in")}`;
}
