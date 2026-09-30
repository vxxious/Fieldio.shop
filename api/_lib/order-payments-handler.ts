import { z } from "zod";
import { requireStaff } from "./admin.js";
import { sendTrackedEmail } from "./email.js";
import { checkRateLimit, handleApiError, json, readValidatedJson } from "./server.js";

const schema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().positive().max(2_147_483_647),
  shippingAmount: z.number().int().min(0).max(2_147_483_647),
  method: z.enum(["bank_transfer", "card", "crypto", "cash", "other"]),
  reference: z.string().trim().min(2).max(160)
}).refine((value) => value.shippingAmount <= value.amount, {
  path: ["shippingAmount"],
  message: "Shipping cannot exceed the amount received."
});

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 15, 60_000)) return json({ error: "Payment confirmations are temporarily limited." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await requireStaff(request, ["owner", "admin"]);
    const { data, error } = await client.rpc("confirm_order_payment", {
      p_order_id: input.orderId,
      p_amount: input.amount,
      p_shipping_total: input.shippingAmount,
      p_method: input.method,
      p_reference: input.reference
    });
    if (error?.message.includes("ORDER_REQUEST_NOT_FOUND")) return json({ error: "This order request no longer exists." }, 404);
    if (error?.message.includes("ORDER_NOT_CONFIRMED")) return json({ error: "Confirm the order before recording payment." }, 409);
    if (error?.message.includes("PAYMENT_ALREADY_CONFIRMED")) return json({ error: "Payment has already been confirmed for this order." }, 409);
    if (error?.message.includes("INVALID_PAYMENT") || error?.message.includes("INVALID_SHIPPING_AMOUNT") || error?.message.includes("PAYMENT_REFERENCE_REQUIRED")) return json({ error: "Check the payment amount, shipping, method, and reference." }, 400);
    if (error) throw error;

    const order = data as { id: string; public_reference: string; customer_email: string; currency: string; payment_amount: number; payment_method: string; payment_reference: string };
    const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: order.currency }).format(order.payment_amount / 100);
    const delivery = await sendTrackedEmail(admin, `order:${order.id}:payment-confirmed`, "order-payment-confirmed", {
      to: order.customer_email,
      subject: `Payment confirmed - ${order.public_reference}`,
      heading: "Your payment is confirmed",
      message: "Fieldio has recorded your payment. Your order can now move into preparation.",
      details: [
        { label: "Order reference", value: order.public_reference },
        { label: "Amount", value: amount },
        { label: "Payment method", value: order.payment_method.replaceAll("_", " ") },
        { label: "Payment reference", value: order.payment_reference }
      ],
      action: { label: "View your order", url: "https://fieldio.shop/account" }
    });
    return json({ order, emailDelivered: delivery !== "failed" });
  } catch (error) {
    return handleApiError(error);
  }
}
