import { z } from "zod";
import { notificationEmail, sendTrackedEmail } from "./_lib/email.js";
import { checkRateLimit, getAdminSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

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
    const response = data as { reference?: unknown; items?: unknown } | null;
    const reference = typeof response?.reference === "string" ? response.reference : "Pending";
    const itemCount = Array.isArray(response?.items) ? response.items.length : input.items.length;
    const order = await supabase.from("order_requests").select("id").eq("request_key", input.requestKey).single();
    if (order.error) throw order.error;
    const groups = await supabase.from("order_fulfillments").select("id,seller_owner_id,store_name").eq("order_request_id", order.data.id).not("seller_owner_id", "is", null);
    if (groups.error) throw groups.error;
    const groupIds = (groups.data ?? []).map(({ id }) => id);
    const groupItems = groupIds.length ? await supabase.from("order_items").select("fulfillment_id").in("fulfillment_id", groupIds) : { data: [], error: null };
    if (groupItems.error) throw groupItems.error;
    const itemCounts = new Map<string, number>();
    for (const item of groupItems.data ?? []) if (item.fulfillment_id) itemCounts.set(item.fulfillment_id, (itemCounts.get(item.fulfillment_id) ?? 0) + 1);
    const vendorGroups = (groups.data ?? []).flatMap((group) => group.seller_owner_id ? [{ id: group.id, sellerOwnerId: group.seller_owner_id, storeName: group.store_name, itemCount: itemCounts.get(group.id) ?? 0 }] : []);
    const ownerIds = [...new Set(vendorGroups.map(({ sellerOwnerId }) => sellerOwnerId))];
    const contacts = ownerIds.length
      ? await supabase.from("seller_applications").select("owner_id,contact_email").in("owner_id", ownerIds).eq("status", "approved")
      : { data: [], error: null };
    if (contacts.error) throw contacts.error;
    const emailByOwner = new Map((contacts.data ?? []).map(({ owner_id, contact_email }) => [owner_id, contact_email]));
    await Promise.all([
      sendTrackedEmail(supabase, `order-request:${input.requestKey}:customer`, "order-request-received", { to: input.customer.email, subject: `Fieldio order request ${reference}`, heading: "Your order request is with Fieldio", message: "We will confirm availability, shipping, and payment before the order is final.", details: [{ label: "Reference", value: reference }, { label: "Items", value: String(itemCount) }], action: { label: "View your request", url: "https://fieldio.shop/account" } }),
      sendTrackedEmail(supabase, `order-request:${input.requestKey}:admin`, "admin-order-request", { to: notificationEmail(), replyTo: input.customer.email, subject: `New Fieldio order request ${reference}`, heading: "New order request", message: "A customer has submitted an order request.", details: [{ label: "Reference", value: reference }, { label: "Customer", value: input.customer.name }, { label: "Email", value: input.customer.email }, { label: "Phone", value: input.customer.phone }, { label: "Ship to", value: input.customer.shippingAddress }, { label: "Items", value: String(itemCount) }, { label: "Vendor groups", value: String(vendorGroups.length) }, ...(input.customer.note ? [{ label: "Note", value: input.customer.note }] : [])], action: { label: "Open admin orders", url: "https://fieldio.shop/admin" } }),
      ...vendorGroups.map((group) => sendTrackedEmail(supabase, `order-request:${input.requestKey}:vendor:${group.id}`, "vendor-order-request", {
        to: emailByOwner.get(group.sellerOwnerId) ?? "",
        subject: `New Fieldio order ${reference}`,
        heading: "A new order needs your attention",
        message: "Fieldio has received an order containing products from your store. Wait for confirmation before preparing it.",
        details: [{ label: "Reference", value: reference }, { label: "Store", value: group.storeName }, { label: "Items", value: String(group.itemCount) }],
        action: { label: "Open seller fulfilment", url: "https://fieldio.shop/sell" }
      }))
    ]);
    return json({ reference, items: Array.isArray(response?.items) ? response.items : [] }, 201);
  } catch (error) { return handleApiError(error); }
}
