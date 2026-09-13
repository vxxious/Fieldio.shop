import { escapeMarkup, publicClient, publicPages, siteOrigin } from "./_lib/public-catalog.js";

export async function GET() {
  try {
    const paths = new Map<string, string | undefined>(Object.keys(publicPages).map((path) => [path, undefined]));
    const db = publicClient();
    const now = new Date().toISOString();
    if (db) for (const table of ["products", "collections", "brands"] as const) {
      for (let page = 0; ; page++) {
        let query = db.from(table).select("slug,updated_at").order("slug").range(page * 500, page * 500 + 499);
        if (table === "products") query = query.eq("status", "active").lte("published_at", now);
        else if (table === "collections") query = query.eq("is_active", true).lte("published_at", now);
        else query = query.eq("is_active", true);
        const { data, error } = await query;
        if (error) throw error;
        data.forEach(({ slug, updated_at }) => paths.set(`/${table}/${slug}`, updated_at));
        if (data.length < 500) break;
      }
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...paths].map(([path, lastmod]) => `  <url><loc>${escapeMarkup(siteOrigin() + path)}</loc>${lastmod ? `<lastmod>${escapeMarkup(lastmod)}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>`;
    return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300" } });
  } catch { return new Response("Sitemap temporarily unavailable", { status: 503 }); }
}
