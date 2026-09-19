begin;

drop trigger if exists require_seller_listing_defect_evidence on public.seller_listings;
drop function if exists public.require_defect_evidence();
drop trigger if exists set_seller_product_trust_metadata on public.products;
drop function if exists public.set_seller_product_trust_metadata();
drop index if exists public.products_seller_store_idx;

alter table public.products
  drop column if exists seller_country_code,
  drop column if exists seller_store_slug,
  drop column if exists seller_store_name,
  drop column if exists seller_verified,
  drop column if exists condition;

commit;
