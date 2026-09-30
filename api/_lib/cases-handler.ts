import { z } from "zod";
import { requireStaff } from "./admin.js";
import { sendTrackedEmail } from "./email.js";
import { checkRateLimit, handleApiError, json, readValidatedJson } from "./server.js";

const schema = z.object({
  caseType: z.enum(["return", "dispute"]),
  id: z.string().uuid(),
  status: z.string().min(2).max(30),
  resolution: z.string().trim().max(2000).optional().nullable(),
  payoutResolution: z.enum(["release", "refund", "keep_held"]).optional().nullable()
});

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 20, 60_000)) return json({ error: "Case updates are temporarily limited." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await requireStaff(request, ["owner", "admin", "fulfilment"]);
    const { data, error } = await client.rpc("update_marketplace_case", { p_case_type: input.caseType, p_case_id: input.id, p_status: input.status, p_resolution: input.resolution || null, p_payout_resolution: input.payoutResolution || null });
    if (error?.message.includes("CASE_NOT_FOUND")) return json({ error: "Case not found." }, 404);
    if (error?.message.includes("INVALID_CASE_TRANSITION")) return json({ error: "That case status change is not allowed. Refresh and try again." }, 409);
    if (error?.message.includes("CASE_RESOLUTION_REQUIRED")) return json({ error: "Add a resolution before closing this stage." }, 400);
    if (error?.message.includes("PAYOUT_RESOLUTION_REQUIRED")) return json({ error: "Choose whether to release, refund, or keep the seller payout held." }, 400);
    if (error?.message.includes("PAYOUT_DECISION_NOT_ALLOWED")) return json({ error: "Choose a payout decision only when resolving or closing the case." }, 400);
    if (error?.message.includes("PAYOUT_RESOLUTION_IMMUTABLE")) return json({ error: "The recorded payout decision cannot be rewritten." }, 409);
    if (error?.message.includes("PAYOUT_DECISION_ACCESS_REQUIRED")) return json({ error: "Only a finance administrator can release, refund, or retain a payout hold." }, 403);
    if (error?.message.includes("REJECTED_CASE_MUST_RELEASE_PAYOUT")) return json({ error: "A rejected case must release the seller payout hold." }, 400);
    if (error?.message.includes("REFUNDED_RETURN_MUST_ADJUST_PAYOUT")) return json({ error: "A refunded return must record a payout refund adjustment." }, 400);
    if (error) throw error;
    const updated = data as { id: string; status: string; order_request_id: string; resolution: string | null };
    const { data: order, error: orderError } = await admin.from("order_requests").select("public_reference,customer_email").eq("id", updated.order_request_id).single();
    if (orderError) throw orderError;
    await sendTrackedEmail(admin, `${input.caseType}:${updated.id}:${updated.status}`, `${input.caseType}-status`, { to: order.customer_email, subject: `Fieldio ${input.caseType} update - ${order.public_reference}`, heading: `Your ${input.caseType} is ${updated.status.replaceAll("_", " ")}`, message: updated.resolution || "Fieldio has updated your case. Sign in to review your order or contact us if you need help.", details: [{ label: "Order", value: order.public_reference }, { label: "Status", value: updated.status.replaceAll("_", " ") }], action: { label: "View your order", url: "https://fieldio.shop/account" } });
    return json({ case: updated });
  } catch (error) { return handleApiError(error); }
}
