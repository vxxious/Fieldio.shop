import { emailRequest } from "./newsletter.js";

interface EmailDetails {
  label: string;
  value: string;
}

interface TransactionalEmail {
  to: string;
  subject: string;
  heading: string;
  message: string;
  details?: EmailDetails[];
  replyTo?: string;
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;"
})[character]!);

export async function sendTransactionalEmail({ to, subject, heading, message, details = [], replyTo }: TransactionalEmail): Promise<boolean> {
  const from = process.env.RESEND_FROM;
  if (!process.env.RESEND_API_KEY || !from || !to) return false;
  const rows = details.map(({ label, value }) => `<tr><th style="padding:8px 16px 8px 0;text-align:left;vertical-align:top;font-weight:600">${escapeHtml(label)}</th><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("");
  const textDetails = details.map(({ label, value }) => `${label}: ${value}`).join("\n");
  try {
    await emailRequest("/emails", {
      from,
      to: [to],
      subject,
      ...(replyTo ? { reply_to: replyTo } : {}),
      html: `<div style="background:#f5f5f2;padding:32px 16px;font-family:Arial,sans-serif;color:#111"><div style="max-width:620px;margin:auto;background:#fff;padding:32px"><p style="margin:0 0 32px;font-size:22px;font-weight:700">Fieldio</p><h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${escapeHtml(heading)}</h1><p style="margin:0 0 24px;line-height:1.6">${escapeHtml(message)}</p>${rows ? `<table style="border-collapse:collapse;width:100%;font-size:15px">${rows}</table>` : ""}<p style="margin:32px 0 0;color:#666;font-size:13px">Fieldio · Luxury fashion sourcing and personal shopping</p></div></div>`,
      text: `Fieldio\n\n${heading}\n\n${message}${textDetails ? `\n\n${textDetails}` : ""}`
    });
    return true;
  } catch {
    console.error("Fieldio transactional email delivery failed");
    return false;
  }
}

export const notificationEmail = () => process.env.FIELDIO_NOTIFICATION_EMAIL ?? "";
