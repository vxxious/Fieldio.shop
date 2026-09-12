import { json } from "./_lib/server.js";

export function GET(request: Request): Response {
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  const language = request.headers.get("accept-language")?.split(",")[0]?.trim();
  return json({ ...(country ? { country } : {}), ...(language ? { language } : {}) });
}
