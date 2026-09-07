import { describe, expect, it } from "vitest";
import { products } from "../data/catalog";
import { filterCatalog } from "./catalog-filter";

describe("catalog filters", () => {
  it("combines brand and size instead of widening either filter", () => {
    const selected = filterCatalog(products, { brand: "Fieldio Edit", size: "M", collection: "men" });
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((product) => product.category === "Men" && product.variants.some((variant) => variant.size === "M"))).toBe(true);
  });
  it("keeps price-on-request items after priced items in both price directions", () => {
    const base = products[0]!;
    const fixtures = [{ ...base, id: "a", price: null }, { ...base, id: "b", price: 9000 }, { ...base, id: "c", price: 2000 }];
    expect(filterCatalog(fixtures, { sort: "price-low" }).map((p) => p.id)).toEqual(["c", "b", "a"]);
    expect(filterCatalog(fixtures, { sort: "price-high" }).map((p) => p.id)).toEqual(["b", "c", "a"]);
  });
});
