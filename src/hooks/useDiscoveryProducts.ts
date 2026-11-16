import { useQuery } from "@tanstack/react-query";
import { catalogSelect, hydrateCatalog } from "./useCatalog";
import { supabase } from "../lib/supabase";

export interface DiscoveryFilters {
  kind: "all" | "new" | "sale" | "brand";
  brandId?: string;
  brandSlug?: string;
  gender?: string;
  categoryId?: string;
  currency?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export function useDiscoveryProducts(filters: DiscoveryFilters | null) {
  return useQuery({
    queryKey: ["catalog", "discovery", filters],
    enabled: Boolean(supabase && filters),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const selected = filters!;
      let brandId = selected.brandId;
      if (selected.brandSlug) {
        const brand = await supabase!.from("brands").select("id").eq("slug", selected.brandSlug).eq("is_active", true).eq("is_catalogued", true).maybeSingle();
        if (brand.error) throw brand.error;
        if (!brand.data) return { products: [], total: 0 };
        brandId = brand.data.id;
      }
      let query = supabase!.from("discovery_products").select(catalogSelect, { count: "exact" });
      if (selected.kind === "new") query = query.eq("new_in_active", true);
      if (selected.kind === "sale") query = query.eq("sale_active", true);
      if (brandId) query = query.eq("brand_id", brandId);
      if (selected.gender) query = query.contains("tags", [selected.gender]);
      if (selected.categoryId) query = query.eq("category_id", selected.categoryId);
      if (selected.currency) query = query.eq("currency", selected.currency);
      if (selected.minPrice !== undefined) query = query.gte("effective_price", selected.minPrice);
      if (selected.maxPrice !== undefined) query = query.lte("effective_price", selected.maxPrice);
      if (selected.sort === "price-low") query = query.order("effective_price", { ascending: true, nullsFirst: false });
      if (selected.sort === "price-high") query = query.order("effective_price", { ascending: false, nullsFirst: false });
      query = query.order("published_at", { ascending: false }).order("id", { ascending: false });
      const limit = Math.min(12, Math.max(1, selected.limit ?? 12));
      const page = Math.max(1, selected.page ?? 1);
      const result = await query.range((page - 1) * limit, page * limit - 1);
      if (result.error) throw result.error;
      return { products: await hydrateCatalog((result.data ?? []) as unknown as Parameters<typeof hydrateCatalog>[0]), total: result.count ?? 0 };
    }
  });
}

export function useDiscoveryOptions() {
  return useQuery({ queryKey: ["catalog", "discovery-options"], enabled: Boolean(supabase), staleTime: 300_000, queryFn: async () => {
    const [brands, categories] = await Promise.all([
      supabase!.from("brands").select("id,name,slug,description,seo_title,seo_description").eq("is_active", true).eq("is_catalogued", true).order("name"),
      supabase!.from("categories").select("id,name,slug").eq("is_active", true).order("name")
    ]);
    if (brands.error || categories.error) throw brands.error || categories.error;
    return { brands: brands.data ?? [], categories: categories.data ?? [] };
  } });
}
