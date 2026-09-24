import { z } from "zod";
import { requireStaff } from "./admin.js";
import { sendTrackedEmail } from "./email.js";
import { checkRateLimit, handleApiError, json, readValidatedJson } from "./server.js";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), sellerOwnerId: z.string().uuid(), currency: z.string().regex(/^[A-Z]{3}$/) }),
  z.object({ action: z.literal("update"), payoutId: z.string().uuid(), status: z.enum(["approved", "paid", "failed", "cancelled"]), reference: z.string().trim().max(160).optional().nullable() })
]);

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 15, 60_000)) return json({ error: "Payout actions are temporarily limited." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await requireStaff(request, ["owner", "admin"]);
    if (input.action === "create") {
      const { data, error } = await client.rpc("create_seller_payout", { p_seller_owner_id: input.sellerOwnerId, p_currency: input.currency });
      if (error?.message.includes("NO_ELIGIBLE_FULFILLMENTS")) return json({ error: "No eligible delivered fulfilments remain for this seller." }, 409);
      if (error) throw error;
      return json({ payout: data }, 201);
    }
    const { data, error } = await client.rpc("update_seller_payout", { p_payout_id: input.payoutId, p_status: input.status, p_reference: input.reference || null });
    if (error?.message.includes("PAYOUT_REFERENCE_REQUIRED")) return json({ error: "Enter the payment reference before marking this payout paid." }, 400);
    if (error?.message.includes("INVALID_PAYOUT_TRANSITION")) return json({ error: "That payout status change is not allowed. Refresh and try again." }, 409);
    if (error) throw error;
    const payout = data as { id: string; seller_owner_id: string; status: string; amount: number; currency: string; reference: string | null };
    const { data: seller } = await admin.from("seller_applications").select("contact_email,legal_name").eq("owner_id", payout.seller_owner_id).eq("status", "approved").maybeSingle();
    if (seller?.contact_email) await sendTrackedEmail(admin, `payout:${payout.id}:${payout.status}`, "seller-payout-status", { to: seller.contact_email, subject: `Fieldio payout ${payout.status}`, heading: `Your payout is ${payout.status}`, message: payout.status === "paid" ? "Fieldio has recorded this seller payout as paid." : `Fieldio updated your seller payout to ${payout.status}.`, details: [{ label: "Amount", value: `${payout.currency} ${(payout.amount / 100).toFixed(2)}` }, ...(payout.reference ? [{ label: "Reference", value: payout.reference }] : [])], action: { label: "Open seller dashboard", url: "https://fieldio.shop/sell" } });
    return json({ payout });
  } catch (error) { return handleApiError(error); }
}
