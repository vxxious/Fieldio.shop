import { z } from "zod";
import { notificationEmail, sendTransactionalEmail } from "./_lib/email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.object({ listingId: z.string().uuid() });

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 8, 60_000)) return json({ error: "Requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client } = await getAuthenticatedSupabase(request);
    const { data, error } = await client.rpc("submit_seller_listing", { p_listing_id: input.listingId });
    if (error) {
      if (error.message.includes("cannot be submitted")) return json({ error: "This listing has already been submitted. Refresh the page." }, 409);
      if (error.message.includes("at least one")) return json({ error: "Add at least one product image before submitting." }, 409);
      throw error;
    }
    const listing = data as { id?: string; title?: string; store_id?: string };
    const { data: store } = listing.store_id ? await admin.from("seller_stores").select("name,contact_email").eq("id", listing.store_id).maybeSingle() : { data: null };
    await Promise.all([
      sendTransactionalEmail({ to: store?.contact_email ?? "", subject: "Fieldio listing received", heading: `${listing.title ?? "Your product"} is under review`, message: "Fieldio will check the product details, condition, ownership, and images before publication." }),
      sendTransactionalEmail({ to: notificationEmail(), replyTo: store?.contact_email, subject: "New Fieldio product listing", heading: "New product listing", message: "A seller listing is ready for review.", details: [{ label: "Store", value: store?.name ?? "Unknown" }, { label: "Product", value: listing.title ?? "Unknown" }, { label: "Listing", value: listing.id ?? input.listingId }] })
    ]);
    return json({ listing: data });
  } catch (error) { return handleApiError(error); }
}
