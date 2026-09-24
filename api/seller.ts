import { z } from "zod";
import { notificationEmail, sendTrackedEmail } from "./_lib/email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const countryCode = z.string().regex(/^[A-Z]{2}$/);
const internationalPhone = z.string().regex(/^\+[1-9][0-9]{6,14}$/);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit-application") }),
  z.object({ action: z.literal("update-fulfillment"), fulfillmentId: z.string().uuid(), status: z.enum(["processing", "shipped"]) }),
  z.object({ action: z.literal("review-application"), applicationId: z.string().uuid(), decision: z.enum(["approved", "rejected", "suspended"]), reason: z.string().trim().max(1000).nullable().optional() }).superRefine((value, context) => {
    if (value.decision !== "approved" && !value.reason) context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required." });
  }),
  z.object({ action: z.literal("submit-listing"), listingId: z.string().uuid() }),
  z.object({
    action: z.literal("create-store"),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(20).max(2000),
    contactEmail: z.string().trim().email().max(254),
    phoneCountryCode: countryCode,
    phone: internationalPhone,
    whatsappCountryCode: countryCode,
    whatsappPhone: internationalPhone
  })
]);

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 10, 60_000)) return json({ error: "Requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, client, user } = await getAuthenticatedSupabase(request);

    if (input.action === "update-fulfillment") {
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
    }

    if (input.action === "create-store") {
      const slug = `${slugify(input.name) || "store"}-${user.id.slice(0, 6)}`;
      const { data, error } = await client.from("seller_stores").insert({ owner_id: user.id, name: input.name, slug, description: input.description, contact_email: input.contactEmail, contact_phone_country_code: input.phoneCountryCode, contact_phone: input.phone, contact_whatsapp_country_code: input.whatsappCountryCode, contact_whatsapp_phone: input.whatsappPhone }).select("id,name,slug,description,contact_email,contact_phone_country_code,contact_phone,contact_whatsapp_country_code,contact_whatsapp_phone,status").single();
      if (error?.code === "23505") return json({ error: "You already have a store, or that store name is unavailable." }, 409);
      if (error?.code === "42501") return json({ error: "Seller approval is required before creating a store." }, 403);
      if (error) throw error;
      await Promise.all([
        sendTrackedEmail(admin, `store:${data.id}:seller`, "store-ready", { to: data.contact_email, subject: "Your Fieldio store is ready", heading: `${data.name} is ready`, message: "Your store has been created. You can now add products and submit them to Fieldio for review.", details: [{ label: "Store", value: data.name }], action: { label: "Open seller dashboard", url: "https://fieldio.shop/sell" } }),
        sendTrackedEmail(admin, `store:${data.id}:admin`, "admin-store-created", { to: notificationEmail(), replyTo: data.contact_email, subject: "New Fieldio seller store", heading: "A seller created a store", message: "A verified seller has created a new store on Fieldio.", details: [{ label: "Store", value: data.name }, { label: "Contact", value: data.contact_email }], action: { label: "Open admin", url: "https://fieldio.shop/admin" } })
      ]);
      return json({ store: data }, 201);
    }

    if (input.action === "submit-application") {
      const { data, error } = await client.rpc("submit_seller_application");
      if (error?.message.includes("cannot be submitted")) return json({ error: "This application has already been submitted. Refresh the page." }, 409);
      if (error) throw error;
      const application = data as { contact_email?: string; legal_name?: string; kind?: string; id?: string; submitted_at?: string };
      const event = `seller-application:${application.id ?? "unknown"}:submitted:${application.submitted_at ?? "unknown"}`;
      await Promise.all([
        sendTrackedEmail(admin, `${event}:seller`, "seller-verification-received", { to: application.contact_email ?? "", subject: "Fieldio seller verification received", heading: "Your verification is under review", message: "Fieldio will review your identity, contact information, and seller details before your store can publish products.", action: { label: "View verification", url: "https://fieldio.shop/sell" } }),
        sendTrackedEmail(admin, `${event}:admin`, "admin-seller-verification", { to: notificationEmail(), replyTo: application.contact_email, subject: "New Fieldio seller verification", heading: "New seller verification", message: "A seller application is ready for review.", details: [{ label: "Applicant", value: application.legal_name ?? "Not supplied" }, { label: "Type", value: application.kind ?? "seller" }, { label: "Application", value: application.id ?? "Unknown" }], action: { label: "Review seller", url: "https://fieldio.shop/admin" } })
      ]);
      return json({ application: data });
    }

    if (input.action === "review-application") {
      const { data, error } = await client.rpc("review_seller_application", { p_application_id: input.applicationId, p_decision: input.decision, p_reason: input.reason || null });
      if (error?.message.includes("Not authorised")) return json({ error: "You are not authorised to review sellers." }, 403);
      if (error?.message.includes("not reviewable")) return json({ error: "This application has already been reviewed. Refresh the queue." }, 409);
      if (error) throw error;
      const application = data as { id?: string; contact_email?: string; review_reason?: string | null; reviewed_at?: string };
      const approved = input.decision === "approved";
      await sendTrackedEmail(admin, `seller-application:${application.id ?? input.applicationId}:${input.decision}:${application.reviewed_at ?? "unknown"}`, "seller-verification-decision", { to: application.contact_email ?? "", subject: approved ? "Your Fieldio seller account is approved" : `Fieldio seller verification ${input.decision}`, heading: approved ? "You are approved to sell on Fieldio" : `Your seller verification was ${input.decision}`, message: approved ? "You can now create your store and submit products for review." : "Sign in to review the decision and update your information if required.", details: application.review_reason ? [{ label: "Reason", value: application.review_reason }] : [], action: { label: approved ? "Create your store" : "Review your verification", url: "https://fieldio.shop/sell" } });
      return json({ application: data });
    }

    const { data, error } = await client.rpc("submit_seller_listing", { p_listing_id: input.listingId });
    if (error?.message.includes("cannot be submitted")) return json({ error: "This listing has already been submitted. Refresh the page." }, 409);
    if (error?.message.includes("at least one")) return json({ error: "Add at least one product image before submitting." }, 409);
    if (error) throw error;
    const listing = data as { id?: string; title?: string; store_id?: string; submitted_at?: string };
    const { data: store } = listing.store_id ? await admin.from("seller_stores").select("name,contact_email").eq("id", listing.store_id).maybeSingle() : { data: null };
    const event = `seller-listing:${listing.id ?? input.listingId}:submitted:${listing.submitted_at ?? "unknown"}`;
    await Promise.all([
      sendTrackedEmail(admin, `${event}:seller`, "listing-received", { to: store?.contact_email ?? "", subject: "Fieldio listing received", heading: `${listing.title ?? "Your product"} is under review`, message: "Fieldio will check the product details, condition, ownership, and images before publication.", action: { label: "View your listings", url: "https://fieldio.shop/sell" } }),
      sendTrackedEmail(admin, `${event}:admin`, "admin-listing-submitted", { to: notificationEmail(), replyTo: store?.contact_email, subject: "New Fieldio product listing", heading: "New product listing", message: "A seller listing is ready for review.", details: [{ label: "Store", value: store?.name ?? "Unknown" }, { label: "Product", value: listing.title ?? "Unknown" }, { label: "Listing", value: listing.id ?? input.listingId }], action: { label: "Review listing", url: "https://fieldio.shop/admin" } })
    ]);
    return json({ listing: data });
  } catch (error) { return handleApiError(error); }
}
