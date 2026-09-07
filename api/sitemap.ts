import { escapeMarkup, publicClient, publicPages, siteOrigin } from "./_lib/public-catalog";

export async function GET() {
  try {
    const paths = new Set(Object.keys(publicPages));
    const db = publicClient();
    if (db) for (const table of ["products", "collections", "brands"] as const) {
      for (let page = 0; ; page++) {
        const { data, error } = await db.from(table).select("slug").order("slug").range(page * 500, page * 500 + 499);
        if (error) throw error;
        data.forEach(({ slug }) => paths.add(`/${table}/${slug}`));
        if (data.length < 500) break;
      }
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...paths].map((path) => `<url><loc>${escapeMarkup(siteOrigin() + path)}</loc></url>`).join("")}</urlset>`;
    return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, s-maxage=300" } });
  } catch { return new Response("Sitemap temporarily unavailable", { status: 503 }); }
}
