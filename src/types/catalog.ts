export type Currency = "GBP" | "EUR" | "USD";

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
  cardCrop?: {
    objectPosition: string;
    scale: number;
  };
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  size?: string;
  color?: string;
  inventory: number | null;
  priceOverride?: number | null;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  collection: string;
  collectionSlugs?: string[];
  description: string;
  shortDescription: string;
  price: number | null;
  currency: Currency;
  images: ProductImage[];
  variants: ProductVariant[];
  materials: string;
  care: string;
  featured: boolean;
  isNewArrival: boolean;
  isSale: boolean;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
  inquiryOnly?: boolean;
}

export interface CartItem {
  key: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  image: string;
  selectedSize?: string;
  selectedVariant: string;
  variantId: string;
  quantity: number;
  unitPrice: number | null;
  currency: Currency;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  email: string;
  shippingAddress: string;
  note?: string;
}
