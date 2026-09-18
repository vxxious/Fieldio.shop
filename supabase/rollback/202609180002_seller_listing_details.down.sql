begin;

create or replace function public.submit_seller_listing(p_listing_id uuid)
returns public.seller_listings
language plpgsql
security definer
set search_path = ''
as $$
declare listing public.seller_listings;
begin
  select * into listing from public.seller_listings where id = p_listing_id and owner_id = (select auth.uid()) for update;
  if listing.id is null or listing.status not in ('draft','rejected') then raise exception 'Listing cannot be submitted'; end if;
  if not exists (select 1 from public.seller_listing_images where listing_id = listing.id) then raise exception 'Add at least one product image'; end if;
  update public.seller_listings set status = 'pending', review_reason = null, submitted_at = now(), reviewed_at = null, reviewed_by = null
  where id = listing.id returning * into listing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.listing_submitted', 'seller_listing', listing.id);
  return listing;
end;
$$;

create or replace function public.review_seller_listing(p_listing_id uuid, p_decision text, p_reason text default null, p_public_images jsonb default '[]'::jsonb)
returns public.seller_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.seller_listings;
  store public.seller_stores;
  brand_id uuid;
  product_id uuid;
  product_slug text;
  image jsonb;
  size_value text;
  variant_id uuid;
  variant_index integer := 0;
begin
  if not public.has_admin_role(array['owner','admin']) then raise exception 'Not authorised'; end if;
  if p_decision not in ('approved','rejected','suspended') then raise exception 'Invalid decision'; end if;
  if p_decision in ('rejected','suspended') and nullif(trim(p_reason), '') is null then raise exception 'A reason is required'; end if;
  select * into listing from public.seller_listings where id = p_listing_id and status = 'pending' for update;
  if listing.id is null then raise exception 'Listing is not pending review'; end if;
  if p_decision = 'approved' then
    if jsonb_typeof(p_public_images) <> 'array' or jsonb_array_length(p_public_images) = 0 then raise exception 'Published images are required'; end if;
    select * into store from public.seller_stores where id = listing.store_id and status = 'active';
    if store.id is null then raise exception 'Seller store is not active'; end if;
    select id into brand_id from public.brands where lower(name) = lower(store.name) limit 1;
    if brand_id is null then insert into public.brands(name, slug, description, is_active) values (store.name, store.slug, store.description, true) returning id into brand_id; end if;
    product_slug := trim(both '-' from regexp_replace(lower(listing.title), '[^a-z0-9]+', '-', 'g')) || '-' || left(replace(listing.id::text, '-', ''), 8);
    insert into public.products(sku, name, slug, brand_id, category_id, description, short_description, price, compare_at_price, currency, is_sale, inquiry_only, tags, status, published_at, seller_listing_id)
    values ('SELL-' || upper(left(replace(listing.id::text, '-', ''), 12)), listing.title, product_slug, brand_id, coalesce(listing.subcategory_id, listing.category_id), listing.description, left(listing.description, 240), listing.price, listing.compare_at_price, listing.currency, listing.compare_at_price is not null, true, array[listing.condition::text, 'verified-seller'], 'active', now(), listing.id)
    returning id into product_id;
    for image in select value from jsonb_array_elements(p_public_images) loop
      insert into public.product_images(product_id, storage_path, public_url, alt_text, position)
      values (product_id, image->>'storage_path', image->>'public_url', coalesce(nullif(image->>'alt_text',''), listing.title), coalesce((image->>'position')::integer, 0));
    end loop;
    if coalesce(array_length(listing.sizes, 1), 0) = 0 then listing.sizes := array['Available']; end if;
    foreach size_value in array listing.sizes loop
      variant_index := variant_index + 1;
      insert into public.product_variants(product_id, sku, name, size, color, attributes, is_active)
      values (product_id, 'SELL-' || upper(left(replace(listing.id::text, '-', ''), 10)) || '-' || variant_index, coalesce(nullif(size_value, ''), 'Available'), nullif(size_value, 'Available'), nullif(array_to_string(listing.colors, ' / '), ''), jsonb_build_object('seller_quantity', listing.quantity, 'weight_kg', listing.weight_kg), true)
      returning id into variant_id;
      insert into public.inventory(variant_id, quantity, allow_backorder) values (variant_id, 0, true);
    end loop;
  end if;
  update public.seller_listings set status = p_decision::public.seller_listing_status, review_reason = nullif(trim(p_reason), ''), reviewed_at = now(), reviewed_by = (select auth.uid()), published_product_id = coalesce(product_id, published_product_id)
  where id = listing.id returning * into listing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.listing_' || p_decision, 'seller_listing', listing.id);
  return listing;
end;
$$;

drop index if exists public.seller_listings_audience_category_idx;

delete from public.categories category
where category.slug in (
  'tops-t-shirts','tops-shirts','tops-polos','tops-knitwear','tops-hoodies-sweatshirts',
  'bottoms-trousers','bottoms-jeans','bottoms-shorts','bottoms-skirts',
  'dresses-mini','dresses-midi','dresses-maxi','dresses-occasion',
  'outerwear-jackets','outerwear-coats','outerwear-blazers','outerwear-vests',
  'footwear-trainers','footwear-loafers','footwear-boots','footwear-sandals','footwear-heels',
  'swimwear-one-piece','swimwear-bikinis','swimwear-shorts','swimwear-cover-ups'
)
and not exists (select 1 from public.seller_listings listing where listing.subcategory_id = category.id)
and not exists (select 1 from public.products product where product.category_id = category.id);

alter table public.seller_listings
  drop column authenticity_confirmed,
  drop column item_reference,
  drop column condition_notes,
  drop column materials,
  drop column audience;

commit;
