import { z } from "zod";
import { notificationEmail, sendTransactionalEmail } from "./_lib/email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit-application") }),
  z.object({ action: z.literal("review-application"), applicationId: z.string().uuid(), decision: z.enum(["approved", "rejected", "suspended"]), reason: z.string().trim().max(1000).nullable().optional() }).superRefine((value, context) => {
    if (value.decision !== "approved" && !value.reason) context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required." });
  }),
  z.object({ action: z.literal("submit-listing"), listingId: z.string().uuid() })
]);

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 10, 60_000)) return json({ error: "Requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await getAuthenticatedSupabase(request);

    if (input.action === "submit-application") {
      const { data, error } = await client.rpc("submit_seller_application");
      if (error?.message.includes("cannot be submitted")) return json({ error: "This application has already been submitted. Refresh the page." }, 409);
      if (error) throw error;
      const application = data as { contact_email?: string; legal_name?: string; kind?: string; id?: string };
      await Promise.all([
        sendTransactionalEmail({ to: application.contact_email ?? "", subject: "Fieldio seller verification received", heading: "Your verification is under review", message: "Fieldio will review your identity, contact information, and seller details before your store can publish products." }),
        sendTransactionalEmail({ to: notificationEmail(), replyTo: application.contact_email, subject: "New Fieldio seller verification", heading: "New seller verification", message: "A seller application is ready for review.", details: [{ label: "Applicant", value: application.legal_name ?? "Not supplied" }, { label: "Type", value: application.kind ?? "seller" }, { label: "Application", value: application.id ?? "Unknown" }] })
      ]);
      return json({ application: data });
    }

    if (input.action === "review-application") {
      const { data, error } = await client.rpc("review_seller_application", { p_application_id: input.applicationId, p_decision: input.decision, p_reason: input.reason || null });
      if (error?.message.includes("Not authorised")) return json({ error: "You are not authorised to review sellers." }, 403);
      if (error?.message.includes("not reviewable")) return json({ error: "This application has already been reviewed. Refresh the queue." }, 409);
      if (error) throw error;
      const application = data as { contact_email?: string; review_reason?: string | null };
      const approved = input.decision === "approved";
      await sendTransactionalEmail({ to: application.contact_email ?? "", subject: approved ? "Your Fieldio seller account is approved" : `Fieldio seller verification ${input.decision}`, heading: approved ? "You are approved to sell on Fieldio" : `Your seller verification was ${input.decision}`, message: approved ? "You can now create your store and submit products for review." : "Sign in to review the decision and update your information if required.", details: application.review_reason ? [{ label: "Reason", value: application.review_reason }] : [] });
      return json({ application: data });
    }

    const { data, error } = await client.rpc("submit_seller_listing", { p_listing_id: input.listingId });
    if (error?.message.includes("cannot be submitted")) return json({ error: "This listing has already been submitted. Refresh the page." }, 409);
    if (error?.message.includes("at least one")) return json({ error: "Add at least one product image before submitting." }, 409);
    if (error) throw error;
    const listing = data as { id?: string; title?: string; store_id?: string };
    const { data: store } = listing.store_id ? await admin.from("seller_stores").select("name,contact_email").eq("id", listing.store_id).maybeSingle() : { data: null };
    await Promise.all([
      sendTransactionalEmail({ to: store?.contact_email ?? "", subject: "Fieldio listing received", heading: `${listing.title ?? "Your product"} is under review`, message: "Fieldio will check the product details, condition, ownership, and images before publication." }),
      sendTransactionalEmail({ to: notificationEmail(), replyTo: store?.contact_email, subject: "New Fieldio product listing", heading: "New product listing", message: "A seller listing is ready for review.", details: [{ label: "Store", value: store?.name ?? "Unknown" }, { label: "Product", value: listing.title ?? "Unknown" }, { label: "Listing", value: listing.id ?? input.listingId }] })
    ]);
    return json({ listing: data });
  } catch (error) { return handleApiError(error); }
}
