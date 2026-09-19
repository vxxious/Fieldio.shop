import { describe, expect, it } from "vitest";
import { deliveryGuidance, productCondition, productSizeSummary } from "./product-trust";
import type { Product } from "../types/catalog";

const product = { condition: "excellent", tags: [], variants: [{ size: "S" }, { size: "M" }, { size: "L" }, { size: "XL" }] } as unknown as Product;

describe("product trust details", () => {
  it("formats condition, compact sizes, and regional delivery guidance", () => {
    expect(productCondition(product)).toBe("Excellent");
    expect(productSizeSummary(product)).toBe("S, M, L +1");
    expect(deliveryGuidance("GB").estimate).toContain("2–5");
    expect(deliveryGuidance("FR").estimate).toContain("4–8");
    expect(deliveryGuidance("NG").estimate).toContain("5–12");
  });

  it("includes the standard Very Good condition grade", () => {
    expect(productCondition({ ...product, condition: "very_good" })).toBe("Very Good");
  });
});
