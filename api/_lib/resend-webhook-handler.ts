import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { checkRateLimit, getAdminSupabase, json } from "./server.js";

const eventSchema = z.object({
  type: z.enum(["email.sent", "email.delivered", "email.opened", "email.clicked", "email.bounced", "email.complained", "email.failed"]),
  data: z.object({ email_id: z.string().min(1).max(200) })
});

const statusByEvent = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed"
} as const;
const progress = ["pending", "sent", "delivered", "opened", "clicked"];

export function verifyResendWebhook(body: string, headers: Headers, now = Date.now()): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature")?.split(" ") ?? [];
  if (!secret?.startsWith("whsec_") || !id || !timestamp || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.some((signature) => {
    const value = signature.startsWith("v1,") ? signature.slice(3) : "";
    const received = Buffer.from(value, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 120, 60_000)) return json({ error: "Webhook requests are temporarily limited." }, 429);
  const body = await request.text();
  if (body.length > 65536 || !verifyResendWebhook(body, request.headers)) return json({ error: "Invalid webhook signature." }, 401);
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return json({ error: "Invalid webhook payload." }, 400); }
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return json({ received: true });
  const database = getAdminSupabase();
  if (!database) return json({ error: "Webhook storage is unavailable." }, 503);
  const { data: recipient, error } = await database.from("email_campaign_recipients").select("id,campaign_id,status").eq("provider_email_id", parsed.data.data.email_id).maybeSingle();
  if (error) return json({ error: "Webhook storage failed." }, 500);
  if (!recipient) return json({ received: true });
  const nextStatus = statusByEvent[parsed.data.type];
  if (["bounced", "complained", "failed", "unsubscribed"].includes(recipient.status)) return json({ received: true });
  const isProgress = progress.includes(nextStatus) && progress.indexOf(nextStatus) >= progress.indexOf(recipient.status);
  if (isProgress || ["bounced", "complained", "failed"].includes(nextStatus)) {
    const timestampColumn = nextStatus === "delivered" ? "delivered_at" : nextStatus === "opened" ? "opened_at" : nextStatus === "clicked" ? "clicked_at" : null;
    await database.from("email_campaign_recipients").update({ status: nextStatus, ...(timestampColumn ? { [timestampColumn]: new Date().toISOString() } : {}) }).eq("id", recipient.id);
    const { data: rows } = await database.from("email_campaign_recipients").select("status").eq("campaign_id", recipient.campaign_id);
    const count = (status: string) => (rows ?? []).filter((row) => row.status === status).length;
    await database.from("email_campaigns").update({
      delivered_count: count("delivered") + count("opened") + count("clicked"),
      opened_count: count("opened") + count("clicked"),
      clicked_count: count("clicked"),
      failed_count: count("failed") + count("bounced") + count("complained")
    }).eq("id", recipient.campaign_id);
  }
  return json({ received: true });
}
