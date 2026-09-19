import { z } from "zod";
import { sendTransactionalEmail } from "./_lib/email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.object({ applicationId: z.string().uuid(), decision: z.enum(["approved", "rejected", "suspended"]), reason: z.string().trim().max(1000).nullable().optional() }).superRefine((value, context) => {
  if (value.decision !== "approved" && !value.reason) context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required." });
});

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 10, 60_000)) return json({ error: "Review requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { client } = await getAuthenticatedSupabase(request);
    const { data, error } = await client.rpc("review_seller_application", { p_application_id: input.applicationId, p_decision: input.decision, p_reason: input.reason || null });
    if (error) {
      if (error.message.includes("Not authorised")) return json({ error: "You are not authorised to review sellers." }, 403);
      if (error.message.includes("not reviewable")) return json({ error: "This application has already been reviewed. Refresh the queue." }, 409);
      throw error;
    }
    const application = data as { contact_email?: string; legal_name?: string; review_reason?: string | null };
    const approved = input.decision === "approved";
    await sendTransactionalEmail({
      to: application.contact_email ?? "",
      subject: approved ? "Your Fieldio seller account is approved" : `Fieldio seller verification ${input.decision}`,
      heading: approved ? "You are approved to sell on Fieldio" : `Your seller verification was ${input.decision}`,
      message: approved ? "You can now create your store and submit products for review." : "Sign in to review the decision and update your information if required.",
      details: application.review_reason ? [{ label: "Reason", value: application.review_reason }] : []
    });
    return json({ application: data });
  } catch (error) { return handleApiError(error); }
}
