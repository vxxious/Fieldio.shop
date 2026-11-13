import { useQuery } from "@tanstack/react-query";
import { products as previewProducts } from "../data/catalog";
import { supabase } from "../lib/supabase";
import { catalogPreview } from "../lib/config";
import type { Currency, Product } from "../types/catalog";
export const emptyCatalog: Product[] = [];

interface CatalogRow {
  id: string;
  brand_id: string | null;
  sku: string;
  slug: string;
  name: string;
  description: string;
  short_description: string;
  price: number | null;
  original_price: number | null;
  saving_percent: number | null;
  new_in_active: boolean;
  sale_active: boolean;
  currency: string;
  materials: string | null;
  care_information: string | null;
  featured: boolean;
  inquiry_only: boolean;
  condition?: string | null;
  seller_verified?: boolean;
  seller_store_name?: string | null;
  seller_store_slug?: string | null;
  seller_country_code?: string | null;
  seller_store_logo_path?: string | null;
  average_rating?: number;
  rating_count?: number;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
  brand: { name: string } | null;
  category: { name: string } | null;
  images: Array<{ id: string; public_url: string | null; storage_path: string; alt_text: string; position: number }>;
  variants: Array<{ id: string; sku: string; name: string; size: string | null; color: string | null; price_override: number | null; is_active: boolean }>;
  collection_products: Array<{ collection: { name: string; slug: string } | null }>;
}

export function toProduct(row: CatalogRow, availability: Map<string, number | null>): Product {
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
    originalPrice: row.original_price,
    savingPercent: row.saving_percent,
    currency: row.currency as Currency,
    images: [...row.images].sort((a, b) => a.position - b.position).map((image) => ({ id: image.id, url: image.public_url?.replace(/^https:\/\/fieldio\.shop(?=\/)/, "") ?? supabase!.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl, alt: image.alt_text, position: image.position })),
    variants: row.variants.filter((variant) => variant.is_active).map((variant) => ({ id: variant.id, sku: variant.sku, name: variant.name, ...(variant.size ? { size: variant.size } : {}), ...(variant.color ? { color: variant.color } : {}), priceOverride: row.sale_active ? null : variant.price_override, inventory: row.inquiry_only ? null : availability.has(variant.id) ? availability.get(variant.id)! : 0 })),
    materials: row.materials ?? "Confirmed on request.",
    care: row.care_information ?? "Confirmed on request.",
    featured: row.featured,
    isNewArrival: row.new_in_active,
    isSale: row.sale_active,
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
    sellerCountryCode: row.seller_country_code ?? null,
    sellerStoreLogo: row.seller_store_logo_path ? `${supabase!.storage.from("profile-media").getPublicUrl(row.seller_store_logo_path).data.publicUrl}?v=${encodeURIComponent(row.updated_at)}` : null,
    averageRating: Number(row.average_rating ?? 0),
    ratingCount: Number(row.rating_count ?? 0)
  };
}

export const catalogSelect = "id,brand_id,sku,slug,name,description,short_description,price:effective_price,original_price,saving_percent,new_in_active,sale_active,currency,materials,care_information,featured,inquiry_only,condition,seller_verified,seller_store_name,seller_store_slug,seller_country_code,seller_store_logo_path,average_rating,rating_count,tags,seo_title,seo_description,created_at,updated_at,brand:brands(name),category:categories(name),images:product_images(id,public_url,storage_path,alt_text,position),variants:product_variants(id,sku,name,size,color,price_override,is_active),collection_products(collection:collections(name,slug))";

export async function hydrateCatalog(rows: CatalogRow[]): Promise<Product[]> {
  const variantIds = rows.flatMap((product) => product.variants.filter((variant) => variant.is_active && !product.inquiry_only).map((variant) => variant.id));
  const availability = new Map<string, number | null>();
  const batches = Array.from({ length: Math.ceil(variantIds.length / 200) }, (_, index) => variantIds.slice(index * 200, (index + 1) * 200));
  const results = await Promise.all(batches.map((ids) => supabase!.rpc("shop_variant_availability", { p_variant_ids: ids })));
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of (result.data ?? []) as Array<{ variant_id: string; available_quantity: number | null }>) availability.set(row.variant_id, row.available_quantity);
  }
  return rows.map((row) => toProduct(row, availability));
}

async function fetchCatalog(): Promise<Product[]> {
  if (!supabase) return catalogPreview ? previewProducts : [];
  const response = await supabase.from("discovery_products").select(catalogSelect).order("published_at", { ascending: false });
  if (response.error) throw response.error;
  const products = await hydrateCatalog((response.data ?? []) as unknown as CatalogRow[]);
  return products.length || !catalogPreview ? products : previewProducts;
}

export function useCatalogProducts() {
  return useQuery({ queryKey: ["catalog", "products"], queryFn: fetchCatalog });
}

export function useCatalogProduct(slug: string) {
  const query = useQuery({ queryKey: ["catalog", "product", slug], enabled: Boolean(slug && supabase), queryFn: async () => {
    const response = await supabase!.from("discovery_products").select(catalogSelect).eq("slug", slug).maybeSingle();
    if (response.error) throw response.error;
    if (!response.data) return { product: undefined, related: [] as Product[] };
    const row = response.data as unknown as CatalogRow & { brand_id: string | null };
    const relatedResponse = row.brand_id ? await supabase!.from("discovery_products").select(catalogSelect).eq("brand_id", row.brand_id).neq("id", row.id).order("published_at", { ascending: false }).limit(5) : null;
    if (relatedResponse?.error) throw relatedResponse.error;
    const products = await hydrateCatalog([row, ...((relatedResponse?.data ?? []) as unknown as CatalogRow[])]);
    return { product: products[0], related: products.slice(1) };
  } });
  return { ...query, product: query.data?.product, data: query.data?.related };
}
