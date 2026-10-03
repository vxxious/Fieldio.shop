import { describe, expect, it } from "vitest";
import { isMissingCatalogTrustColumn, toProduct } from "./useCatalog";

describe("catalog schema compatibility", () => {
  it("retries only when a new trust column is missing", () => {
    expect(isMissingCatalogTrustColumn({ code: "PGRST204", message: "Could not find the seller_verified column" })).toBe(true);
    expect(isMissingCatalogTrustColumn({ code: "42501", message: "permission denied" })).toBe(false);
  });
});

describe("public variant availability", () => {
  it("uses only the safe availability response for purchasable stock", () => {
    const row = {
      id: "product", sku: "P1", slug: "p1", name: "Coat", description: "Coat", short_description: "Coat", price: 10000, currency: "GBP",
      materials: null, care_information: null, featured: false, is_new_arrival: false, is_sale: false, inquiry_only: false,
      tags: [], seo_title: null, seo_description: null, created_at: "2026-09-01", updated_at: "2026-09-01",
      brand: null, category: null, images: [], collection_products: [],
      variants: [
        { id: "available", sku: "V1", name: "M", size: "M", color: "Black", price_override: null, is_active: true },
        { id: "backorder", sku: "V2", name: "L", size: "L", color: "Black", price_override: null, is_active: true },
        { id: "missing", sku: "V3", name: "S", size: "S", color: "Black", price_override: null, is_active: true }
      ]
    } as Parameters<typeof toProduct>[0];
    const availability = new Map<string, number | null>([["available", 7], ["backorder", null]]);
    expect(toProduct(row, availability).variants.map((variant) => variant.inventory)).toEqual([7, null, 0]);
    expect(toProduct({ ...row, inquiry_only: true }, availability).variants.map((variant) => variant.inventory)).toEqual([null, null, null]);
  });
});
