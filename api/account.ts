import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.object({ action: z.literal("delete-account"), confirmation: z.literal("DELETE") });

async function removeFiles(database: SupabaseClient, bucket: string, paths: Array<string | null | undefined>) {
  const files = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!files.length) return;
  const { error } = await database.storage.from(bucket).remove(files);
  if (error) throw error;
}

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 3, 3_600_000)) return json({ error: "Too many deletion attempts. Wait before trying again." }, 429);
  try {
    await readValidatedJson(request, schema);
    const { admin, user } = await getAuthenticatedSupabase(request);
    const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
    if (!signedInAt || Date.now() - signedInAt > 15 * 60_000) return json({ error: "For security, sign out and sign in again before deleting your account." }, 403);

    const { data: staff, error: staffError } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (staffError) throw staffError;
    if (staff) return json({ error: "Staff accounts must be removed by another account owner." }, 403);

    const [application, listingImages, listings] = await Promise.all([
      admin.from("seller_applications").select("identity_document_path,address_document_path,business_document_path").eq("owner_id", user.id).maybeSingle(),
      admin.from("seller_listing_images").select("storage_path").eq("owner_id", user.id),
      admin.from("seller_listings").select("id").eq("owner_id", user.id)
    ]);
    if (application.error || listingImages.error || listings.error) throw application.error || listingImages.error || listings.error;

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
