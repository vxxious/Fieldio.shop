import { expect, it } from "vitest";
import { responsiveImage } from "./images";

it("serves local Zara photography at card and gallery sizes without changing the original URL", () => {
  const image = responsiveImage("https://fieldio.shop/images/brand-catalog/zara/zara-boxers-01.webp?v=20261016");
  expect(image.src).toBe("/images/brand-catalog/zara/zara-boxers-01.webp?v=20261016");
  expect(image.srcSet).toContain("zara-boxers-01-480.webp?v=20261016 480w");
  expect(image.srcSet).toContain("zara-boxers-01-960.webp?v=20261016 960w");
  expect(image.srcSet).toContain("zara-boxers-01.webp?v=20261016 1200w");
});

it("keeps external image URLs unchanged when no transformed delivery is configured", () => {
  expect(responsiveImage("https://example.supabase.co/storage/v1/object/public/product-images/item.webp")).toEqual({ src: "https://example.supabase.co/storage/v1/object/public/product-images/item.webp" });
});
