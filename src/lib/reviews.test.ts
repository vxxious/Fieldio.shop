import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { reviewImageError, reviewSchema, reviewVariantLabel, signReviewImages } from "./reviews";

describe("review validation", () => {
  it("requires a real rating and useful review text", () => {
    expect(reviewSchema.safeParse({ rating: 0, reviewText: "Too short", tags: [] }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 5, reviewText: "The item arrived exactly as described.", tags: ["good_quality"] }).success).toBe(true);
  });

  it("rejects unsupported or oversized photos", () => {
    expect(reviewImageError({ type: "image/gif", size: 10 })).toMatch(/JPG/);
    expect(reviewImageError({ type: "image/jpeg", size: 9 * 1024 * 1024 })).toMatch(/8 MB/);
    expect(reviewImageError({ type: "image/webp", size: 10 })).toBeNull();
  });

  it("uses the purchased size and color snapshot", () => {
    expect(reviewVariantLabel({ purchased_size: "M", purchased_color: "Black" })).toBe("Size M · Color Black");
  });

  it("attaches short-lived authorized URLs to stored review photos", async () => {
    const database = { storage: { from: () => ({ createSignedUrls: async () => ({ data: [{ path: "buyer/review/photo.webp", signedUrl: "https://signed.example/photo" }], error: null }) }) } } as unknown as SupabaseClient;
    const [image] = await signReviewImages(database, [{ id: "photo", storage_path: "buyer/review/photo.webp" }]);
    expect(image).toEqual({ id: "photo", storage_path: "buyer/review/photo.webp", url: "https://signed.example/photo" });
  });
});
