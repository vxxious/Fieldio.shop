begin;

-- Catalogue staff can manage Fieldio products, but vendor storefront linkage is
-- written only by the security-definer seller approval flow.
revoke insert, update on public.products from anon, authenticated;

grant insert (
  sku, name, slug, brand_id, category_id, description, short_description,
  price, compare_at_price, currency, materials, care_information, featured,
  is_new_arrival, is_sale, inquiry_only, tags, status, seo_title,
  seo_description, published_at, condition
) on public.products to authenticated;

grant update (
  sku, name, slug, brand_id, category_id, description, short_description,
  price, compare_at_price, currency, materials, care_information, featured,
  is_new_arrival, is_sale, inquiry_only, tags, status, seo_title,
  seo_description, published_at, condition
) on public.products to authenticated;

comment on column public.products.seller_listing_id is
  'Assigned only by the seller listing approval flow; never by direct catalogue administration.';

commit;
