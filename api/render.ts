import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { escapeMarkup, publicClient, publicPages, siteOrigin } from "./_lib/public-catalog.js";

export async function GET(request: Request) {
  const pathname = new URL(request.url).searchParams.get("path") || "/";
  const origin = siteOrigin();
  let [title, description] = publicPages[pathname] || ["Fieldio", "Everything fashion. Worldwide shipment."];
  let image = `${origin}/og-image.jpg`;
  let status = 200;
  let pageType = "website";
  const organization = { "@type": "Organization", "@id": `${origin}/#organization`, name: "Fieldio", url: origin, logo: `${origin}/brand/fieldio-icon-512.png`, description: publicPages["/"]![1], sameAs: ["https://www.instagram.com/fieldio_wrd/"] };
  let structured: Record<string, unknown> = pathname === "/" ? { "@context": "https://schema.org", "@graph": [organization, { "@type": "WebSite", "@id": `${origin}/#website`, url: origin, name: "Fieldio", alternateName: "Fieldio Shop", publisher: { "@id": `${origin}/#organization` } }] } : { "@context": "https://schema.org", ...organization };
  try {
    const db = publicClient();
    const match = /^\/(products|collections|brands)\/([a-z0-9-]+)$/.exec(pathname);
    if (match?.[1] === "products") {
      const result = db ? await db.from("products").select("name,sku,seo_title,seo_description,short_description,description,price,currency,brand:brands(name),images:product_images(public_url,storage_path,alt_text,position)").eq("slug", match[2]!).eq("status", "active").lte("published_at", new Date().toISOString()).maybeSingle() : null;
      if (result?.error) throw result.error;
      if (!result?.data) { status = 404; title = "Piece not found | Fieldio"; }
      else {
        const product = result.data;
        title = product.seo_title || `${product.name} | Fieldio`;
        description = product.seo_description || product.short_description;
        const firstImage = [...product.images].sort((a,b) => a.position - b.position)[0];
        const productBrand = Array.isArray(product.brand) ? product.brand[0]?.name : (product.brand as { name?: string } | null)?.name;
        if (firstImage) image = firstImage.public_url || db!.storage.from("product-images").getPublicUrl(firstImage.storage_path).data.publicUrl;
        pageType = "product";
        structured = { "@context": "https://schema.org", "@type": "Product", name: product.name, sku: product.sku, description: product.description, image, url: `${origin}${pathname}`, ...(productBrand ? { brand: { "@type": "Brand", name: productBrand } } : {}) };
      }
    } else if (match?.[1] === "collections") {
      const result = db ? await db.from("collections").select("name,intro,seo_title,seo_description,hero_image_url").eq("slug", match[2]!).maybeSingle() : null;
      if (result?.error) throw result.error;
      if (result?.data) { title = result.data.seo_title || `${result.data.name} | Fieldio`; description = result.data.seo_description || result.data.intro || description; image = result.data.hero_image_url || image; }
      structured = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: `${origin}${pathname}` };
    } else if (match?.[1] === "brands") {
      const result = db ? await db.from("brands").select("name,description").eq("slug", match[2]!).eq("is_active", true).maybeSingle() : null;
      if (result?.error) throw result.error;
      const name = result?.data?.name || match[2]!.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      title = `${name} sourcing | Fieldio`; description = result?.data?.description || `Request ${name} pieces through Fieldio personal shopping and worldwide delivery support.`;
      structured = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: `${origin}${pathname}` };
    }
    const privateRoute = /^\/(account|admin|checkout|wishlist|search)(\/|$)/.test(pathname);
    if (!publicPages[pathname] && !match && !privateRoute) status = 404;
    const canonical = `${origin}${pathname}`;
    const socialAlt = `${title}. ${description}`;
    const imageDimensions = image.endsWith("/og-image.jpg") ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/jpeg">' : "";
    const head = `<title>${escapeMarkup(title)}</title><meta name="description" content="${escapeMarkup(description)}"><link rel="canonical" href="${escapeMarkup(canonical)}"><meta property="og:title" content="${escapeMarkup(title)}"><meta property="og:description" content="${escapeMarkup(description)}"><meta property="og:type" content="${pageType}"><meta property="og:site_name" content="Fieldio"><meta property="og:url" content="${escapeMarkup(canonical)}"><meta property="og:image" content="${escapeMarkup(image)}">${imageDimensions}<meta property="og:image:alt" content="${escapeMarkup(socialAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeMarkup(title)}"><meta name="twitter:description" content="${escapeMarkup(description)}"><meta name="twitter:image" content="${escapeMarkup(image)}"><meta name="twitter:image:alt" content="${escapeMarkup(socialAlt)}"><meta name="robots" content="${privateRoute || status === 404 ? "noindex,nofollow" : "index,follow"}"><script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script>`;
    const template = await readFile(join(process.cwd(), "dist", "index.html"), "utf8");
    const html = template.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta\s+(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, "").replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "").replace(/<script id=["']fieldio-identity["'][\s\S]*?<\/script>/i, "").replace("</head>", `${head}</head>`);
    return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": privateRoute ? "no-store" : "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch { return new Response("Fieldio is temporarily unavailable. Please try again shortly.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
