import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";
import { POST as handleOrderSupport } from "./_lib/order-support-handler.js";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete-account"), confirmation: z.literal("DELETE") }),
  z.object({ action: z.literal("delete-review"), reviewId: z.string().uuid() }),
  z.object({ action: z.literal("delete-image"), imageId: z.string().uuid() })
]);

async function removeFiles(database: SupabaseClient, bucket: string, paths: Array<string | null | undefined>) {
  const files = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!files.length) return;
  const { error } = await database.storage.from(bucket).remove(files);
  if (error) throw error;
}

export async function POST(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get("mode") === "support") return handleOrderSupport(request);
  try {
    const input = await readValidatedJson(request, schema);
    const accountDeletion = input.action === "delete-account";
    if (!await checkRateLimit(request, accountDeletion ? 3 : 30, accountDeletion ? 3_600_000 : 60_000)) {
      return json({ error: accountDeletion ? "Too many deletion attempts. Wait before trying again." : "Too many review changes. Try again shortly." }, 429);
    }
    const { admin, user } = await getAuthenticatedSupabase(request);
    if (input.action === "delete-review") {
      const review = await admin.from("product_reviews").select("id,buyer_id,images:product_review_images(storage_path)").eq("id", input.reviewId).eq("buyer_id", user.id).maybeSingle();
      if (review.error) throw review.error;
      if (!review.data) return json({ error: "Review not found." }, 404);
      await removeFiles(admin, "review-media", (review.data.images as Array<{ storage_path: string }> | null)?.map(({ storage_path }) => storage_path) ?? []);
      const deleted = await admin.from("product_reviews").delete().eq("id", input.reviewId).eq("buyer_id", user.id);
      if (deleted.error) throw deleted.error;
      return json({ deleted: true });
    }
    if (input.action === "delete-image") {
      const image = await admin.from("product_review_images").select("id,buyer_id,storage_path").eq("id", input.imageId).eq("buyer_id", user.id).maybeSingle();
      if (image.error) throw image.error;
      if (!image.data) return json({ error: "Review photo not found." }, 404);
      await removeFiles(admin, "review-media", [image.data.storage_path]);
      const deleted = await admin.from("product_review_images").delete().eq("id", input.imageId).eq("buyer_id", user.id);
      if (deleted.error) throw deleted.error;
      return json({ deleted: true });
    }
    const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
    if (!signedInAt || Date.now() - signedInAt > 15 * 60_000) return json({ error: "For security, sign out and sign in again before deleting your account." }, 403);

    const { data: staff, error: staffError } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (staffError) throw staffError;
    if (staff) return json({ error: "Staff accounts must be removed by another account owner." }, 403);

    const [application, listingImages, listings, reviewImages] = await Promise.all([
      admin.from("seller_applications").select("identity_document_path,address_document_path,business_document_path").eq("owner_id", user.id).maybeSingle(),
      admin.from("seller_listing_images").select("storage_path").eq("owner_id", user.id),
      admin.from("seller_listings").select("id").eq("owner_id", user.id),
      admin.from("product_review_images").select("storage_path").eq("buyer_id", user.id)
    ]);
    if (application.error || listingImages.error || listings.error || reviewImages.error) throw application.error || listingImages.error || listings.error || reviewImages.error;

    const listingIds = (listings.data ?? []).map(({ id }) => id);
    const products = listingIds.length ? await admin.from("products").select("id").in("seller_listing_id", listingIds) : { data: [], error: null };
    if (products.error) throw products.error;
    const productIds = (products.data ?? []).map(({ id }) => id);
    const productImages = productIds.length ? await admin.from("product_images").select("storage_path").in("product_id", productIds) : { data: [], error: null };
    if (productImages.error) throw productImages.error;

    await Promise.all([
      removeFiles(admin, "seller-verification", [application.data?.identity_document_path, application.data?.address_document_path, application.data?.business_document_path]),
      removeFiles(admin, "seller-listing-media", (listingImages.data ?? []).map(({ storage_path }) => storage_path)),
      removeFiles(admin, "product-images", (productImages.data ?? []).map(({ storage_path }) => storage_path)),
      removeFiles(admin, "review-media", (reviewImages.data ?? []).map(({ storage_path }) => storage_path)),
      removeFiles(admin, "profile-media", [`${user.id}/avatar`, `${user.id}/store-logo`])
    ]);

    const anonymousEmail = `deleted+${user.id}@fieldio.invalid`;
    const cleanup = await Promise.all([
      productIds.length ? admin.from("products").delete().in("id", productIds) : Promise.resolve({ error: null }),
      admin.from("order_requests").update({ user_id: null, customer_name: "Deleted customer", customer_phone: "Deleted", customer_email: anonymousEmail, shipping_address: "Deleted", customer_note: null }).eq("user_id", user.id),
      admin.from("wholesale_inquiries").update({ user_id: null, name: "Deleted customer", email: anonymousEmail, phone: null, company: null, message: "Deleted" }).eq("user_id", user.id),
      user.email ? admin.from("newsletter_subscribers").delete().ilike("email", user.email) : Promise.resolve({ error: null }),
      user.email ? admin.from("notification_deliveries").delete().ilike("recipient_email", user.email) : Promise.resolve({ error: null })
    ]);
    const cleanupError = cleanup.find(({ error }) => error)?.error;
    if (cleanupError) throw cleanupError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
