import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { z } from "zod";
import { createHmac } from "node:crypto";

const requests = new Map<string, { count: number; resetAt: number }>();
const controlCharacters = /\p{Cc}/gu;

function sanitizeJsonInput(value: unknown): unknown {
  if (typeof value === "string") return value.replace(controlCharacters, (character) => "\t\n\r".includes(character) ? character : "");
  if (Array.isArray(value)) return value.map(sanitizeJsonInput);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeJsonInput(item)]));
  return value;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function checkRateLimit(request: Request, limit = 8, windowMs = 60_000): Promise<boolean> {
  const key = `${new URL(request.url).pathname}:${getClientIp(request)}`;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const database = getAdminSupabase();
  if (database && secret) {
    const digest = createHmac("sha256", secret).update(key).digest("hex");
    const { data, error } = await database.rpc("consume_rate_limit", { p_key: digest, p_limit: limit, p_window_seconds: Math.ceil(windowMs / 1000) });
    if (error) console.error("Fieldio rate-limit RPC failed", { code: error.code, secretFormatValid: secret.startsWith("sb_secret_") });
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
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new Error("CROSS_SITE_REQUEST");
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error("INVALID_CONTENT_TYPE");
  const text = await request.text();
  if (text.length > 32768) throw new Error("BODY_TOO_LARGE");
  const body = sanitizeJsonInput(JSON.parse(text));
  return schema.parse(body);
}

export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getAuthenticatedSupabase(request: Request): Promise<{ admin: SupabaseClient; client: SupabaseClient; user: User }> {
  const admin = getAdminSupabase();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!admin || !url || !key) throw new Error("SERVER_UNCONFIGURED");
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token || token.length > 8192) throw new Error("AUTH_REQUIRED");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return {
    admin,
    client: createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } }),
    user: data.user
  };
}

export function handleApiError(error: unknown): Response {
  if (error instanceof Error && error.message === "AUTH_REQUIRED") return json({ error: "Your session has expired. Sign in again." }, 401);
  if (error instanceof Error && error.message === "SERVER_UNCONFIGURED") return json({ error: "This service is temporarily unavailable." }, 503);
  if (error instanceof Error && error.message === "CROSS_SITE_REQUEST") return json({ error: "Cross-site requests are not allowed." }, 403);
  if (error instanceof SyntaxError) return json({ error: "Invalid JSON body." }, 400);
  if (error instanceof Error && error.message === "BODY_TOO_LARGE") return json({ error: "The request is too large." }, 413);
  if (error instanceof z.ZodError) return json({ error: "Check the submitted information.", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, 400);
  if (error instanceof Error && error.message === "INVALID_CONTENT_TYPE") return json({ error: "Content-Type must be application/json." }, 415);
  console.error("Fieldio API request failed", error instanceof Error ? error.name : "DatabaseError");
  return json({ error: "The request could not be completed. Please try again or contact Fieldio on WhatsApp." }, 500);
}
