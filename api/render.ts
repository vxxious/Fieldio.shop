import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { escapeMarkup, publicClient, publicPages, siteOrigin } from "./_lib/public-catalog.js";
import { checkRateLimit } from "./_lib/server.js";
import { captureServerException } from "./_lib/monitoring.js";

const crawlLinks = [["/collections", "Shop"], ["/collections/new-arrivals", "New arrivals"], ["/brands", "Brands"], ["/personal-shopping", "Personal shopping"], ["/about", "About Fieldio"]] as const;

function crawlableShell(title: string, description: string) {
  return `<div id="root"><header class="site-header"><nav class="desktop-nav" aria-label="Primary">${crawlLinks.slice(0, 3).map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}</nav><a href="/" class="fieldio-wordmark" aria-label="Fieldio home"><img class="fieldio-monogram" src="/brand/fieldio-monogram.webp" width="34" height="44" alt=""><span>Fieldio</span></a><nav class="header-actions" aria-label="Services">${crawlLinks.slice(3).map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}</nav></header><main><article class="content-page"><header><h1>${escapeMarkup(title)}</h1><p>${escapeMarkup(description)}</p></header><a class="text-link" href="/how-it-works">How Fieldio works</a></article></main></div>`;
}

export async function GET(request: Request) {
  if (!await checkRateLimit(request, 120)) return new Response("Requests are temporarily limited.", { status: 429 });
  const pathname = new URL(request.url).searchParams.get("path") || "/";
  const origin = siteOrigin();
  let [title, description] = publicPages[pathname] || ["Fieldio", "Everything fashion. Worldwide shipment."];
  let image = `${origin}/og-image.jpg`;
  let status = 200;
  let pageType = "website";
  let heading = title.split(" | ")[0]!;
  const organization = { "@type": "OnlineStore", "@id": `${origin}/#organization`, name: "Fieldio", alternateName: "Fieldio Shop", url: `${origin}/`, logo: `${origin}/brand/fieldio-icon-512.png`, description: publicPages["/"]![1], sameAs: ["https://www.instagram.com/fieldio_wrd/"] };
  const website = { "@type": "WebSite", "@id": `${origin}/#website`, url: `${origin}/`, name: "Fieldio", alternateName: "Fieldio Shop", publisher: { "@id": `${origin}/#organization` } };
  let pageSchema: Record<string, unknown> = { "@type": pathname === "/about" ? "AboutPage" : "WebPage", "@id": `${origin}${pathname}#webpage`, url: `${origin}${pathname}`, name: title, description, isPartOf: { "@id": `${origin}/#website` }, about: { "@id": `${origin}/#organization` } };
  try {
    const db = publicClient();
    const match = /^\/(products|collections|brands|stores)\/([a-z0-9-]+)$/.exec(pathname);
    if (match?.[1] === "products") {
      const result = db ? await db.from("products").select("name,sku,seo_title,seo_description,short_description,description,price,currency,average_rating,rating_count,brand:brands(name),category:categories(name),images:product_images(public_url,storage_path,alt_text,position)").eq("slug", match[2]!).eq("status", "active").lte("published_at", new Date().toISOString()).maybeSingle() : null;
      if (result?.error) throw result.error;
      if (!result?.data) { status = 404; title = "Piece not found | Fieldio"; heading = "Piece not found"; description = "This item may have moved or left the Fieldio edit."; }
      else {
        const product = result.data;
        title = product.seo_title || `${product.name} | Fieldio`;
        heading = product.name;
        description = product.seo_description || product.short_description || product.description;
        const firstImage = [...product.images].sort((a,b) => a.position - b.position)[0];
        const productBrand = Array.isArray(product.brand) ? product.brand[0]?.name : (product.brand as { name?: string } | null)?.name;
        const productCategory = Array.isArray(product.category) ? product.category[0]?.name : (product.category as { name?: string } | null)?.name;
        if (firstImage) image = firstImage.public_url || db!.storage.from("product-images").getPublicUrl(firstImage.storage_path).data.publicUrl;
        pageType = "product";
        pageSchema = { "@type": "Product", "@id": `${origin}${pathname}#product`, name: product.name, sku: product.sku, description: product.description, image: product.images.map((item) => item.public_url || db!.storage.from("product-images").getPublicUrl(item.storage_path).data.publicUrl), url: `${origin}${pathname}`, ...(productBrand ? { brand: { "@type": "Brand", name: productBrand } } : {}), ...(productCategory ? { category: productCategory } : {}), ...(product.rating_count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(product.average_rating), reviewCount: product.rating_count, bestRating: 5, worstRating: 1 } } : {}) };
      }
    } else if (match?.[1] === "collections") {
      const result = db ? await db.from("collections").select("name,intro,seo_title,seo_description,hero_image_url").eq("slug", match[2]!).maybeSingle() : null;
      if (result?.error) throw result.error;
      if (result?.data) { title = result.data.seo_title || `${result.data.name} | Fieldio`; description = result.data.seo_description || result.data.intro || description; image = result.data.hero_image_url || image; }
      heading = title.split(" | ")[0]!;
      pageSchema = { "@type": "CollectionPage", "@id": `${origin}${pathname}#webpage`, name: title, description, url: `${origin}${pathname}`, isPartOf: { "@id": `${origin}/#website` } };
    } else if (match?.[1] === "brands") {
      const result = db ? await db.from("brands").select("name,description").eq("slug", match[2]!).eq("is_active", true).maybeSingle() : null;
      if (result?.error) throw result.error;
      const name = result?.data?.name || match[2]!.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      title = `${name} sourcing | Fieldio`; description = result?.data?.description || `Request ${name} pieces through Fieldio personal shopping and worldwide delivery support.`;
      heading = name;
      pageSchema = { "@type": "CollectionPage", "@id": `${origin}${pathname}#webpage`, name: title, description, url: `${origin}${pathname}`, isPartOf: { "@id": `${origin}/#website` } };
    } else if (match?.[1] === "stores") {
      const result = db ? await db.from("products").select("seller_store_name,seller_country_code").eq("seller_store_slug", match[2]!).eq("seller_verified", true).eq("status", "active").limit(1).maybeSingle() : null;
      if (result?.error) throw result.error;
      if (!result?.data) { status = 404; title = "Seller store not found | Fieldio"; heading = "Seller store not found"; description = "This seller store is not currently available on Fieldio."; }
      else {
        title = `${result.data.seller_store_name} | Verified Fieldio seller`;
        heading = result.data.seller_store_name;
        description = `Shop approved listings from ${result.data.seller_store_name} on Fieldio${result.data.seller_country_code ? `, based in ${result.data.seller_country_code}` : ""}.`;
        pageSchema = { "@type": "CollectionPage", "@id": `${origin}${pathname}#webpage`, name: title, description, url: `${origin}${pathname}`, isPartOf: { "@id": `${origin}/#website` } };
      }
    }
    const privateRoute = /^\/(account|admin|checkout|wishlist|search)(\/|$)/.test(pathname);
    if (!publicPages[pathname] && !match && !privateRoute) { status = 404; title = "Page not found | Fieldio"; heading = "Page not found"; description = "The page you requested is not available on Fieldio."; }
    const canonical = `${origin}${pathname}`;
    if (status === 404) pageSchema = { "@type": "WebPage", "@id": `${canonical}#webpage`, name: title, description, url: canonical, isPartOf: { "@id": `${origin}/#website` } };
    else if (!match && publicPages[pathname]) pageSchema = { ...pageSchema, name: title, description, url: canonical, "@id": `${canonical}#webpage` };
    const breadcrumb = pathname === "/" ? null : { "@type": "BreadcrumbList", "@id": `${canonical}#breadcrumb`, itemListElement: [{ "@type": "ListItem", position: 1, name: "Fieldio", item: `${origin}/` }, { "@type": "ListItem", position: 2, name: heading, item: canonical }] };
    const structured = { "@context": "https://schema.org", "@graph": [organization, website, pageSchema, ...(breadcrumb ? [breadcrumb] : [])] };
    const socialAlt = `${title}. ${description}`;
    const imageDimensions = image.endsWith("/og-image.jpg") ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/jpeg">' : "";
    const head = `<title>${escapeMarkup(title)}</title><meta name="description" content="${escapeMarkup(description)}"><link rel="canonical" href="${escapeMarkup(canonical)}"><meta property="og:title" content="${escapeMarkup(title)}"><meta property="og:description" content="${escapeMarkup(description)}"><meta property="og:type" content="${pageType}"><meta property="og:site_name" content="Fieldio"><meta property="og:url" content="${escapeMarkup(canonical)}"><meta property="og:image" content="${escapeMarkup(image)}">${imageDimensions}<meta property="og:image:alt" content="${escapeMarkup(socialAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeMarkup(title)}"><meta name="twitter:description" content="${escapeMarkup(description)}"><meta name="twitter:image" content="${escapeMarkup(image)}"><meta name="twitter:image:alt" content="${escapeMarkup(socialAlt)}"><meta name="robots" content="${privateRoute || status === 404 ? "noindex,nofollow" : "index,follow"}"><script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script>`;
    const template = await readFile(join(process.cwd(), "dist", "index.html"), "utf8");
    const loader = '<div id="root"><div class="route-loading app-boot-loader" role="status"><span>Loading Fieldio</span></div></div>';
    const html = template.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta\s+(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, "").replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "").replace(/<script id=["']fieldio-identity["'][\s\S]*?<\/script>/i, "").replace("</head>", `${head}</head>`).replace(loader, privateRoute ? loader : crawlableShell(heading, description));
    return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": privateRoute ? "no-store" : "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    captureServerException(error);
    return new Response("Fieldio is temporarily unavailable. Please try again shortly.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
