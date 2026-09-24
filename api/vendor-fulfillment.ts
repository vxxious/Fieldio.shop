import { z } from "zod";
import { notificationEmail, sendTrackedEmail } from "./_lib/email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.object({
  fulfillmentId: z.string().uuid(),
  status: z.enum(["processing", "shipped"])
});

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 12, 60_000)) return json({ error: "Fulfilment updates are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await getAuthenticatedSupabase(request);
    const { data, error } = await client.rpc("update_vendor_fulfillment_status", { p_fulfillment_id: input.fulfillmentId, p_status: input.status });
    if (error?.message.includes("SELLER_ACCESS_REQUIRED")) return json({ error: "Approved seller access is required." }, 403);
    if (error?.message.includes("FULFILLMENT_NOT_FOUND")) return json({ error: "This fulfilment is unavailable." }, 404);
    if (error?.message.includes("INVALID_FULFILLMENT_STATUS_TRANSITION")) return json({ error: "That fulfilment update is not allowed. Refresh and try again." }, 409);
    if (error) throw error;

    const fulfillment = data as { id: string; order_request_id: string; store_name: string; status: "processing" | "shipped" };
    const order = await admin.from("order_requests").select("public_reference").eq("id", fulfillment.order_request_id).single();
    if (order.error) throw order.error;
    await sendTrackedEmail(admin, `vendor-fulfillment:${fulfillment.id}:${fulfillment.status}`, "vendor-fulfillment-status", {
      to: notificationEmail(),
      subject: `${fulfillment.store_name} marked ${order.data.public_reference} ${fulfillment.status}`,
      heading: `Vendor fulfilment ${fulfillment.status}`,
      message: "A vendor updated its part of a marketplace order. Review the master order before updating the customer-facing status.",
      details: [{ label: "Reference", value: order.data.public_reference }, { label: "Store", value: fulfillment.store_name }, { label: "Status", value: fulfillment.status }],
      action: { label: "Open admin orders", url: "https://fieldio.shop/admin" }
    });
    return json({ fulfillment });
  } catch (error) { return handleApiError(error); }
}
