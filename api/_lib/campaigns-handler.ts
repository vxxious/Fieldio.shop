import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireStaff } from "./admin.js";
import { renderCampaignEmail, type CampaignContent } from "./campaign.js";
import { emailRequest, preferenceToken } from "./newsletter.js";
import { captureServerException } from "./monitoring.js";
import { checkRateLimit, handleApiError, json, readValidatedJson } from "./server.js";

const contentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(2).max(160),
  preheader: z.string().trim().max(180).optional().nullable(),
  heading: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(10000),
  actionLabel: z.string().trim().min(2).max(80).optional().nullable(),
  actionUrl: z.string().url().refine((value) => value.startsWith("https://"), "Use an HTTPS URL.").optional().nullable(),
  audience: z.enum(["subscribers", "customers", "sellers"])
}).superRefine((value, context) => {
  if (Boolean(value.actionLabel) !== Boolean(value.actionUrl)) context.addIssue({ code: "custom", path: [value.actionLabel ? "actionUrl" : "actionLabel"], message: "Add both a button label and URL, or leave both blank." });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), campaign: contentSchema }),
  z.object({ action: z.literal("save"), campaignId: z.string().uuid().optional(), campaign: contentSchema }),
  z.object({ action: z.literal("test"), campaign: contentSchema, email: z.string().trim().email().max(254) }),
  z.object({ action: z.literal("send"), campaignId: z.string().uuid() }),
  z.object({ action: z.literal("retry"), campaignId: z.string().uuid() })
]);

interface Subscriber { id: string; email: string }
interface CampaignRow extends CampaignContent { id: string; name: string; audience: "subscribers" | "customers" | "sellers"; status: string; action_label: string | null; action_url: string | null }

async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await query(from, from + 999);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) return rows;
  }
}

async function audience(database: SupabaseClient, segment: CampaignRow["audience"]): Promise<Subscriber[]> {
  const subscribers = await allRows<Subscriber>((from, to) => database.from("newsletter_subscribers").select("id,email").eq("status", "subscribed").range(from, to));
  if (segment === "subscribers") return subscribers;
  const eligible = segment === "customers"
    ? await allRows<{ customer_email: string }>((from, to) => database.from("order_requests").select("customer_email").range(from, to))
    : await allRows<{ contact_email: string }>((from, to) => database.from("seller_applications").select("contact_email").eq("status", "approved").range(from, to));
  const emails = new Set(eligible.map((row) => ("customer_email" in row ? row.customer_email : row.contact_email).trim().toLowerCase()));
  return subscribers.filter((subscriber) => emails.has(subscriber.email.trim().toLowerCase()));
}

function campaignContent(row: CampaignRow): CampaignContent {
  return { subject: row.subject, preheader: row.preheader, heading: row.heading, body: row.body, actionLabel: row.action_label, actionUrl: row.action_url };
}

async function deliverCampaign(database: SupabaseClient, campaign: CampaignRow) {
  const subscribers = await audience(database, campaign.audience);
  if (!subscribers.length) throw new Error("NO_CAMPAIGN_RECIPIENTS");
  const recipients = subscribers.map((subscriber) => ({ campaign_id: campaign.id, subscriber_id: subscriber.id, email: subscriber.email.trim().toLowerCase() }));
  for (let index = 0; index < recipients.length; index += 500) {
    const { error } = await database.from("email_campaign_recipients").upsert(recipients.slice(index, index + 500), { onConflict: "campaign_id,email", ignoreDuplicates: true });
    if (error) throw error;
  }
  const pending = await allRows<{ id: string; subscriber_id: string; email: string; attempt_count: number }>((from, to) => database.from("email_campaign_recipients").select("id,subscriber_id,email,attempt_count").eq("campaign_id", campaign.id).in("status", ["pending", "failed"]).lt("attempt_count", 3).order("created_at").order("id").range(from, to));
  await database.from("email_campaigns").update({ status: "sending", recipient_count: recipients.length }).eq("id", campaign.id);

  for (const attempt of [...new Set(pending.map((recipient) => recipient.attempt_count))]) {
    const attemptRecipients = pending.filter((recipient) => recipient.attempt_count === attempt);
    for (let index = 0; index < attemptRecipients.length; index += 100) {
      const chunk = attemptRecipients.slice(index, index + 100);
      const messages = chunk.map((recipient) => {
        const url = new URL("/api/newsletter-preferences", process.env.APP_URL);
        url.searchParams.set("token", preferenceToken(recipient.subscriber_id, "unsubscribe"));
        return { from: process.env.RESEND_FROM, to: [recipient.email], subject: campaign.subject, ...renderCampaignEmail(campaignContent(campaign), url.href) };
      });
      let response: { data?: Array<{ id?: string }> };
      try {
        response = await emailRequest<{ data?: Array<{ id?: string }> }>("/emails/batch", messages, "POST", { "Idempotency-Key": `campaign/${campaign.id}/${chunk[0]!.id}/${attempt}` });
      } catch (error) {
        const { error: failedError } = await database.from("email_campaign_recipients").update({ status: "failed", attempt_count: attempt + 1, last_error: "EMAIL_PROVIDER_UNAVAILABLE" }).in("id", chunk.map(({ id }) => id));
        if (failedError) throw failedError;
        captureServerException(error);
        continue;
      }
      const { error: sentError } = await database.from("email_campaign_recipients").update({ status: "sent", attempt_count: attempt + 1, last_error: null, sent_at: new Date().toISOString() }).in("id", chunk.map(({ id }) => id));
      if (sentError) throw sentError;
      const providerUpdates = await Promise.all(chunk.map((recipient, offset) => database.from("email_campaign_recipients").update({ provider_email_id: response.data?.[offset]?.id ?? null }).eq("id", recipient.id)));
      const providerIdError = providerUpdates.find((result) => result.error)?.error;
      if (providerIdError) captureServerException(providerIdError);
    }
  }

  const statuses = await allRows<{ status: string }>((from, to) => database.from("email_campaign_recipients").select("status").eq("campaign_id", campaign.id).range(from, to));
  const counts = statuses.reduce<Record<string, number>>((total, row) => ({ ...total, [row.status]: (total[row.status] ?? 0) + 1 }), {});
  const sentCount = (counts.sent ?? 0) + (counts.delivered ?? 0) + (counts.opened ?? 0) + (counts.clicked ?? 0);
  const failedCount = counts.failed ?? 0;
  const finalStatus = sentCount && failedCount ? "partial" : sentCount ? "sent" : "failed";
  const { error: updateError } = await database.from("email_campaigns").update({ status: finalStatus, sent_count: sentCount, failed_count: failedCount, sent_at: sentCount ? new Date().toISOString() : null }).eq("id", campaign.id);
  if (updateError) throw updateError;
  return { recipients: recipients.length, sent: sentCount, failed: failedCount, status: finalStatus };
}

async function audit(database: SupabaseClient, actorId: string, action: string, campaignId: string) {
  const { error } = await database.from("audit_logs").insert({ actor_id: actorId, action, entity_type: "email_campaign", entity_id: campaignId });
  if (error) throw error;
}

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 20, 60_000)) return json({ error: "Campaign requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, user } = await requireStaff(request, ["owner", "admin"]);
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM || !process.env.NEWSLETTER_TOKEN_SECRET || !process.env.APP_URL) return json({ error: "Campaign delivery is not configured." }, 503);

    if (input.action === "preview") {
      const recipients = await audience(admin, input.campaign.audience);
      return json({ recipientCount: recipients.length, html: renderCampaignEmail(input.campaign, "https://fieldio.shop/#newsletter").html });
    }
    if (input.action === "test") {
      const content = renderCampaignEmail(input.campaign, "https://fieldio.shop/#newsletter");
      await emailRequest("/emails", { from: process.env.RESEND_FROM, to: [input.email], subject: `[TEST] ${input.campaign.subject}`, ...content }, "POST", { "Idempotency-Key": `campaign-test/${crypto.randomUUID()}` });
      return json({ message: "Test email sent." });
    }
    if (input.action === "save") {
      const values = { name: input.campaign.name, subject: input.campaign.subject, preheader: input.campaign.preheader || null, heading: input.campaign.heading, body: input.campaign.body, action_label: input.campaign.actionLabel || null, action_url: input.campaign.actionUrl || null, audience: input.campaign.audience };
      const result = input.campaignId
        ? await admin.from("email_campaigns").update(values).eq("id", input.campaignId).eq("status", "draft").select("*").single()
        : await admin.from("email_campaigns").insert({ ...values, created_by: user.id }).select("*").single();
      if (result.error) throw result.error;
      await audit(admin, user.id, input.campaignId ? "UPDATE" : "CREATE", result.data.id);
      return json({ campaign: result.data }, input.campaignId ? 200 : 201);
    }

    const { data, error } = await admin.from("email_campaigns").select("*").eq("id", input.campaignId).single();
    if (error || !data) return json({ error: "Campaign not found." }, 404);
    if (input.action === "send" && data.status !== "draft") return json({ error: "Only draft campaigns can be sent." }, 409);
    if (input.action === "retry" && !["partial", "failed"].includes(data.status)) return json({ error: "This campaign has no failed delivery to retry." }, 409);
    const result = await deliverCampaign(admin, data as CampaignRow);
    await audit(admin, user.id, input.action === "retry" ? "RETRY" : "SEND", input.campaignId);
    return json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CAMPAIGN_RECIPIENTS") return json({ error: "This audience has no subscribed recipients." }, 409);
    return handleApiError(error);
  }
}
