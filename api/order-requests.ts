import { z } from "zod";
import { checkRateLimit, getAdminSupabase, handleApiError, json, readValidatedJson } from "./_lib/server";

const schema = z.object({
  requestKey: z.string().uuid(),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(30),
    email: z.string().trim().email().max(254),
    shippingAddress: z.string().trim().min(10).max(800),
    note: z.string().trim().max(500).optional()
  }),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10)
  })).min(1).max(25)
});

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 5, 60_000)) return json({ error: "Requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const supabase = getAdminSupabase();
    if (!supabase) return json({ error: "Order requests are temporarily unavailable. Contact Fieldio for assistance." }, 503);
    let userId: string | null = null;
    const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return json({ error: "Your session has expired. Sign in again." }, 401);
      userId = data.user.id;
    }
    const { data, error } = await supabase.rpc("create_order_request", {
      p_customer: input.customer,
      p_items: input.items,
      p_user_id: userId,
      p_request_key: input.requestKey
    });
    if (error) {
      if (["UNAVAILABLE_ITEM", "INSUFFICIENT_STOCK"].some((value) => error.message.includes(value))) return json({ error: "A selected piece or quantity is no longer available. Review your bag." }, 409);
      if (error.message.includes("MIXED_CURRENCY")) return json({ error: "Please request items in one currency at a time." }, 409);
      throw error;
    }
    return json(data, 201);
  } catch (error) { return handleApiError(error); }
}
