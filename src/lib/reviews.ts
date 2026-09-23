import { z } from "zod";

export const REVIEW_TAGS = ["perfect_fit", "good_quality", "comfortable", "true_to_description", "beautiful_design", "fast_delivery"] as const;
export type ReviewTag = typeof REVIEW_TAGS[number];

export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  perfect_fit: "Perfect fit",
  good_quality: "Good quality",
  comfortable: "Comfortable",
  true_to_description: "True to description",
  beautiful_design: "Beautiful design",
  fast_delivery: "Fast delivery"
};

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Choose a star rating.").max(5),
  reviewText: z.string().trim().min(20, "Write at least 20 characters.").max(3000, "Keep your review under 3,000 characters."),
  tags: z.array(z.enum(REVIEW_TAGS)).max(3, "Choose up to three details.")
});

export const REVIEW_MAX_IMAGES = 5;
export const REVIEW_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const REVIEW_MAX_STORED_BYTES = 5 * 1024 * 1024;
export const REVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function reviewImageError(file: Pick<File, "type" | "size">): string | null {
  if (!REVIEW_IMAGE_TYPES.includes(file.type)) return "Use a JPG, PNG, WebP, or AVIF image.";
  if (file.size > REVIEW_MAX_SOURCE_BYTES) return "Each source photo must be 8 MB or smaller.";
  return null;
}

export async function optimizeReviewImage(file: File): Promise<File> {
  const validationError = reviewImageError(file);
  if (validationError) throw new Error(validationError);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("This browser could not prepare the photo."); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob || blob.size > REVIEW_MAX_STORED_BYTES) throw new Error("The optimized photo is still too large. Try a smaller image.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "review"}.webp`, { type: "image/webp" });
}

export function reviewVariantLabel(review: { purchased_variant?: string | null; purchased_size?: string | null; purchased_color?: string | null }): string {
  return [review.purchased_size && `Size ${review.purchased_size}`, review.purchased_color && `Color ${review.purchased_color}`, !review.purchased_size && !review.purchased_color && review.purchased_variant].filter(Boolean).join(" · ");
}
