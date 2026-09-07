import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function preferenceToken(id: string, action: "subscribe" | "unsubscribe") {
  const secret = process.env.NEWSLETTER_TOKEN_SECRET;
  if (!secret) throw new Error("NEWSLETTER_UNCONFIGURED");
  const payload = Buffer.from(JSON.stringify({ id, action, expires: action === "subscribe" ? Date.now() + 86400000 : null })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function readPreferenceToken(token: string) {
  const secret = process.env.NEWSLETTER_TOKEN_SECRET;
  if (!secret || token.length > 1000) throw new Error("INVALID_TOKEN");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("INVALID_TOKEN");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("INVALID_TOKEN");
  const result = z.object({ id: z.string().uuid(), action: z.enum(["subscribe", "unsubscribe"]), expires: z.number().nullable() }).parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
  if (result.expires !== null && result.expires < Date.now()) throw new Error("INVALID_TOKEN");
  return result;
}

export async function emailRequest(path: string, body: Record<string, unknown>, method = "POST") {
  const response = await fetch(`https://api.resend.com${path}`, { method, headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("EMAIL_PROVIDER_UNAVAILABLE");
}
