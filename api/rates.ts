import { json } from "./_lib/server.js";

interface RateRow { quote: string; rate: number }

export async function GET(request: Request): Promise<Response> {
  const base = new URL(request.url).searchParams.get("base")?.toUpperCase() || "GBP";
  if (!/^[A-Z]{3}$/.test(base)) return json({ error: "Invalid base currency." }, 400);
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rates?base=${base}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Rate provider returned ${response.status}`);
    const rows = await response.json() as RateRow[];
    const rates = Object.fromEntries(rows.filter((row) => /^[A-Z]{3}$/i.test(row.quote) && Number.isFinite(row.rate) && row.rate > 0).map((row) => [row.quote.toUpperCase(), row.rate]));
    return Response.json({ base, rates }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return json({ error: "Currency conversion is temporarily unavailable." }, 503);
  }
}
