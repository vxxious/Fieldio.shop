import { describe, expect, it } from "vitest";
import { getBrandSlug, products } from "../data/catalog";
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
  it("separates gender edits into useful subcategories", () => {
    expect(filterCatalog(products, { collection: "men", subcategory: "outerwear" }).map((product) => product.slug)).toContain("taupe-suede-overshirt");
    expect(filterCatalog(products, { collection: "women", subcategory: "footwear" }).map((product) => product.slug)).toContain("ivory-sculptural-slingbacks");
    expect(filterCatalog(products, { collection: "women", subcategory: "dresses" }).map((product) => product.slug)).toContain("architectural-column-dress");
  });
  it("keeps bags separate while nesting jewellery in accessories", () => {
    const base = products[0]!;
    const bag = { ...base, id: "bag", category: "Bags", tags: ["bags"] };
    const jewellery = { ...base, id: "jewellery", category: "Accessories", tags: ["jewellery", "earrings"] };
    const shoes = { ...base, id: "shoes", category: "Footwear", tags: ["shoes"] };
    expect(filterCatalog([bag, jewellery, shoes], { collection: "bags" }).map((product) => product.id)).toEqual(["bag"]);
    expect(filterCatalog([bag, jewellery, shoes], { collection: "accessories" }).map((product) => product.id)).toEqual(["jewellery"]);
    expect(filterCatalog([bag, jewellery, shoes], { collection: "jewellery", subcategory: "earrings" }).map((product) => product.id)).toEqual(["jewellery"]);
  });
  it("routes shoe categories through the shoes directory", () => {
    const base = products[0]!;
    const sneakers = { ...base, id: "sneakers", name: "B23 High-Top Sneaker", slug: "dior-b23-high-top-sneaker", category: "Footwear", tags: ["men", "footwear"] };
    const boots = { ...base, id: "boots", name: "Leather Ankle Boots", slug: "leather-ankle-boots", category: "Footwear", tags: ["women", "footwear"] };
    const pumps = { ...base, id: "pumps", name: "J'Adior Slingback Pump", slug: "jadior-slingback-pump", category: "Footwear", tags: ["women", "footwear"] };
    const laceUps = { ...base, id: "lace-ups", name: "Monolith Lace-Up Shoes", slug: "monolith-lace-up-shoes", category: "Footwear", tags: ["men", "footwear"] };
    const bag = { ...base, id: "bag", category: "Bags", tags: ["bags"] };
    const fixtures = [sneakers, boots, pumps, laceUps, bag];
    expect(filterCatalog(fixtures, { collection: "shoes" }).map((product) => product.id)).toEqual(["sneakers", "boots", "pumps", "lace-ups"]);
    expect(filterCatalog(fixtures, { collection: "shoes", subcategory: "sneakers" }).map((product) => product.id)).toEqual(["sneakers"]);
    expect(filterCatalog(fixtures, { collection: "shoes", subcategory: "boots" }).map((product) => product.id)).toEqual(["boots"]);
    expect(filterCatalog(fixtures, { collection: "shoes", subcategory: "pumps" }).map((product) => product.id)).toEqual(["pumps"]);
    expect(filterCatalog(fixtures, { collection: "shoes", subcategory: "derby-oxford-shoes" }).map((product) => product.id)).toEqual(["lace-ups"]);
  });
});

describe("brand routes", () => {
  it("creates stable URL slugs for accented and joined brand names", () => {
    expect(getBrandSlug("Hermès")).toBe("hermes");
    expect(getBrandSlug("Pull&Bear")).toBe("pull-and-bear");
    expect(getBrandSlug("Yves Saint Laurent")).toBe("yves-saint-laurent");
    expect(getBrandSlug("The North Face")).toBe("the-north-face");
  });
});
