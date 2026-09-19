import { useQuery } from "@tanstack/react-query";
import { products as previewProducts } from "../data/catalog";
import { supabase } from "../lib/supabase";
import { catalogPreview } from "../lib/config";
import type { Currency, Product } from "../types/catalog";
export const emptyCatalog: Product[] = [];

interface CatalogRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  short_description: string;
  price: number | null;
  currency: string;
  materials: string | null;
  care_information: string | null;
  featured: boolean;
  is_new_arrival: boolean;
  is_sale: boolean;
  inquiry_only: boolean;
  condition?: string | null;
  seller_verified?: boolean;
  seller_store_name?: string | null;
  seller_store_slug?: string | null;
  seller_country_code?: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
  brand: { name: string } | null;
  category: { name: string } | null;
  images: Array<{ id: string; public_url: string | null; storage_path: string; alt_text: string; position: number }>;
  variants: Array<{ id: string; sku: string; name: string; size: string | null; color: string | null; price_override: number | null; is_active: boolean; inventory: { quantity: number; reserved_quantity: number; allow_backorder: boolean } | null }>;
  collection_products: Array<{ collection: { name: string; slug: string } | null }>;
}

function toProduct(row: CatalogRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand?.name ?? "Fieldio",
    category: row.category?.name ?? "Uncategorised",
    collection: row.collection_products[0]?.collection?.name ?? "Fieldio Edit",
    collectionSlugs: row.collection_products.flatMap(({ collection }) => collection ? [collection.slug] : []),
    description: row.description,
    shortDescription: row.short_description,
    price: row.price,
    currency: row.currency as Currency,
    images: [...row.images].sort((a, b) => a.position - b.position).map((image) => ({ id: image.id, url: image.public_url?.replace(/^https:\/\/fieldio\.shop(?=\/)/, "") ?? supabase!.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl, alt: image.alt_text, position: image.position })),
    variants: row.variants.filter((variant) => variant.is_active).map((variant) => ({ id: variant.id, sku: variant.sku, name: variant.name, ...(variant.size ? { size: variant.size } : {}), ...(variant.color ? { color: variant.color } : {}), priceOverride: variant.price_override, inventory: row.inquiry_only || variant.inventory?.allow_backorder ? null : variant.inventory ? Math.max(0, variant.inventory.quantity - variant.inventory.reserved_quantity) : 0 })),
    materials: row.materials ?? "Confirmed on request.",
    care: row.care_information ?? "Confirmed on request.",
    featured: row.featured,
    isNewArrival: row.is_new_arrival,
    isSale: row.is_sale,
    tags: row.tags,
    seoTitle: row.seo_title ?? `${row.name} | Fieldio`,
    seoDescription: row.seo_description ?? row.short_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    inquiryOnly: row.inquiry_only,
    condition: row.condition ?? null,
    sellerVerified: row.seller_verified ?? false,
    sellerStoreName: row.seller_store_name ?? null,
    sellerStoreSlug: row.seller_store_slug ?? null,
    sellerCountryCode: row.seller_country_code ?? null
  };
}

const legacyCatalogSelect = "id,sku,slug,name,description,short_description,price,currency,materials,care_information,featured,is_new_arrival,is_sale,inquiry_only,tags,seo_title,seo_description,created_at,updated_at,brand:brands(name),category:categories(name),images:product_images(id,public_url,storage_path,alt_text,position),variants:product_variants(id,sku,name,size,color,price_override,is_active,inventory(quantity,reserved_quantity,allow_backorder)),collection_products(collection:collections(name,slug))";
const catalogSelect = legacyCatalogSelect.replace("inquiry_only,tags", "inquiry_only,condition,seller_verified,seller_store_name,seller_store_slug,seller_country_code,tags");
const trustColumns = ["condition", "seller_verified", "seller_store_name", "seller_store_slug", "seller_country_code"];

export function isMissingCatalogTrustColumn(error: { code?: string; message?: string }): boolean {
  return ["42703", "PGRST204"].includes(error.code ?? "") && trustColumns.some((column) => error.message?.includes(column));
}

async function queryCatalog(select: string) {
  const response = await supabase!.from("products").select(select).eq("status", "active").order("published_at", { ascending: false });
  return { data: response.data as unknown as CatalogRow[] | null, error: response.error };
}

async function fetchCatalog(): Promise<Product[]> {
  if (!supabase) return catalogPreview ? previewProducts : [];
  let response = await queryCatalog(catalogSelect);
  if (response.error && isMissingCatalogTrustColumn(response.error)) response = await queryCatalog(legacyCatalogSelect);
  if (response.error) throw response.error;
  const products = (response.data ?? []).map(toProduct);
  return products.length || !catalogPreview ? products : previewProducts;
}

export function useCatalogProducts() {
  return useQuery({ queryKey: ["catalog", "products"], queryFn: fetchCatalog });
}

export function useCatalogProduct(slug: string) {
  const query = useCatalogProducts();
  return { ...query, product: query.data?.find((product) => product.slug === slug) };
}
