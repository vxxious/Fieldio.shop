import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createHmac } from "node:crypto";

const requests = new Map<string, { count: number; resetAt: number }>();

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function checkRateLimit(request: Request, limit = 8, windowMs = 60_000): Promise<boolean> {
  const key = `${new URL(request.url).pathname}:${getClientIp(request)}`;
  const database = getAdminSupabase();
  if (database) {
    const digest = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(key).digest("hex");
    const { data, error } = await database.rpc("consume_rate_limit", { p_key: digest, p_limit: limit, p_window_seconds: Math.ceil(windowMs / 1000) });
    return !error && data === true;
  }
  const now = Date.now();
  if (requests.size > 10000) for (const [entryKey, entry] of requests) if (entry.resetAt <= now) requests.delete(entryKey);
  if (requests.size > 10000 && !requests.has(key)) return false;
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function readValidatedJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error("INVALID_CONTENT_TYPE");
  const text = await request.text();
  if (text.length > 32768) throw new Error("BODY_TOO_LARGE");
  const body: unknown = JSON.parse(text);
  return schema.parse(body);
}

export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function handleApiError(error: unknown): Response {
  if (error instanceof SyntaxError) return json({ error: "Invalid JSON body." }, 400);
  if (error instanceof Error && error.message === "BODY_TOO_LARGE") return json({ error: "The request is too large." }, 413);
  if (error instanceof z.ZodError) return json({ error: "Check the submitted information.", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, 400);
  if (error instanceof Error && error.message === "INVALID_CONTENT_TYPE") return json({ error: "Content-Type must be application/json." }, 415);
  console.error("Fieldio API request failed", error instanceof Error ? error.name : "DatabaseError");
  return json({ error: "The request could not be completed. Please try again or contact Fieldio on WhatsApp." }, 500);
}
