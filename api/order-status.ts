import { z } from "zod";
import { sendTrackedEmail } from "./_lib/email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const orderStatus = z.enum(["awaiting_confirmation", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
type OrderStatus = z.infer<typeof orderStatus>;

const schema = z.object({ orderId: z.string().uuid(), status: orderStatus });

export const orderStatusCopy: Record<OrderStatus, { subject: string; heading: string; message: string }> = {
  awaiting_confirmation: {
    subject: "We are confirming your Fieldio order request",
    heading: "We are confirming your request",
    message: "Fieldio is checking availability, delivery, and the final order details. No payment has been taken."
  },
  confirmed: {
    subject: "Your Fieldio order is confirmed",
    heading: "Your order is confirmed",
    message: "Your order details have been confirmed. Fieldio will keep you updated as the order is prepared."
  },
  processing: {
    subject: "Your Fieldio order is being prepared",
    heading: "Your order is being prepared",
    message: "Your order is now being prepared for delivery."
  },
  shipped: {
    subject: "Your Fieldio order has been shipped",
    heading: "Your order is on the way",
    message: "Your order has been shipped. Contact Fieldio from your account if you need delivery tracking or support."
  },
  delivered: {
    subject: "Your Fieldio order has been delivered",
    heading: "Your order has been delivered",
    message: "Your order is marked as delivered. Contact Fieldio if anything needs attention."
  },
  cancelled: {
    subject: "Your Fieldio order has been cancelled",
    heading: "Your order was cancelled",
    message: "This order request has been cancelled. Contact Fieldio if you need help or would like to make a new request."
  }
};

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 20, 60_000)) return json({ error: "Order updates are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await getAuthenticatedSupabase(request);
    const { data, error } = await client.rpc("update_order_request_status", { p_order_id: input.orderId, p_status: input.status });
    if (error?.message.includes("STAFF_ACCESS_REQUIRED")) return json({ error: "You are not authorised to update orders." }, 403);
    if (error?.message.includes("ORDER_REQUEST_NOT_FOUND")) return json({ error: "This order request no longer exists." }, 404);
    if (error?.message.includes("INVALID_ORDER_STATUS_TRANSITION")) return json({ error: "That order status change is not allowed. Refresh the order and try again." }, 409);
    if (error) throw error;

    const order = data as { id: string; public_reference: string; customer_email: string; status: OrderStatus };
    const copy = orderStatusCopy[order.status];
    const delivery = await sendTrackedEmail(admin, `order:${order.id}:${order.status}`, "order-status", {
      to: order.customer_email,
      subject: `${copy.subject} - ${order.public_reference}`,
      heading: copy.heading,
      message: copy.message,
      details: [{ label: "Order reference", value: order.public_reference }, { label: "Status", value: order.status.replaceAll("_", " ") }],
      action: { label: "View your order", url: "https://fieldio.shop/account" }
    });
    return json({ order, emailDelivered: delivery !== "failed" });
  } catch (error) {
    return handleApiError(error);
  }
}
