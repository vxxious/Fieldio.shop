import type { Product } from "../types/catalog";

export function filterCatalog(products: Product[], filters: { collection?: string; brand?: string; size?: string; sort?: string }) {
  const { collection, brand, size, sort } = filters;
  const result = products.filter((product) => {
    if (brand && product.brand !== brand) return false;
    if (size && !product.variants.some((variant) => variant.size === size && variant.inventory !== 0)) return false;
    if (!collection) return true;
    if (collection === "new-arrivals") return product.isNewArrival;
    if (collection === "featured") return product.featured;
    if (collection === "sale") return product.isSale;
    if (collection === "luxury") return product.tags.includes("luxury") || product.collection === "Luxury Sourcing";
    return product.category.toLowerCase() === collection || product.collectionSlugs?.includes(collection);
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
