import { z } from "zod";
import { checkRateLimit, getAdminSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";
import { emailRequest, preferenceToken } from "./_lib/newsletter.js";
const schema = z.object({ email: z.string().trim().email().max(254), consent: z.literal(true) });

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 5, 60_000)) return json({ error: "Requests are temporarily limited. Try again shortly." }, 429);
  try {
    const { email } = await readValidatedJson(request, schema);
    const supabase = getAdminSupabase();
    if (!supabase || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM || !process.env.NEWSLETTER_TOKEN_SECRET || !process.env.APP_URL) return json({ error: "Subscriptions are temporarily unavailable. Please try again later." }, 503);
    const normalized = email.toLowerCase();
    const { error: insertError } = await supabase.from("newsletter_subscribers").upsert({ email: normalized, consented_at: new Date().toISOString(), status: "unsubscribed" }, { onConflict: "email", ignoreDuplicates: true });
    if (insertError) throw insertError;
    const { data, error } = await supabase.from("newsletter_subscribers").select("id,status").eq("email", normalized).single();
    if (error || !data) throw error ?? new Error("SUBSCRIBER_MISSING");
    if (data.status !== "subscribed") {
      const token = preferenceToken(data.id, "subscribe");
      const url = new URL("/api/newsletter-preferences", process.env.APP_URL);
      url.searchParams.set("token", token);
      await emailRequest("/emails", { from: process.env.RESEND_FROM, to: [normalized], subject: "Confirm your Fieldio subscription", text: "Confirm your email to receive the Fieldio edit, new arrivals, and selected updates.\n\n" + url.href + "\n\nIf you did not request this, ignore this email." });
    }
    return json({ message: "If confirmation is needed, a link has been sent to your email." }, 202);
  } catch (error) { return handleApiError(error); }
}
