import { z } from "zod";
import { requireStaff } from "./admin.js";
import { sendTrackedEmail } from "./email.js";
import { checkRateLimit, handleApiError, json, readValidatedJson } from "./server.js";

const schema = z.object({ caseType: z.enum(["return", "dispute"]), id: z.string().uuid(), status: z.string().min(2).max(30), resolution: z.string().trim().max(2000).optional().nullable() });
const transitions: Record<"return" | "dispute", Record<string, string[]>> = {
  return: { requested: ["approved", "rejected"], approved: ["in_transit", "closed"], in_transit: ["received"], received: ["refunded", "closed"], refunded: ["closed"], rejected: ["closed"], closed: [] },
  dispute: { open: ["reviewing", "rejected"], reviewing: ["resolved", "rejected", "closed"], resolved: ["closed"], rejected: ["closed"], closed: [] }
};

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 20, 60_000)) return json({ error: "Case updates are temporarily limited." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await requireStaff(request, ["owner", "admin", "fulfilment"]);
    const table = input.caseType === "return" ? "marketplace_returns" : "marketplace_disputes";
    const { data: current, error } = await admin.from(table).select("id,status,order_request_id").eq("id", input.id).single();
    if (error || !current) return json({ error: "Case not found." }, 404);
    if (!transitions[input.caseType][current.status]?.includes(input.status)) return json({ error: "That case status change is not allowed. Refresh and try again." }, 409);
    if (["rejected", "resolved", "refunded", "closed"].includes(input.status) && !input.resolution) return json({ error: "Add a resolution before closing this stage." }, 400);
    const { data, error: updateError } = await client.from(table).update({ status: input.status, resolution: input.resolution || null }).eq("id", input.id).select("id,status,order_request_id,resolution").single();
    if (updateError) throw updateError;
    const { data: order, error: orderError } = await admin.from("order_requests").select("public_reference,customer_email").eq("id", current.order_request_id).single();
    if (orderError) throw orderError;
    await sendTrackedEmail(admin, `${input.caseType}:${data.id}:${data.status}`, `${input.caseType}-status`, { to: order.customer_email, subject: `Fieldio ${input.caseType} update - ${order.public_reference}`, heading: `Your ${input.caseType} is ${data.status.replaceAll("_", " ")}`, message: data.resolution || "Fieldio has updated your case. Sign in to review your order or contact us if you need help.", details: [{ label: "Order", value: order.public_reference }, { label: "Status", value: data.status.replaceAll("_", " ") }], action: { label: "View your order", url: "https://fieldio.shop/account" } });
    return json({ case: data });
  } catch (error) { return handleApiError(error); }
}
