import { checkRateLimit, json } from "./_lib/server.js";
import { captureServerException } from "./_lib/monitoring.js";

interface RateRow { quote: string; rate: number }

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "rates") {
    if (!await checkRateLimit(request, 30)) return json({ error: "Requests are temporarily limited." }, 429);
    const base = url.searchParams.get("base")?.toUpperCase() || "GBP";
    if (!/^[A-Z]{3}$/.test(base)) return json({ error: "Invalid base currency." }, 400);
    try {
      const response = await fetch(`https://api.frankfurter.dev/v2/rates?base=${base}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Rate provider returned ${response.status}`);
      const rows = await response.json() as RateRow[];
      const rates = Object.fromEntries(rows.filter((row) => /^[A-Z]{3}$/i.test(row.quote) && Number.isFinite(row.rate) && row.rate > 0).map((row) => [row.quote.toUpperCase(), row.rate]));
      return Response.json({ base, rates }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } });
    } catch (error) {
      captureServerException(error);
      return json({ error: "Currency conversion is temporarily unavailable." }, 503);
    }
  }

  if (!await checkRateLimit(request, 120)) return json({ error: "Requests are temporarily limited." }, 429);
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  const language = request.headers.get("accept-language")?.split(",")[0]?.trim();
  return json({ ...(country ? { country } : {}), ...(language ? { language } : {}) });
}
