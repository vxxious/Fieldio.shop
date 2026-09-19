import { z } from "zod";
import { notificationEmail, sendTransactionalEmail } from "./_lib/email.js";
import { checkRateLimit, getAdminSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().min(7).max(30), subject: z.string().trim().min(3).max(180), message: z.string().trim().min(15).max(2000), company: z.string().trim().max(120).optional() });

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!await checkRateLimit(request)) return json({ error: "Requests are temporarily limited. Try again shortly." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const supabase = getAdminSupabase();
    if (!supabase) return json({ error: "Contact storage is not configured. Please use WhatsApp." }, 503);
    const { error } = await supabase.from("contact_messages").insert({ name: input.name, email: input.email, phone: input.phone, subject: input.subject, message: input.message });
    if (error) throw error;
    await Promise.all([
      sendTransactionalEmail({ to: input.email, subject: "We received your Fieldio message", heading: "Your message is with Fieldio", message: "Thank you for contacting us. A member of the team will reply as soon as possible.", details: [{ label: "Subject", value: input.subject }] }),
      sendTransactionalEmail({ to: notificationEmail(), replyTo: input.email, subject: "New Fieldio contact message", heading: "New contact message", message: input.message, details: [{ label: "Subject", value: input.subject }, { label: "Name", value: input.name }, { label: "Email", value: input.email }, { label: "Phone", value: input.phone }] })
    ]);
    return json({ message: "Your message has been received." }, 201);
  } catch (error) { return handleApiError(error); }
}
