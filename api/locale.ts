import { checkRateLimit, json } from "./_lib/server.js";

export async function GET(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 120)) return json({ error: "Requests are temporarily limited." }, 429);
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  const language = request.headers.get("accept-language")?.split(",")[0]?.trim();
  return json({ ...(country ? { country } : {}), ...(language ? { language } : {}) });
}
