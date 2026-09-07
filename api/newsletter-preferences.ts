import { emailRequest, preferenceToken, readPreferenceToken } from "./_lib/newsletter";
import { checkRateLimit, getAdminSupabase } from "./_lib/server";

function page(message: string, action?: string) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences | Fieldio</title><body style="font:18px/1.6 sans-serif;max-width:40rem;margin:12vh auto;padding:24px;background:#f6f6f3;color:#151612"><main><h1>Fieldio email preferences</h1><p>${message}</p>${action ? `<form method="post"><button style="font:inherit;padding:12px 24px" type="submit">${action}</button></form>` : '<a href="/">Return to Fieldio</a>'}</main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export function GET(request: Request) {
  try {
    const { action } = readPreferenceToken(new URL(request.url).searchParams.get("token") || "");
    return page(action === "subscribe" ? "Confirm your email to join the Fieldio list." : "Stop receiving Fieldio marketing emails.", action === "subscribe" ? "Confirm subscription" : "Unsubscribe");
  } catch { return page("This link is invalid or has expired. Request a new link from the Fieldio newsletter form."); }
}

export async function POST(request: Request) {
  if (!await checkRateLimit(request)) return page("Please wait a minute and try again.");
  try {
    const { id, action } = readPreferenceToken(new URL(request.url).searchParams.get("token") || "");
    const db = getAdminSupabase();
    if (!db) throw new Error("UNAVAILABLE");
    const { data, error } = await db.from("newsletter_subscribers").select("email,status").eq("id", id).single();
    if (error || !data) throw new Error("NOT_FOUND");
    const unsubscribed = action === "unsubscribe";
    if (unsubscribed) await emailRequest(`/contacts/${encodeURIComponent(data.email)}`, { unsubscribed: true }, "PATCH");
    else {
      // Upsert by email: create if absent, update an existing provider contact otherwise.
      try { await emailRequest(`/contacts/${encodeURIComponent(data.email)}`, { unsubscribed: false }, "PATCH"); }
      catch { await emailRequest("/contacts", { email: data.email, unsubscribed: false }); }
    }
    const { error: updateError } = await db.from("newsletter_subscribers").update({ status: unsubscribed ? "unsubscribed" : "subscribed", unsubscribed_at: unsubscribed ? new Date().toISOString() : null }).eq("id", id);
    if (updateError) throw updateError;
    if (!unsubscribed && data.status !== "subscribed") {
      const url = new URL("/api/newsletter-preferences", process.env.APP_URL);
      url.searchParams.set("token", preferenceToken(id, "unsubscribe"));
      await emailRequest("/emails", { from: process.env.RESEND_FROM, to: [data.email], subject: "Welcome to the Fieldio list", text: `You are subscribed to new arrivals, collection announcements, and selected Fieldio updates.\n\nUnsubscribe at any time: ${url.href}` });
    }
    return page(unsubscribed ? "You have been unsubscribed from Fieldio marketing emails." : "Your subscription is confirmed. Welcome to the Fieldio list.");
  } catch { return page("We could not update your preference. Try this link again, or contact Fieldio for help."); }
}
