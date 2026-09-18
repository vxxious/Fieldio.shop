begin;

alter table public.seller_listings
  add column audience text check (audience in ('women', 'men', 'unisex')),
  add column materials text check (materials is null or char_length(materials) between 2 and 500),
  add column condition_notes text check (condition_notes is null or char_length(condition_notes) between 10 and 1000),
  add column item_reference text check (item_reference is null or char_length(item_reference) <= 120),
  add column authenticity_confirmed boolean not null default false;

grant insert (audience, materials, condition_notes, item_reference, authenticity_confirmed) on public.seller_listings to authenticated;
grant update (audience, materials, condition_notes, item_reference, authenticity_confirmed) on public.seller_listings to authenticated;

with subcategories(parent_slug, name, slug) as (values
  ('tops', 'T-shirts', 'tops-t-shirts'),
  ('tops', 'Shirts', 'tops-shirts'),
  ('tops', 'Polos', 'tops-polos'),
  ('tops', 'Knitwear', 'tops-knitwear'),
  ('tops', 'Hoodies & sweatshirts', 'tops-hoodies-sweatshirts'),
  ('bottoms', 'Trousers', 'bottoms-trousers'),
  ('bottoms', 'Jeans', 'bottoms-jeans'),
  ('bottoms', 'Shorts', 'bottoms-shorts'),
  ('bottoms', 'Skirts', 'bottoms-skirts'),
  ('dresses', 'Mini dresses', 'dresses-mini'),
  ('dresses', 'Midi dresses', 'dresses-midi'),
  ('dresses', 'Maxi dresses', 'dresses-maxi'),
  ('dresses', 'Occasion dresses', 'dresses-occasion'),
  ('outerwear', 'Jackets', 'outerwear-jackets'),
  ('outerwear', 'Coats', 'outerwear-coats'),
  ('outerwear', 'Blazers', 'outerwear-blazers'),
  ('outerwear', 'Vests', 'outerwear-vests'),
  ('footwear', 'Trainers', 'footwear-trainers'),
  ('footwear', 'Loafers', 'footwear-loafers'),
  ('footwear', 'Boots', 'footwear-boots'),
  ('footwear', 'Sandals', 'footwear-sandals'),
  ('footwear', 'Heels', 'footwear-heels'),
  ('swimwear', 'One-piece swimwear', 'swimwear-one-piece'),
  ('swimwear', 'Bikinis', 'swimwear-bikinis'),
  ('swimwear', 'Swim shorts', 'swimwear-shorts'),
  ('swimwear', 'Cover-ups', 'swimwear-cover-ups')
)
insert into public.categories(parent_id, name, slug, is_active)
select parent.id, subcategories.name, subcategories.slug, true
from subcategories
join public.categories parent on parent.slug = subcategories.parent_slug
on conflict (slug) do update
set parent_id = excluded.parent_id, name = excluded.name, is_active = true;

create index seller_listings_audience_category_idx on public.seller_listings(audience, category_id, subcategory_id);

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
  if listing.audience is null then raise exception 'Choose who the product is for'; end if;
  if listing.subcategory_id is null or not exists (
    select 1 from public.categories child
    where child.id = listing.subcategory_id and child.parent_id = listing.category_id and child.is_active
  ) then raise exception 'Choose a valid subcategory'; end if;
  if nullif(trim(listing.materials), '') is null then raise exception 'Add the product materials'; end if;
  if nullif(trim(listing.condition_notes), '') is null then raise exception 'Add condition details'; end if;
  if coalesce(array_length(listing.colors, 1), 0) = 0 then raise exception 'Add at least one colour'; end if;
  if coalesce(array_length(listing.sizes, 1), 0) = 0 then raise exception 'Add at least one size'; end if;
  if not listing.authenticity_confirmed then raise exception 'Confirm authenticity and authority to sell'; end if;
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
    if brand_id is null then
      insert into public.brands(name, slug, description, is_active) values (store.name, store.slug, store.description, true) returning id into brand_id;
    end if;
    product_slug := regexp_replace(lower(listing.title), '[^a-z0-9]+', '-', 'g');
    product_slug := trim(both '-' from product_slug) || '-' || left(replace(listing.id::text, '-', ''), 8);
    insert into public.products(sku, name, slug, brand_id, category_id, description, short_description, price, compare_at_price, currency, materials, is_sale, inquiry_only, tags, status, published_at, seller_listing_id)
    values ('SELL-' || upper(left(replace(listing.id::text, '-', ''), 12)), listing.title, product_slug, brand_id, coalesce(listing.subcategory_id, listing.category_id), listing.description, left(listing.description, 240), listing.price, listing.compare_at_price, listing.currency, listing.materials, listing.compare_at_price is not null, true, array[listing.condition::text, coalesce(listing.audience, 'unisex'), 'verified-seller'], 'active', now(), listing.id)
    returning id into product_id;
    for image in select value from jsonb_array_elements(p_public_images) loop
      insert into public.product_images(product_id, storage_path, public_url, alt_text, position)
      values (product_id, image->>'storage_path', image->>'public_url', coalesce(nullif(image->>'alt_text',''), listing.title), coalesce((image->>'position')::integer, 0));
    end loop;
    if coalesce(array_length(listing.sizes, 1), 0) = 0 then listing.sizes := array['Available']; end if;
    foreach size_value in array listing.sizes loop
      variant_index := variant_index + 1;
      insert into public.product_variants(product_id, sku, name, size, color, attributes, is_active)
      values (product_id, 'SELL-' || upper(left(replace(listing.id::text, '-', ''), 10)) || '-' || variant_index, coalesce(nullif(size_value, ''), 'Available'), nullif(size_value, 'Available'), nullif(array_to_string(listing.colors, ' / '), ''), jsonb_strip_nulls(jsonb_build_object('seller_quantity', listing.quantity, 'weight_kg', listing.weight_kg, 'condition_notes', listing.condition_notes, 'item_reference', listing.item_reference)), true)
      returning id into variant_id;
      insert into public.inventory(variant_id, quantity, allow_backorder) values (variant_id, listing.quantity, false);
    end loop;
  end if;

  update public.seller_listings set status = p_decision::public.seller_listing_status, review_reason = nullif(trim(p_reason), ''), reviewed_at = now(), reviewed_by = (select auth.uid()), published_product_id = coalesce(product_id, published_product_id)
  where id = listing.id returning * into listing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.listing_' || p_decision, 'seller_listing', listing.id);
  return listing;
end;
$$;

commit;
