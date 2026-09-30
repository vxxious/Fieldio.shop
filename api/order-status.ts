import { z } from "zod";
import { sendTrackedEmail } from "./_lib/email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const orderStatus = z.enum(["awaiting_confirmation", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
type OrderStatus = z.infer<typeof orderStatus>;
type FulfillmentSummaryStatus = "pending" | "awaiting_vendor" | "partially_accepted" | "accepted" | "preparing" | "partially_fulfilled" | "shipped" | "partially_delivered" | "delivered" | "partially_rejected" | "rejected" | "cancelled";

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
    message: "Your order is marked as delivered. You can now review each delivered item from your Fieldio account, or contact Fieldio if anything needs attention."
  },
  cancelled: {
    subject: "Your Fieldio order has been cancelled",
    heading: "Your order was cancelled",
    message: "This order request has been cancelled. Contact Fieldio if you need help or would like to make a new request."
  }
};

const fulfillmentStatusCopy: Record<FulfillmentSummaryStatus, { subject: string; heading: string; message: string }> = {
  pending: orderStatusCopy.confirmed,
  awaiting_vendor: orderStatusCopy.confirmed,
  partially_accepted: orderStatusCopy.confirmed,
  accepted: orderStatusCopy.confirmed,
  preparing: orderStatusCopy.processing,
  partially_fulfilled: {
    subject: "Part of your Fieldio order is on the way",
    heading: "Part of your order is on the way",
    message: "One or more store fulfilments have shipped while the remaining items are still being prepared."
  },
  shipped: orderStatusCopy.shipped,
  partially_delivered: {
    subject: "Part of your Fieldio order has been delivered",
    heading: "Part of your order has been delivered",
    message: "One or more store fulfilments were delivered. You can review those items now; other items remain in progress or need Fieldio's attention."
  },
  delivered: orderStatusCopy.delivered,
  partially_rejected: {
    subject: "Your Fieldio order needs attention",
    heading: "Part of your order could not be fulfilled",
    message: "A store could not fulfil part of your order. Fieldio will contact you about the affected items; other fulfilments remain active."
  },
  rejected: {
    subject: "Your Fieldio order could not be fulfilled",
    heading: "Your order could not be fulfilled",
    message: "The stores could not fulfil this order. Fieldio will contact you about the next step."
  },
  cancelled: orderStatusCopy.cancelled
};

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 20, 60_000)) return json({ error: "Order updates are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await getAuthenticatedSupabase(request);
    const { error } = await client.rpc("update_order_request_status", { p_order_id: input.orderId, p_status: input.status });
    if (error?.message.includes("STAFF_ACCESS_REQUIRED")) return json({ error: "You are not authorised to update orders." }, 403);
    if (error?.message.includes("ORDER_REQUEST_NOT_FOUND")) return json({ error: "This order request no longer exists." }, 404);
    if (error?.message.includes("INVALID_ORDER_STATUS_TRANSITION")) return json({ error: "That order status change is not allowed. Refresh the order and try again." }, 409);
    if (error?.message.includes("VENDOR_ACCEPTANCE_PENDING")) return json({ error: "Every active vendor must accept their fulfilment before this order can move to processing." }, 409);
    if (error?.message.includes("VENDOR_FULFILLMENT_PENDING")) return json({ error: "Every active vendor must mark their part as shipped before the master order can be shipped." }, 409);
    if (error?.message.includes("NO_ACTIVE_FULFILLMENT")) return json({ error: "This order has no active vendor fulfilments to move forward." }, 409);
    if (error?.message.includes("PAYMENT_NOT_CONFIRMED")) return json({ error: "Record the customer's payment before moving this order into fulfilment." }, 409);
    if (error?.message.includes("INSUFFICIENT_STOCK")) return json({ error: "This order can no longer be confirmed because one or more items are out of stock." }, 409);
    if (error) throw error;

    const { data: refreshed, error: refreshError } = await admin.from("order_requests").select("id,public_reference,customer_email,status,fulfillment_status").eq("id", input.orderId).single();
    if (refreshError) throw refreshError;
    const order = refreshed as { id: string; public_reference: string; customer_email: string; status: OrderStatus; fulfillment_status: FulfillmentSummaryStatus };
    const effectiveStatus = order.status === "awaiting_confirmation" || order.status === "cancelled" ? order.status : order.fulfillment_status;
    const copy = effectiveStatus === "awaiting_confirmation" || effectiveStatus === "cancelled" ? orderStatusCopy[effectiveStatus] : fulfillmentStatusCopy[effectiveStatus];
    const delivery = await sendTrackedEmail(admin, `order:${order.id}:${order.status}:${order.fulfillment_status}`, "order-status", {
      to: order.customer_email,
      subject: `${copy.subject} - ${order.public_reference}`,
      heading: copy.heading,
      message: copy.message,
      details: [{ label: "Order reference", value: order.public_reference }, { label: "Status", value: effectiveStatus.replaceAll("_", " ") }],
      action: { label: effectiveStatus.includes("delivered") ? "Review delivered items" : "View your order", url: "https://fieldio.shop/account" }
    });
    return json({ order, emailDelivered: delivery !== "failed" });
  } catch (error) {
    return handleApiError(error);
  }
}
