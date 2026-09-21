import type { SupabaseClient } from "@supabase/supabase-js";
import { emailRequest } from "./newsletter.js";
import { captureServerException } from "./monitoring.js";

interface EmailDetails {
  label: string;
  value: string;
}

interface EmailAction {
  label: string;
  url: string;
}

export interface TransactionalEmail {
  to: string;
  subject: string;
  heading: string;
  message: string;
  details?: EmailDetails[];
  replyTo?: string;
  action?: EmailAction;
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;"
})[character]!);

export function renderTransactionalEmail({ heading, message, details = [], action }: Omit<TransactionalEmail, "to" | "subject" | "replyTo">): { html: string; text: string } {
  const rows = details.map(({ label, value }) => `<tr><th class="email-detail-label" style="padding:13px 18px 13px 0;border-top:1px solid #d9dad4;text-align:left;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;font-weight:700;color:#151612">${escapeHtml(label)}</th><td class="email-detail-value" style="padding:13px 0;border-top:1px solid #d9dad4;text-align:left;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#55574f;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join("");
  const actionHtml = action ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px"><tr><td class="email-action" bgcolor="#151612" style="background-color:#151612;border:1px solid #151612"><a class="button-link" href="${escapeHtml(action.url)}" style="display:inline-block;padding:16px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:18px;font-weight:700;color:#ffffff;text-decoration:none">${escapeHtml(action.label)}</a></td></tr></table>` : "";
  const textDetails = details.map(({ label, value }) => `${label}: ${value}`).join("\n");
  const textAction = action ? `\n\n${action.label}: ${action.url}` : "";

  return {
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escapeHtml(heading)}</title><style>:root{color-scheme:light dark;supported-color-schemes:light dark}@media only screen and (max-width:620px){.email-shell{width:100%!important}.email-pad{padding-left:24px!important;padding-right:24px!important}.email-title{font-size:36px!important;line-height:40px!important}.button-link{display:block!important;text-align:center!important}}@media (prefers-color-scheme:dark){.email-page{background-color:#11120f!important;color:#f7f7f4!important}.email-shell,.email-header,.email-content{background-color:#1d1e1a!important}.email-brand,.email-title,.email-detail-label{color:#f7f7f4!important}.email-copy,.email-detail-value,.email-footer-copy{color:#c9cabf!important}.email-rule{background-color:#3b3c37!important}.email-detail-label,.email-detail-value,.email-footer{border-color:#3b3c37!important}.email-footer{background-color:#151612!important}.email-footer a{color:#f7f7f4!important}.email-action{background-color:#f7f7f4!important;border-color:#f7f7f4!important}.button-link{color:#151612!important}}</style></head><body class="email-page" style="margin:0;padding:0;background-color:#f3f3f0;color:#151612"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(message)}</div><table class="email-page" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f3f0" style="width:100%;background-color:#f3f3f0"><tr><td align="center" style="padding:24px 12px"><table class="email-shell" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;background-color:#ffffff"><tr><td class="email-pad email-header" style="padding:24px 36px;background-color:#ffffff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="50" valign="middle"><img src="https://fieldio.shop/brand/fieldio-email-logo.png" width="40" height="40" alt="Fieldio" style="display:block;width:40px;height:40px;border:0;mix-blend-mode:difference"></td><td class="email-brand" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:23px;line-height:28px;font-weight:700;letter-spacing:-1px;color:#151612">Fieldio</td></tr></table></td></tr><tr><td class="email-rule" style="height:1px;background-color:#d9dad4;font-size:0;line-height:0">&nbsp;</td></tr><tr><td class="email-pad email-content" style="padding:48px 36px 42px;background-color:#ffffff"><h1 class="email-title" style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:44px;line-height:48px;font-weight:500;letter-spacing:-1.8px;color:#151612">${escapeHtml(heading)}</h1><p class="email-copy" style="margin:0 0 30px;max-width:470px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#55574f">${escapeHtml(message)}</p>${rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">${rows}</table>` : ""}${actionHtml}</td></tr><tr><td class="email-pad email-footer" style="padding:20px 36px;background-color:#f3f3f0;border-top:1px solid #d9dad4"><p class="email-footer-copy" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#66685f">Fieldio &nbsp;&middot;&nbsp; <a href="https://fieldio.shop" style="color:#151612;text-decoration:underline;text-underline-offset:3px">fieldio.shop</a></p></td></tr></table></td></tr></table></body></html>`,
    text: `Fieldio\n\n${heading}\n\n${message}${textDetails ? `\n\n${textDetails}` : ""}${textAction}`
  };
}

export async function sendTransactionalEmail({ to, subject, heading, message, details = [], replyTo, action }: TransactionalEmail): Promise<boolean> {
  const from = process.env.RESEND_FROM;
  if (!process.env.RESEND_API_KEY || !from || !to) {
    if (to) captureServerException(new Error("EMAIL_UNCONFIGURED"));
    return false;
  }
  const content = renderTransactionalEmail({ heading, message, details, action });
  try {
    await emailRequest("/emails", {
      from,
      to: [to],
      subject,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...content
    });
    return true;
  } catch (error) {
    captureServerException(error);
    console.error("Fieldio transactional email delivery failed");
    return false;
  }
}

export async function sendTrackedEmail(database: SupabaseClient, eventKey: string, template: string, email: TransactionalEmail): Promise<"sent" | "duplicate" | "failed"> {
  const recipient = email.to.trim().toLowerCase();
  if (!recipient) return "failed";

  let { data, error } = await database.from("notification_deliveries").insert({ event_key: eventKey, recipient_email: recipient, template }).select("id").single();
  if (error) {
    if (error.code === "23505") {
      const retry = await database.from("notification_deliveries").update({ status: "pending", last_error: null }).eq("event_key", eventKey).eq("recipient_email", recipient).eq("status", "failed").select("id").maybeSingle();
      if (retry.error || !retry.data) return "duplicate";
      data = retry.data;
      error = null;
    }
  }
  if (error) {
    captureServerException(error);
    console.error("Fieldio notification delivery could not be recorded", { code: error.code });
    return await sendTransactionalEmail({ ...email, to: recipient }) ? "sent" : "failed";
  }
  if (!data) return "failed";

  const sent = await sendTransactionalEmail({ ...email, to: recipient });
  const { error: updateError } = await database.from("notification_deliveries").update({ status: sent ? "sent" : "failed", sent_at: sent ? new Date().toISOString() : null, last_error: sent ? null : "EMAIL_PROVIDER_UNAVAILABLE" }).eq("id", data.id);
  if (updateError) {
    captureServerException(updateError);
    console.error("Fieldio notification delivery status could not be updated", { code: updateError.code });
  }
  return sent ? "sent" : "failed";
}

export const notificationEmail = () => process.env.FIELDIO_NOTIFICATION_EMAIL ?? "";
