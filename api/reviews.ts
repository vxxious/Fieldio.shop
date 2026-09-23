import { z } from "zod";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./_lib/server.js";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete-review"), reviewId: z.string().uuid() }),
  z.object({ action: z.literal("delete-image"), imageId: z.string().uuid() })
]);

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 30, 60_000)) return json({ error: "Too many review changes. Try again shortly." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    const { admin, user } = await getAuthenticatedSupabase(request);
    if (input.action === "delete-review") {
      const review = await admin.from("product_reviews").select("id,buyer_id,images:product_review_images(storage_path)").eq("id", input.reviewId).eq("buyer_id", user.id).maybeSingle();
      if (review.error) throw review.error;
      if (!review.data) return json({ error: "Review not found." }, 404);
      const paths = (review.data.images as Array<{ storage_path: string }> | null)?.map(({ storage_path }) => storage_path) ?? [];
      if (paths.length) { const removed = await admin.storage.from("review-media").remove(paths); if (removed.error) throw removed.error; }
      const deleted = await admin.from("product_reviews").delete().eq("id", input.reviewId).eq("buyer_id", user.id);
      if (deleted.error) throw deleted.error;
      return json({ deleted: true });
    }
    const image = await admin.from("product_review_images").select("id,buyer_id,storage_path").eq("id", input.imageId).eq("buyer_id", user.id).maybeSingle();
    if (image.error) throw image.error;
    if (!image.data) return json({ error: "Review photo not found." }, 404);
    const removed = await admin.storage.from("review-media").remove([image.data.storage_path]);
    if (removed.error) throw removed.error;
    const deleted = await admin.from("product_review_images").delete().eq("id", input.imageId).eq("buyer_id", user.id);
    if (deleted.error) throw deleted.error;
    return json({ deleted: true });
  } catch (error) { return handleApiError(error); }
}
