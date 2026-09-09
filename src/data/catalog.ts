import type { Product } from "../types/catalog";

const date = "2026-09-05T00:00:00.000Z";

export const products: Product[] = [
  {
    id: "lv-sourcing-001",
    sku: "FIELDIO-LV-SOURCE",
    slug: "louis-vuitton-personal-sourcing",
    name: "Louis Vuitton Personal Sourcing",
    brand: "Louis Vuitton",
    category: "Bags",
    collection: "Luxury Sourcing",
    shortDescription: "A direct sourcing request for a Louis Vuitton piece.",
    description: "Tell Fieldio the model, colour, size, or season you are looking for. Your personal shopper will confirm authenticity, availability, final price, shipping, and payment directly on WhatsApp before an order is confirmed.",
    price: null,
    currency: "GBP",
    images: [{ id: "lv-sourcing-1", url: "/images/luxury-travel.png", alt: "Unbranded leather travel pieces arranged in a limestone studio", position: 0 }],
    variants: [{ id: "lv-source", sku: "FIELDIO-LV-SOURCE", name: "Personal sourcing request", inventory: null }],
    materials: "Confirmed with the sourced item.",
    care: "Care guidance is supplied with the sourced item.",
    featured: true,
    isNewArrival: true,
    isSale: false,
    tags: ["louis vuitton", "luxury", "personal shopper", "bags"],
    seoTitle: "Louis Vuitton Personal Sourcing | Fieldio",
    seoDescription: "Request a Louis Vuitton piece through Fieldio personal shopping with worldwide shipping support.",
    createdAt: date,
    updatedAt: date,
    inquiryOnly: true
  },
  {
    id: "atelier-dress-001",
    sku: "FIELDIO-ATELIER-001",
    slug: "architectural-column-dress",
    name: "Architectural Column Dress",
    brand: "Fieldio Edit",
    category: "Women",
    collection: "The New Edit",
    shortDescription: "A precise sleeveless column with a sculpted waist.",
    description: "A reference piece for the Fieldio launch catalog. Final availability, composition, price, shipping, and payment are confirmed by a personal shopper before purchase.",
    price: null,
    currency: "GBP",
    images: [{ id: "dress-1", url: "/images/atelier-dress.png", alt: "Model wearing an architectural black sleeveless column dress", position: 0 }],
    variants: ["XS", "S", "M", "L", "XL"].map((size) => ({ id: `dress-${size}`, sku: `FIELDIO-ATELIER-001-${size}`, name: `Black / ${size}`, size, color: "Black", inventory: null })),
    materials: "Composition confirmed on request.",
    care: "Care guidance supplied after sourcing confirmation.",
    featured: true,
    isNewArrival: true,
    isSale: false,
    tags: ["dress", "tailoring", "black", "women"],
    seoTitle: "Architectural Column Dress | Fieldio",
    seoDescription: "Request the Architectural Column Dress through Fieldio personal shopping.",
    createdAt: date,
    updatedAt: date,
    inquiryOnly: true
  },
  {
    id: "olive-silk-001",
    sku: "FIELDIO-SILK-001",
    slug: "olive-silk-and-ivory-set",
    name: "Olive Silk & Ivory Set",
    brand: "Fieldio Edit",
    category: "Women",
    collection: "The New Edit",
    shortDescription: "Fluid silk against wide, architectural tailoring.",
    description: "A considered evening-to-day pairing selected for the Fieldio edit. A personal shopper confirms the exact pieces, sizes, availability, and price.",
    price: null,
    currency: "GBP",
    images: [{ id: "silk-1", url: "/images/olive-silk-look.png", alt: "Model wearing an olive silk blouse and wide ivory trousers", position: 0 }],
    variants: ["S", "M", "L"].map((size) => ({ id: `silk-${size}`, sku: `FIELDIO-SILK-001-${size}`, name: `Olive and ivory / ${size}`, size, color: "Olive / Ivory", inventory: null })),
    materials: "Composition confirmed on request.",
    care: "Specialist care may be required; details confirmed before purchase.",
    featured: true,
    isNewArrival: true,
    isSale: false,
    tags: ["silk", "tailoring", "women", "occasion"],
    seoTitle: "Olive Silk and Ivory Set | Fieldio",
    seoDescription: "Request an olive silk and ivory tailored look through Fieldio.",
    createdAt: date,
    updatedAt: date,
    inquiryOnly: true
  },
  {
    id: "taupe-overshirt-001",
    sku: "FIELDIO-MENS-001",
    slug: "taupe-suede-overshirt",
    name: "Taupe Suede Overshirt",
    brand: "Fieldio Edit",
    category: "Men",
    collection: "Modern Essentials",
    shortDescription: "Soft structure, precise proportion, quiet texture.",
    description: "A modern menswear layer selected for its understated line and versatile weight. Final material, size, availability, and price are confirmed on WhatsApp.",
    price: null,
    currency: "GBP",
    images: [{ id: "overshirt-1", url: "/images/taupe-menswear.png", alt: "Model wearing a taupe overshirt with charcoal trousers", position: 0 }],
    variants: ["S", "M", "L", "XL"].map((size) => ({ id: `overshirt-${size}`, sku: `FIELDIO-MENS-001-${size}`, name: `Taupe / ${size}`, size, color: "Taupe", inventory: null })),
    materials: "Material confirmed on request.",
    care: "Specialist care guidance supplied with the sourced item.",
    featured: true,
    isNewArrival: true,
    isSale: false,
    tags: ["men", "outerwear", "suede", "essentials"],
    seoTitle: "Taupe Suede Overshirt | Fieldio",
    seoDescription: "Request a refined taupe menswear overshirt through Fieldio.",
    createdAt: date,
    updatedAt: date,
    inquiryOnly: true
  },
  {
    id: "oxblood-bag-001",
    sku: "FIELDIO-BAG-001",
    slug: "oxblood-structured-bag",
    name: "Oxblood Structured Bag",
    brand: "Fieldio Edit",
    category: "Bags",
    collection: "Accessories Edit",
    shortDescription: "A compact top-handle silhouette in deep oxblood.",
    description: "A structured reference style for personal sourcing. Fieldio will confirm the available designer, finish, dimensions, final price, and shipping before purchase.",
    price: null,
    currency: "GBP",
    images: [{ id: "bag-1", url: "/images/oxblood-accessories.png", alt: "Oxblood structured bag in a minimal studio setting", position: 0, cardCrop: { objectPosition: "50% 18%", scale: 1.45 } }],
    variants: [{ id: "bag-oxblood", sku: "FIELDIO-BAG-001-OXB", name: "Oxblood", color: "Oxblood", inventory: null }],
    materials: "Leather and hardware specifications confirmed on request.",
    care: "Store filled and away from direct heat; final care guidance follows the sourced piece.",
    featured: true,
    isNewArrival: false,
    isSale: false,
    tags: ["bag", "accessories", "leather", "luxury"],
    seoTitle: "Oxblood Structured Bag | Fieldio",
    seoDescription: "Request a structured oxblood top-handle bag through Fieldio.",
    createdAt: date,
    updatedAt: date,
    inquiryOnly: true
  },
  {
    id: "ivory-slingback-001",
    sku: "FIELDIO-SHOE-001",
    slug: "ivory-sculptural-slingbacks",
    name: "Ivory Sculptural Slingbacks",
    brand: "Fieldio Edit",
    category: "Shoes",
    collection: "Accessories Edit",
    shortDescription: "An elongated ivory slingback with a sculpted heel.",
    description: "A clean, architectural footwear reference for Fieldio sourcing. Size, designer, availability, final price, and delivery timing are confirmed before purchase.",
    price: null,
    currency: "GBP",
    images: [{ id: "shoe-1", url: "/images/oxblood-accessories.png", alt: "Ivory sculptural slingback shoes on a stone plinth", position: 0, cardCrop: { objectPosition: "58% 86%", scale: 1.55 } }],
    variants: ["36", "37", "38", "39", "40", "41"].map((size) => ({ id: `shoe-${size}`, sku: `FIELDIO-SHOE-001-${size}`, name: `Ivory / EU ${size}`, size: `EU ${size}`, color: "Ivory", inventory: null })),
    materials: "Materials confirmed on request.",
    care: "Care guidance supplied with the sourced item.",
    featured: false,
    isNewArrival: true,
    isSale: false,
    tags: ["shoes", "women", "slingback", "ivory"],
    seoTitle: "Ivory Sculptural Slingbacks | Fieldio",
    seoDescription: "Request ivory sculptural slingbacks through Fieldio personal shopping.",
    createdAt: date,
    updatedAt: date,
    inquiryOnly: true
  }
];

export const brands = [
  "Louis Vuitton",
  "Gucci",
  "Yves Saint Laurent",
  "Prada",
  "Dior",
  "Chanel",
  "Hermès",
  "Bottega Veneta",
  "Balenciaga",
  "Burberry",
  "Versace",
  "Fendi",
  "Lacoste",
  "Adidas",
  "The North Face",
  "Zara",
  "Nike",
  "Vans",
  "Pull&Bear",
  "Fieldio Edit"
] as const;

export function getBrandSlug(brand: string): string {
  return brand
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getProductsByCategory(category?: string): Product[] {
  if (!category || category === "All") return products;
  return products.filter((product) => product.category.toLowerCase() === category.toLowerCase());
}
