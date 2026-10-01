import type { Product } from "../types/catalog";

const subcategoryTags: Record<string, string[]> = {
  tops: ["top", "tops", "shirt", "shirts", "t-shirt", "t-shirts", "polo", "polos", "knitwear", "sweatshirt", "sweatshirts"],
  bottoms: ["bottom", "bottoms", "pants", "trousers", "denim", "jeans", "shorts", "skirt", "skirts"],
  outerwear: ["outerwear", "coat", "coats", "jacket", "jackets", "blazer", "blazers"],
  dresses: ["dress", "dresses"],
  tailoring: ["tailoring", "suit", "suits", "blazer", "blazers"],
  bags: ["bag", "bags", "handbag", "handbags", "tote", "totes", "clutch", "clutches"],
  shoes: ["footwear", "shoe", "shoes", "trainer", "trainers", "sneaker", "sneakers", "boot", "boots", "pump", "pumps", "loafer", "loafers", "ballet flat", "ballet flats", "mule", "mules", "slipper", "slippers", "derby", "derby shoes", "oxford", "oxfords", "oxford shoes", "sandal", "sandals", "slide", "slides", "flip-flop", "flip-flops", "flip flops", "espadrille", "espadrilles"],
  sneakers: ["sneaker", "sneakers", "trainer", "trainers"],
  boots: ["boot", "boots"],
  pumps: ["pump", "pumps"],
  loafers: ["loafer", "loafers"],
  "ballet-flats": ["ballet flat", "ballet flats"],
  mules: ["mule", "mules"],
  slippers: ["slipper", "slippers"],
  "derby-oxford-shoes": ["derby", "derby shoes", "oxford", "oxfords", "oxford shoes"],
  sandals: ["sandal", "sandals"],
  "slides-flip-flops": ["slide", "slides", "flip-flop", "flip-flops", "flip flops"],
  espadrilles: ["espadrille", "espadrilles"],
  accessories: ["accessory", "accessories", "sunglasses", "belt", "belts", "hat", "hats", "cap", "caps", "wallet", "wallets", "cardholder", "cardholders", "scarf", "scarves", "glasses", "frames", "hair accessories", "glove", "gloves", "jewellery", "jewelry"],
  sunglasses: ["sunglasses"],
  belts: ["belt", "belts"],
  "hats-caps": ["hat", "hats", "cap", "caps"],
  "wallets-cardholders": ["wallet", "wallets", "cardholder", "cardholders"],
  scarves: ["scarf", "scarves"],
  "glasses-frames": ["glasses", "frames"],
  "hair-accessories": ["hair accessories"],
  gloves: ["glove", "gloves"],
  jewellery: ["jewellery", "jewelry"],
  "fashion-jewellery": ["fashion jewellery", "fashion jewelry"],
  "fine-jewellery": ["fine jewellery", "fine jewelry"],
  "demi-fine-jewellery": ["demi-fine jewellery", "demi-fine jewelry"],
  bracelets: ["bracelet", "bracelets"],
  earrings: ["earring", "earrings"],
  necklaces: ["necklace", "necklaces"],
  rings: ["ring", "rings"],
  watches: ["watch", "watches"],
  "fine-bracelets": ["fine bracelet", "fine bracelets"],
  "fine-earrings": ["fine earring", "fine earrings"],
  "fine-necklaces": ["fine necklace", "fine necklaces"],
  "fine-rings": ["fine ring", "fine rings"],
  "fine-watches": ["fine watch", "fine watches"],
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
      const terms = subcategoryTags[collection] ?? [collection];
      const productTerms = [product.category, ...product.tags].map((value) => value.toLowerCase());
      if (!terms.some((term) => productTerms.includes(term)) && !product.collectionSlugs?.includes(collection) && !inGender) return false;
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
