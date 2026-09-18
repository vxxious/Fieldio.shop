import { describe, expect, it } from "vitest";
import { listingSchema, subcategoriesFor } from "../../src/pages/SellerPage";

const validListing = {
  title: "Tailored wool jacket",
  description: "A carefully kept tailored jacket with original buttons.",
  audience: "women" as const,
  category_id: "11111111-1111-4111-8111-111111111111",
  subcategory_id: "22222222-2222-4222-8222-222222222222",
  condition: "excellent" as const,
  condition_notes: "Lightly worn with no visible marks.",
  materials: "100% wool",
  item_reference: "FW-26-104",
  price: 250,
  compare_at_price: 400,
  currency: "GBP",
  colors: "Black",
  sizes: "M",
  quantity: 1,
  weight_kg: 1.2,
  authenticity_confirmed: true
};

describe("seller listing details", () => {
  it("requires complete classification and verification details", () => {
    expect(listingSchema.safeParse(validListing).success).toBe(true);
    expect(listingSchema.safeParse({ ...validListing, subcategory_id: "", materials: "", authenticity_confirmed: false }).success).toBe(false);
  });

  it("returns only subcategories belonging to the selected category", () => {
    const categories = [
      { id: validListing.category_id, parent_id: null, name: "Outerwear" },
      { id: validListing.subcategory_id, parent_id: validListing.category_id, name: "Jackets" },
      { id: "33333333-3333-4333-8333-333333333333", parent_id: "44444444-4444-4444-8444-444444444444", name: "Boots" }
    ];
    expect(subcategoriesFor(categories, validListing.category_id).map(({ name }) => name)).toEqual(["Jackets"]);
  });
});
