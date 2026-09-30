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
    const { admin, client } = await getAuthenticatedSupabase(request);

    if (input.action === "return") {
      const { data, error } = await client.rpc("open_marketplace_return", { p_order_id: input.orderId, p_order_item_id: input.itemId, p_quantity: input.quantity, p_reason: input.reason, p_details: input.details });
      if (error?.code === "23505") return json({ error: "An open return already exists for this item." }, 409);
      if (error?.message.includes("FULFILLMENT_NOT_DELIVERED")) return json({ error: "Returns can be requested after this seller's item is delivered." }, 409);
      if (error?.message.includes("RETURN_QUANTITY_ALREADY_CLAIMED") || error?.message.includes("INVALID_RETURN_QUANTITY")) return json({ error: "The return quantity exceeds the quantity still eligible for return." }, 409);
      if (error?.message.includes("ORDER_NOT_FOUND") || error?.message.includes("ORDER_ITEM_NOT_FOUND")) return json({ error: "Order item not found." }, 404);
      if (error) throw error;
      const [{ data: order, error: orderError }, { data: item, error: itemError }] = await Promise.all([
        admin.from("order_requests").select("id,public_reference,customer_email").eq("id", input.orderId).single(),
        admin.from("order_items").select("id,product_name").eq("id", input.itemId).eq("order_request_id", input.orderId).single()
      ]);
      if (orderError || itemError || !order || !item) throw orderError || itemError || new Error("CASE_EMAIL_CONTEXT_MISSING");
      await Promise.all([
        sendTrackedEmail(admin, `return:${data.id}:customer`, "return-requested", { to: order.customer_email, subject: `Return request received - ${order.public_reference}`, heading: "Your return request is with Fieldio", message: "We will review the request and contact you with the next step. Do not send the item until Fieldio confirms the return.", details: [{ label: "Order", value: order.public_reference }, { label: "Item", value: item.product_name }], action: { label: "View your order", url: "https://fieldio.shop/account" } }),
        sendTrackedEmail(admin, `return:${data.id}:admin`, "admin-return-requested", { to: notificationEmail(), replyTo: order.customer_email, subject: `New return request - ${order.public_reference}`, heading: "A customer requested a return", message: input.details, details: [{ label: "Order", value: order.public_reference }, { label: "Item", value: item.product_name }, { label: "Reason", value: input.reason.replaceAll("_", " ") }], action: { label: "Review return", url: "https://fieldio.shop/admin" } })
      ]);
      return json({ request: data }, 201);
    }

    const { data, error } = await client.rpc("open_marketplace_dispute", { p_order_id: input.orderId, p_order_item_id: input.itemId, p_reason: input.reason, p_details: input.details });
    if (error?.code === "23505") return json({ error: "An open dispute already exists for this seller fulfilment." }, 409);
    if (error?.message.includes("FULFILLMENT_NOT_DISPUTABLE")) return json({ error: "This seller fulfilment is not eligible for a dispute yet." }, 409);
    if (error?.message.includes("ORDER_NOT_FOUND") || error?.message.includes("ORDER_ITEM_NOT_FOUND")) return json({ error: "Order item not found." }, 404);
    if (error) throw error;
    const [{ data: order, error: orderError }, { data: item, error: itemError }] = await Promise.all([
      admin.from("order_requests").select("id,public_reference,customer_email").eq("id", input.orderId).single(),
      admin.from("order_items").select("id,product_name").eq("id", input.itemId).eq("order_request_id", input.orderId).single()
    ]);
    if (orderError || itemError || !order || !item) throw orderError || itemError || new Error("CASE_EMAIL_CONTEXT_MISSING");
    await Promise.all([
      sendTrackedEmail(admin, `dispute:${data.id}:customer`, "dispute-opened", { to: order.customer_email, subject: `Fieldio support case opened - ${order.public_reference}`, heading: "Your support case is open", message: "Fieldio will review the order and contact the relevant seller where needed. Your private contact details remain with Fieldio.", details: [{ label: "Order", value: order.public_reference }, { label: "Reason", value: input.reason }], action: { label: "View your order", url: "https://fieldio.shop/account" } }),
      sendTrackedEmail(admin, `dispute:${data.id}:admin`, "admin-dispute-opened", { to: notificationEmail(), replyTo: order.customer_email, subject: `New order dispute - ${order.public_reference}`, heading: "A customer opened a support case", message: input.details, details: [{ label: "Order", value: order.public_reference }, { label: "Item", value: item.product_name }, { label: "Reason", value: input.reason }], action: { label: "Review dispute", url: "https://fieldio.shop/admin" } })
    ]);
    return json({ dispute: data }, 201);
  } catch (error) { return handleApiError(error); }
}
