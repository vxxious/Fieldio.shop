import { z } from "zod";
import { notificationEmail, sendTransactionalEmail } from "./_lib/email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.object({}).strict();

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 5, 60_000)) return json({ error: "Requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    await readValidatedJson(request, schema);
    const { client } = await getAuthenticatedSupabase(request);
    const { data, error } = await client.rpc("submit_seller_application");
    if (error) {
      if (error.message.includes("cannot be submitted")) return json({ error: "This application has already been submitted. Refresh the page." }, 409);
      throw error;
    }
    const application = data as { contact_email?: string; legal_name?: string; kind?: string; id?: string };
    await Promise.all([
      sendTransactionalEmail({ to: application.contact_email ?? "", subject: "Fieldio seller verification received", heading: "Your verification is under review", message: "Fieldio will review your identity, contact information, and seller details before your store can publish products." }),
      sendTransactionalEmail({ to: notificationEmail(), replyTo: application.contact_email, subject: "New Fieldio seller verification", heading: "New seller verification", message: "A seller application is ready for review.", details: [{ label: "Applicant", value: application.legal_name ?? "Not supplied" }, { label: "Type", value: application.kind ?? "seller" }, { label: "Application", value: application.id ?? "Unknown" }] })
    ]);
    return json({ application: data });
  } catch (error) { return handleApiError(error); }
}
