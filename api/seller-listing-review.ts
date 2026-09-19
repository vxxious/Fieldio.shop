import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendTransactionalEmail } from "./_lib/email.js";
import { checkRateLimit, getAdminSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.object({
  listingId: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "suspended"]),
  reason: z.string().trim().max(1000).nullable().optional()
}).superRefine((value, context) => {
  if (value.decision !== "approved" && !value.reason) context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required." });
});

const imageTypes: Record<string, string> = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 10, 60_000)) return json({ error: "Review requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const admin = getAdminSupabase();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!admin || !url || !key) return json({ error: "Listing review is temporarily unavailable." }, 503);

    const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) return json({ error: "Sign in again to review this listing." }, 401);
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Your session has expired. Sign in again." }, 401);
    const { data: administrator } = await admin.from("admin_users").select("role").eq("user_id", auth.user.id).maybeSingle();
    if (!administrator || !["owner", "admin"].includes(administrator.role)) return json({ error: "You are not authorised to review listings." }, 403);

    const published: Array<{ storage_path: string; public_url: string; alt_text: string; position: number }> = [];
    if (input.decision === "approved") {
      const { data: images, error: imageQueryError } = await admin.from("seller_listing_images").select("storage_path,alt_text,position").eq("listing_id", input.listingId).order("position");
      if (imageQueryError) throw imageQueryError;
      if (!images?.length) return json({ error: "This listing needs at least one image before approval." }, 409);
      for (const image of images) {
        const extension = image.storage_path.split(".").pop()?.toLowerCase() ?? "";
        const contentType = imageTypes[extension];
        if (!contentType) return json({ error: "A listing image has an unsupported file type." }, 409);
        const source = await admin.storage.from("seller-listing-media").download(image.storage_path);
        if (source.error) throw source.error;
        if (source.data.size > 10 * 1024 * 1024) return json({ error: "A listing image exceeds the 10 MB limit." }, 409);
        const path = `seller/${input.listingId}/${image.position}.${extension === "jpeg" ? "jpg" : extension}`;
        const upload = await admin.storage.from("product-images").upload(path, source.data, { contentType, upsert: true });
        if (upload.error) throw upload.error;
        published.push({ storage_path: path, public_url: admin.storage.from("product-images").getPublicUrl(path).data.publicUrl, alt_text: image.alt_text, position: image.position });
      }
    }

    const userClient = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await userClient.rpc("review_seller_listing", { p_listing_id: input.listingId, p_decision: input.decision, p_reason: input.reason || null, p_public_images: published });
    if (error) {
      if (error.message.includes("not pending")) return json({ error: "This listing has already been reviewed. Refresh the queue." }, 409);
      if (error.message.includes("Not authorised")) return json({ error: "You are not authorised to review listings." }, 403);
      throw error;
    }
    const listing = data as { store_id?: string; title?: string; review_reason?: string | null };
    const { data: store } = listing.store_id ? await admin.from("seller_stores").select("contact_email").eq("id", listing.store_id).maybeSingle() : { data: null };
    const approved = input.decision === "approved";
    await sendTransactionalEmail({
      to: store?.contact_email ?? "",
      subject: approved ? "Your Fieldio listing is live" : `Fieldio listing ${input.decision}`,
      heading: approved ? `${listing.title ?? "Your product"} is now live` : `${listing.title ?? "Your product"} was ${input.decision}`,
      message: approved ? "Customers can now discover the product in the Fieldio catalogue." : "Sign in to review the decision and update the listing if required.",
      details: listing.review_reason ? [{ label: "Reason", value: listing.review_reason }] : []
    });
    return json({ listing: data });
  } catch (error) { return handleApiError(error); }
}
