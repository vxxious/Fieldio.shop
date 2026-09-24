import { z } from "zod";
import { notificationEmail, sendTrackedEmail } from "./email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./server.js";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("return"), orderId: z.string().uuid(), itemId: z.string().uuid(), quantity: z.number().int().min(1).max(10), reason: z.enum(["wrong_item", "damaged", "not_as_described", "fit", "changed_mind", "other"]), details: z.string().trim().min(10).max(2000) }),
  z.object({ action: z.literal("dispute"), orderId: z.string().uuid(), itemId: z.string().uuid(), reason: z.enum(["delivery", "item", "refund", "seller", "other"]), details: z.string().trim().min(10).max(2000) })
]);

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 5, 60_000)) return json({ error: "Support requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, user } = await getAuthenticatedSupabase(request);
    const { data: order, error } = await admin.from("order_requests").select("id,public_reference,user_id,customer_email,status").eq("id", input.orderId).single();
    if (error || !order || order.user_id !== user.id) return json({ error: "Order not found." }, 404);

    if (input.action === "return") {
      if (order.status !== "delivered") return json({ error: "Returns can be requested after delivery." }, 409);
      const { data: item, error: itemError } = await admin.from("order_items").select("id,product_name,quantity").eq("id", input.itemId).eq("order_request_id", order.id).single();
      if (itemError || !item) return json({ error: "Order item not found." }, 404);
      if (input.quantity > item.quantity) return json({ error: "Return quantity cannot exceed the purchased quantity." }, 400);
      const { data, error: insertError } = await admin.from("marketplace_returns").insert({ order_request_id: order.id, order_item_id: item.id, buyer_id: user.id, quantity: input.quantity, reason: input.reason, details: input.details }).select("id,status,created_at").single();
      if (insertError?.code === "23505") return json({ error: "An open return already exists for this item." }, 409);
      if (insertError) throw insertError;
      await Promise.all([
        sendTrackedEmail(admin, `return:${data.id}:customer`, "return-requested", { to: order.customer_email, subject: `Return request received - ${order.public_reference}`, heading: "Your return request is with Fieldio", message: "We will review the request and contact you with the next step. Do not send the item until Fieldio confirms the return.", details: [{ label: "Order", value: order.public_reference }, { label: "Item", value: item.product_name }], action: { label: "View your order", url: "https://fieldio.shop/account" } }),
        sendTrackedEmail(admin, `return:${data.id}:admin`, "admin-return-requested", { to: notificationEmail(), replyTo: order.customer_email, subject: `New return request - ${order.public_reference}`, heading: "A customer requested a return", message: input.details, details: [{ label: "Order", value: order.public_reference }, { label: "Item", value: item.product_name }, { label: "Reason", value: input.reason.replaceAll("_", " ") }], action: { label: "Review return", url: "https://fieldio.shop/admin" } })
      ]);
      return json({ request: data }, 201);
    }

    if (["order_request", "cancelled"].includes(order.status)) return json({ error: "This order is not eligible for a dispute." }, 409);
    const { data: item, error: itemError } = await admin.from("order_items").select("id,product_name,fulfillment_id").eq("id", input.itemId).eq("order_request_id", order.id).single();
    if (itemError || !item?.fulfillment_id) return json({ error: "Order item not found." }, 404);
    const { data, error: insertError } = await admin.from("marketplace_disputes").insert({ order_request_id: order.id, fulfillment_id: item.fulfillment_id, opened_by: user.id, reason: input.reason, details: input.details }).select("id,status,created_at").single();
    if (insertError?.code === "23505") return json({ error: "An open dispute already exists for this seller fulfilment." }, 409);
    if (insertError) throw insertError;
    await Promise.all([
      sendTrackedEmail(admin, `dispute:${data.id}:customer`, "dispute-opened", { to: order.customer_email, subject: `Fieldio support case opened - ${order.public_reference}`, heading: "Your support case is open", message: "Fieldio will review the order and contact the relevant seller where needed. Your private contact details remain with Fieldio.", details: [{ label: "Order", value: order.public_reference }, { label: "Reason", value: input.reason }], action: { label: "View your order", url: "https://fieldio.shop/account" } }),
      sendTrackedEmail(admin, `dispute:${data.id}:admin`, "admin-dispute-opened", { to: notificationEmail(), replyTo: order.customer_email, subject: `New order dispute - ${order.public_reference}`, heading: "A customer opened a support case", message: input.details, details: [{ label: "Order", value: order.public_reference }, { label: "Item", value: item.product_name }, { label: "Reason", value: input.reason }], action: { label: "Review dispute", url: "https://fieldio.shop/admin" } })
    ]);
    return json({ dispute: data }, 201);
  } catch (error) { return handleApiError(error); }
}
