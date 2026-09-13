import type { Product } from "../types/catalog";

const subcategoryTags: Record<string, string[]> = {
  tops: ["top", "tops", "shirt", "shirts", "t-shirt", "t-shirts", "polo", "polos", "knitwear", "sweatshirt", "sweatshirts"],
  bottoms: ["bottom", "bottoms", "pants", "trousers", "denim", "jeans", "shorts", "skirt", "skirts"],
  outerwear: ["outerwear", "coat", "coats", "jacket", "jackets", "blazer", "blazers"],
  dresses: ["dress", "dresses"],
  tailoring: ["tailoring", "suit", "suits", "blazer", "blazers"],
  accessories: ["accessory", "accessories", "bag", "bags", "jewellery", "jewelry"],
  footwear: ["footwear", "shoe", "shoes", "trainer", "trainers", "sneaker", "sneakers"]
};

export function filterCatalog(products: Product[], filters: { collection?: string; subcategory?: string; brand?: string; size?: string; sort?: string }) {
  const { collection, subcategory, brand, size, sort } = filters;
  const result = products.filter((product) => {
    if (brand && product.brand !== brand) return false;
    if (size && !product.variants.some((variant) => variant.size === size && variant.inventory !== 0)) return false;
    if (collection === "new-arrivals" && !product.isNewArrival) return false;
    if (collection === "featured" && !product.featured) return false;
    if (collection === "sale" && !product.isSale) return false;
    if (collection === "luxury" && !product.tags.includes("luxury") && product.collection !== "Luxury Sourcing") return false;
    if (collection && !["new-arrivals", "featured", "sale", "luxury"].includes(collection)) {
      const inGender = ["men", "women"].includes(collection) && product.tags.some((tag) => tag.toLowerCase() === collection);
      if (product.category.toLowerCase() !== collection && !product.collectionSlugs?.includes(collection) && !inGender) return false;
    }
    if (subcategory === "new-in" && !product.isNewArrival) return false;
    if (subcategory === "sale" && !product.isSale) return false;
    if (subcategory && subcategory !== "all") {
      const tags = subcategoryTags[subcategory] ?? [subcategory];
      const productTerms = [product.category, ...product.tags].map((value) => value.toLowerCase());
      if (!tags.some((tag) => productTerms.includes(tag))) return false;
    }
    return true;
  });
  return [...result].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "price-low" || sort === "price-high") {
      if (a.price === null) return b.price === null ? 0 : 1;
      if (b.price === null) return -1;
      return sort === "price-low" ? a.price - b.price : b.price - a.price;
    }
    return Number(b.featured) - Number(a.featured);
  });
}
