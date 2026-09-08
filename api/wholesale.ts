import { z } from "zod";
import { checkRateLimit, getAdminSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().min(7).max(30), company: z.string().trim().max(120).optional(), subject: z.string().trim().min(3).max(180), message: z.string().trim().min(15).max(2000) });

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!await checkRateLimit(request)) return json({ error: "Requests are temporarily limited. Try again shortly." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const supabase = getAdminSupabase();
    if (!supabase) return json({ error: "Wholesale storage is not configured. Please use WhatsApp." }, 503);
    const { error } = await supabase.from("wholesale_inquiries").insert({ name: input.name, email: input.email, phone: input.phone, company: input.company ?? null, subject: input.subject, message: input.message, status: "new" });
    if (error) throw error;
    return json({ message: "Your wholesale enquiry has been received." }, 201);
  } catch (error) { return handleApiError(error); }
}
