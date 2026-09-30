begin;

alter table public.order_requests add column inventory_reserved_at timestamptz;

update public.order_requests
set inventory_reserved_at = coalesce(confirmed_at, updated_at)
where status in ('confirmed', 'processing', 'shipped', 'delivered');

alter table public.seller_listings drop constraint seller_listings_quantity_check;
alter table public.seller_listings add constraint seller_listings_quantity_check check (quantity >= 0);

create table public.seller_listing_variants (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  published_variant_id uuid unique references public.product_variants(id) on delete set null,
  size text not null check (char_length(btrim(size)) between 1 and 80),
  color text not null check (char_length(btrim(color)) between 1 and 80),
  quantity integer not null check (quantity between 0 and 10000),
  position integer not null default 0 check (position between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index seller_listing_variants_option_unique
  on public.seller_listing_variants(listing_id, lower(btrim(size)), lower(btrim(color)));
create index seller_listing_variants_listing_idx
  on public.seller_listing_variants(listing_id, position);

create trigger set_seller_listing_variants_updated_at
before update on public.seller_listing_variants
for each row execute procedure public.set_updated_at();

alter table public.seller_listing_variants enable row level security;
revoke all on public.seller_listing_variants from public, anon, authenticated;
grant select on public.seller_listing_variants to authenticated;

create policy "owners and management read seller listing variants" on public.seller_listing_variants for select to authenticated
using (owner_id = (select auth.uid()) or public.has_admin_role(array['owner','admin']));

insert into public.seller_listing_variants(
  listing_id, owner_id, published_variant_id, size, color, quantity, position
)
select listing.id, listing.owner_id, variant.id,
  coalesce(nullif(btrim(variant.size), ''), 'One size'),
  coalesce(nullif(btrim(variant.color), ''), 'Default'),
  inventory.quantity,
  (row_number() over (partition by listing.id order by variant.created_at, variant.id) - 1)::integer
from public.seller_listings listing
join public.products product on product.id = listing.published_product_id
join public.product_variants variant on variant.product_id = product.id
join public.inventory inventory on inventory.variant_id = variant.id;

insert into public.seller_listing_variants(listing_id, owner_id, size, color, quantity, position)
select listing.id, listing.owner_id,
  'Unspecified',
  'Unspecified',
  listing.quantity,
  0
from public.seller_listings listing
where not exists (
  select 1 from public.seller_listing_variants matrix where matrix.listing_id = listing.id
);

update public.seller_listings listing
set quantity = totals.quantity
from (
  select listing_id, sum(quantity)::integer quantity
  from public.seller_listing_variants group by listing_id
) totals
where listing.id = totals.listing_id;

create function public.save_seller_listing_inventory(p_listing_id uuid, p_variants jsonb)
returns setof public.seller_listing_variants
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.seller_listings;
  item jsonb;
  item_index integer := 0;
  total_quantity integer;
  v_colors text[];
  v_sizes text[];
begin
  select * into listing
  from public.seller_listings
  where id = p_listing_id and owner_id = (select auth.uid())
  for update;

  if not found or listing.status not in ('draft', 'rejected') then
    raise exception using errcode = '42501', message = 'LISTING_INVENTORY_NOT_EDITABLE';
  end if;
  if not exists (
    select 1
    from public.seller_applications application
    join public.seller_stores store on store.id = listing.store_id and store.owner_id = listing.owner_id and store.status = 'active'
    where application.owner_id = listing.owner_id and application.status = 'approved'
  ) then raise exception using errcode = '42501', message = 'SELLER_ACCESS_REQUIRED'; end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_INVENTORY_MATRIX';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_variants) entry
    where jsonb_typeof(entry) <> 'object'
      or char_length(btrim(coalesce(entry->>'size', ''))) not between 1 and 80
      or char_length(btrim(coalesce(entry->>'color', ''))) not between 1 and 80
      or coalesce(entry->>'quantity', '') !~ '^[0-9]+$'
      or (entry->>'quantity')::integer not between 0 and 10000
  ) then raise exception using errcode = '22023', message = 'INVALID_INVENTORY_VARIANT'; end if;
  if exists (
    select 1
    from jsonb_array_elements(p_variants) entry
    group by lower(btrim(entry->>'size')), lower(btrim(entry->>'color'))
    having count(*) > 1
  ) then raise exception using errcode = '23505', message = 'DUPLICATE_INVENTORY_VARIANT'; end if;

  select sum((entry->>'quantity')::integer) into total_quantity
  from jsonb_array_elements(p_variants) entry;
  if total_quantity < 1 then
    raise exception using errcode = '22023', message = 'INVALID_TOTAL_INVENTORY';
  end if;

  select array_agg(value order by first_position) into v_colors
  from (
    select btrim(entry->>'color') value, min(ordinality) first_position
    from jsonb_array_elements(p_variants) with ordinality valueset(entry, ordinality)
    group by btrim(entry->>'color')
  ) distinct_colors;
  select array_agg(value order by first_position) into v_sizes
  from (
    select btrim(entry->>'size') value, min(ordinality) first_position
    from jsonb_array_elements(p_variants) with ordinality valueset(entry, ordinality)
    group by btrim(entry->>'size')
  ) distinct_sizes;

  delete from public.seller_listing_variants where listing_id = listing.id;
  for item in select value from jsonb_array_elements(p_variants) loop
    insert into public.seller_listing_variants(listing_id, owner_id, size, color, quantity, position)
    values (
      listing.id, listing.owner_id, btrim(item->>'size'), btrim(item->>'color'),
      (item->>'quantity')::integer, item_index
    );
    item_index := item_index + 1;
  end loop;

  update public.seller_listings
  set colors = v_colors, sizes = v_sizes, quantity = total_quantity
  where id = listing.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'seller.inventory_saved', 'seller_listing', listing.id::text,
    jsonb_build_object('variants', jsonb_array_length(p_variants), 'quantity', total_quantity));

  return query
  select matrix.* from public.seller_listing_variants matrix
  where matrix.listing_id = listing.id order by matrix.position;
end;
$$;

create function public.update_seller_listing_inventory(p_listing_id uuid, p_variants jsonb)
returns setof public.seller_listing_variants
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.seller_listings;
  supplied_count integer;
begin
  select * into listing
  from public.seller_listings
  where id = p_listing_id and owner_id = (select auth.uid()) and status = 'approved';
  if not found then raise exception using errcode = '42501', message = 'LIVE_INVENTORY_NOT_EDITABLE'; end if;
  if not exists (
    select 1
    from public.seller_applications application
    join public.seller_stores store on store.id = listing.store_id and store.owner_id = listing.owner_id and store.status = 'active'
    where application.owner_id = listing.owner_id and application.status = 'approved'
  ) then raise exception using errcode = '42501', message = 'SELLER_ACCESS_REQUIRED'; end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_INVENTORY_MATRIX';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_variants) entry
    where coalesce(entry->>'id', '') !~ '^[0-9a-fA-F-]{36}$'
      or coalesce(entry->>'quantity', '') !~ '^[0-9]+$'
      or (entry->>'quantity')::integer not between 0 and 10000
  ) then raise exception using errcode = '22023', message = 'INVALID_INVENTORY_VARIANT'; end if;
  if (select count(*) <> count(distinct entry->>'id') from jsonb_array_elements(p_variants) entry) then
    raise exception using errcode = '23505', message = 'DUPLICATE_INVENTORY_VARIANT';
  end if;

  supplied_count := jsonb_array_length(p_variants);
  if supplied_count <> (
    select count(*) from public.seller_listing_variants
    where listing_id = listing.id and published_variant_id is not null
  ) or supplied_count <> (
    select count(*)
    from jsonb_array_elements(p_variants) entry
    join public.seller_listing_variants matrix
      on matrix.id = (entry->>'id')::uuid and matrix.listing_id = listing.id and matrix.published_variant_id is not null
  ) then raise exception using errcode = '22023', message = 'INCOMPLETE_INVENTORY_MATRIX'; end if;

  perform inventory.variant_id
  from public.inventory inventory
  join public.seller_listing_variants matrix on matrix.published_variant_id = inventory.variant_id
  where matrix.listing_id = listing.id
  order by inventory.variant_id
  for update of inventory;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) entry
    join public.seller_listing_variants matrix on matrix.id = (entry->>'id')::uuid
    join public.inventory inventory on inventory.variant_id = matrix.published_variant_id
    where matrix.listing_id = listing.id and (entry->>'quantity')::integer < inventory.reserved_quantity
  ) then raise exception using errcode = '23514', message = 'QUANTITY_BELOW_RESERVED_STOCK'; end if;

  update public.inventory inventory
  set quantity = (entry.value->>'quantity')::integer
  from jsonb_array_elements(p_variants) entry(value)
  join public.seller_listing_variants matrix on matrix.id = (entry.value->>'id')::uuid
  where matrix.listing_id = listing.id and inventory.variant_id = matrix.published_variant_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'seller.live_inventory_updated', 'seller_listing', listing.id::text,
    jsonb_build_object('variants', supplied_count));

  return query
  select matrix.* from public.seller_listing_variants matrix
  where matrix.listing_id = listing.id order by matrix.position;
end;
$$;

create function public.sync_seller_listing_variant_quantity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing_id uuid;
begin
  select listing_id into v_listing_id
  from public.seller_listing_variants
  where published_variant_id = new.variant_id;
  update public.seller_listing_variants
  set quantity = new.quantity
  where published_variant_id = new.variant_id and quantity <> new.quantity;
  if v_listing_id is not null then
    update public.seller_listings
    set quantity = (select sum(quantity)::integer from public.seller_listing_variants where listing_id = v_listing_id)
    where id = v_listing_id;
  end if;
  return new;
end;
$$;

create trigger sync_seller_listing_variant_quantity
after update of quantity on public.inventory
for each row execute function public.sync_seller_listing_variant_quantity();

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
  if not exists (
    select 1 from public.seller_listing_variants where listing_id = listing.id and quantity > 0
  ) then raise exception 'Add at least one in-stock size and colour'; end if;
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
  matrix public.seller_listing_variants;
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
    if not exists (select 1 from public.seller_listing_variants where listing_id = listing.id and quantity > 0) then raise exception 'Inventory matrix is required'; end if;
    select * into store from public.seller_stores where id = listing.store_id and status = 'active';
    if store.id is null then raise exception 'Seller store is not active'; end if;
    select id into brand_id from public.brands where lower(name) = lower(store.name) limit 1;
    if brand_id is null then
      insert into public.brands(name, slug, description, is_active) values (store.name, store.slug, store.description, true) returning id into brand_id;
    end if;
    product_slug := regexp_replace(lower(listing.title), '[^a-z0-9]+', '-', 'g');
    product_slug := trim(both '-' from product_slug) || '-' || left(replace(listing.id::text, '-', ''), 8);
    insert into public.products(sku, name, slug, brand_id, category_id, description, short_description, price, compare_at_price, currency, materials, is_sale, inquiry_only, tags, status, published_at, seller_listing_id)
    values ('SELL-' || upper(left(replace(listing.id::text, '-', ''), 12)), listing.title, product_slug, brand_id, coalesce(listing.subcategory_id, listing.category_id), listing.description, left(listing.description, 240), listing.price, listing.compare_at_price, listing.currency, listing.materials, listing.compare_at_price is not null, false, array[listing.condition::text, coalesce(listing.audience, 'unisex'), 'verified-seller'], 'active', now(), listing.id)
    returning id into product_id;
    for image in select value from jsonb_array_elements(p_public_images) loop
      insert into public.product_images(product_id, storage_path, public_url, alt_text, position)
      values (product_id, image->>'storage_path', image->>'public_url', coalesce(nullif(image->>'alt_text',''), listing.title), coalesce((image->>'position')::integer, 0));
    end loop;
    for matrix in
      select * from public.seller_listing_variants where listing_id = listing.id order by position, id
    loop
      variant_index := variant_index + 1;
      insert into public.product_variants(product_id, sku, name, size, color, attributes, is_active)
      values (
        product_id,
        'SELL-' || upper(left(replace(listing.id::text, '-', ''), 10)) || '-' || variant_index,
        matrix.color || ' / ' || matrix.size,
        matrix.size,
        matrix.color,
        jsonb_strip_nulls(jsonb_build_object('weight_kg', listing.weight_kg, 'condition_notes', listing.condition_notes, 'item_reference', listing.item_reference)),
        true
      ) returning id into variant_id;
      insert into public.inventory(variant_id, quantity, allow_backorder) values (variant_id, matrix.quantity, false);
      update public.seller_listing_variants set published_variant_id = variant_id where id = matrix.id;
    end loop;
  end if;

  update public.seller_listings set status = p_decision::public.seller_listing_status, review_reason = nullif(trim(p_reason), ''), reviewed_at = now(), reviewed_by = (select auth.uid()), published_product_id = coalesce(product_id, published_product_id)
  where id = listing.id returning * into listing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.listing_' || p_decision, 'seller_listing', listing.id);
  return listing;
end;
$$;

create or replace function public.create_order_request(p_customer jsonb, p_items jsonb, p_user_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.order_requests;
  v_item jsonb;
  v_product public.products;
  v_variant public.product_variants;
  v_inventory public.inventory;
  v_price integer;
  v_quantity integer;
  v_subtotal integer := 0;
  v_unpriced boolean := false;
  v_currency text;
  v_result jsonb := '[]'::jsonb;
  v_brand text;
  v_store_id uuid;
  v_store_owner_id uuid;
  v_store_name text;
  v_fulfillment_id uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 25 then raise exception 'INVALID_ITEMS'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  select * into v_order from public.order_requests where request_key = p_request_key;
  if found then
    if v_order.customer_email <> p_customer->>'email' or v_order.user_id is distinct from p_user_id then raise exception 'INVALID_RETRY'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('key', items.id, 'productId', items.product_id, 'variantId', items.product_variant_id, 'productName', items.product_name, 'brand', items.brand_name, 'sku', items.sku, 'selectedVariant', items.variant_name, 'selectedSize', items.size, 'quantity', items.quantity, 'unitPrice', items.unit_price, 'currency', items.currency, 'image', '') order by items.created_at), '[]'::jsonb)
      into v_result from public.order_items items where items.order_request_id = v_order.id;
    return jsonb_build_object('reference', v_order.public_reference, 'items', v_result);
  end if;
  if (select count(*) <> count(distinct item->>'variantId') from jsonb_array_elements(p_items) item) then raise exception 'DUPLICATE_VARIANT'; end if;

  perform inventory.variant_id
  from public.inventory inventory
  join jsonb_array_elements(p_items) item on inventory.variant_id = (item->>'variantId')::uuid
  order by inventory.variant_id
  for update of inventory;

  insert into public.order_requests(user_id, customer_name, customer_phone, customer_email, shipping_address, customer_note, request_key, status)
  values(p_user_id, p_customer->>'name', p_customer->>'phone', p_customer->>'email', p_customer->>'shippingAddress', p_customer->>'note', p_request_key, 'order_request') returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity not between 1 and 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and status = 'active' and published_at <= now() for share;
    if not found then raise exception 'UNAVAILABLE_ITEM'; end if;
    select * into v_variant from public.product_variants where id = (v_item->>'variantId')::uuid and product_id = v_product.id and is_active for share;
    if not found then raise exception 'UNAVAILABLE_ITEM'; end if;
    select * into v_inventory from public.inventory where variant_id = v_variant.id;
    if not v_product.inquiry_only and (not found or (not v_inventory.allow_backorder and v_inventory.quantity - v_inventory.reserved_quantity < v_quantity)) then raise exception 'INSUFFICIENT_STOCK'; end if;
    if v_currency is not null and v_currency <> v_product.currency then raise exception 'MIXED_CURRENCY'; end if;
    v_currency := v_product.currency;
    v_price := coalesce(v_variant.price_override, v_product.price);
    v_unpriced := v_unpriced or v_price is null;
    v_subtotal := v_subtotal + coalesce(v_price, 0) * v_quantity;
    select name into v_brand from public.brands where id = v_product.brand_id;

    v_store_id := null;
    v_store_owner_id := null;
    v_store_name := 'Fieldio';
    if v_product.seller_listing_id is not null then
      select stores.id, listings.owner_id, stores.name
        into v_store_id, v_store_owner_id, v_store_name
      from public.seller_listings listings
      join public.seller_stores stores on stores.id = listings.store_id and stores.owner_id = listings.owner_id
      join public.seller_applications applications on applications.owner_id = listings.owner_id and applications.status = 'approved'
      where listings.id = v_product.seller_listing_id and listings.status = 'approved' and stores.status = 'active';
      if v_store_id is null then raise exception 'UNAVAILABLE_ITEM'; end if;
    end if;

    insert into public.order_fulfillments(order_request_id, seller_owner_id, seller_store_id, store_name, group_key)
    values(v_order.id, v_store_owner_id, v_store_id, v_store_name, coalesce(v_store_id::text, 'fieldio'))
    on conflict on constraint order_fulfillments_order_group_unique do update set store_name = excluded.store_name
    returning id into v_fulfillment_id;

    insert into public.order_items(fulfillment_id, order_request_id, product_id, product_variant_id, product_name, brand_name, sku, variant_name, size, color, quantity, unit_price, line_total, currency)
    values(v_fulfillment_id, v_order.id, v_product.id, v_variant.id, v_product.name, coalesce(v_brand, 'Fieldio'), v_variant.sku, v_variant.name, v_variant.size, v_variant.color, v_quantity, v_price, v_price * v_quantity, v_currency);
    v_result := v_result || jsonb_build_array(jsonb_build_object('key', v_variant.id, 'productId', v_product.id, 'variantId', v_variant.id, 'productName', v_product.name, 'brand', coalesce(v_brand, 'Fieldio'), 'sku', v_variant.sku, 'selectedVariant', v_variant.name, 'selectedSize', v_variant.size, 'quantity', v_quantity, 'unitPrice', v_price, 'currency', v_currency, 'image', ''));
  end loop;

  update public.inventory inventory
  set reserved_quantity = inventory.reserved_quantity + required.quantity
  from (
    select items.product_variant_id, sum(items.quantity)::integer quantity
    from public.order_items items
    join public.products products on products.id = items.product_id and not products.inquiry_only
    where items.order_request_id = v_order.id
    group by items.product_variant_id
  ) required
  where inventory.variant_id = required.product_variant_id;

  update public.order_requests
  set currency = v_currency,
      subtotal = case when v_unpriced then null else v_subtotal end,
      total = null,
      inventory_reserved_at = now()
  where id = v_order.id;
  return jsonb_build_object('reference', v_order.public_reference, 'items', v_result);
end;
$$;

create or replace function public.update_order_request_status(p_order_id uuid, p_status public.order_request_status)
returns public.order_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.order_requests;
begin
  if not public.has_admin_role(array['owner','admin','fulfilment']) then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;
  select * into current_order from public.order_requests where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_REQUEST_NOT_FOUND'; end if;
  if current_order.status = p_status then return current_order; end if;
  if not (
    case current_order.status
      when 'order_request' then p_status in ('awaiting_confirmation', 'cancelled')
      when 'awaiting_confirmation' then p_status in ('confirmed', 'cancelled')
      when 'confirmed' then p_status in ('processing', 'cancelled')
      when 'processing' then p_status in ('shipped', 'cancelled')
      when 'shipped' then p_status = 'delivered'
      else false
    end
  ) then raise exception using errcode = '23514', message = 'INVALID_ORDER_STATUS_TRANSITION'; end if;
  if p_status = 'cancelled' and exists (
    select 1 from public.order_fulfillments where order_request_id = p_order_id and status in ('shipped', 'delivered')
  ) then raise exception using errcode = '23514', message = 'INVALID_ORDER_STATUS_TRANSITION'; end if;
  if p_status = 'processing' and exists (
    select 1 from public.order_fulfillments where order_request_id = p_order_id and seller_owner_id is not null and status not in ('accepted', 'processing', 'shipped', 'delivered', 'rejected', 'cancelled')
  ) then raise exception using errcode = '23514', message = 'VENDOR_ACCEPTANCE_PENDING'; end if;
  if p_status = 'processing' and not exists (
    select 1 from public.order_fulfillments where order_request_id = p_order_id and status in ('accepted', 'processing', 'shipped', 'delivered')
  ) then raise exception using errcode = '23514', message = 'NO_ACTIVE_FULFILLMENT'; end if;
  if p_status = 'shipped' and exists (
    select 1 from public.order_fulfillments where order_request_id = p_order_id and seller_owner_id is not null and status not in ('shipped', 'delivered', 'rejected', 'cancelled')
  ) then raise exception using errcode = '23514', message = 'VENDOR_FULFILLMENT_PENDING'; end if;
  if p_status = 'shipped' and not exists (
    select 1 from public.order_fulfillments where order_request_id = p_order_id and status in ('shipped', 'delivered')
  ) then raise exception using errcode = '23514', message = 'NO_ACTIVE_FULFILLMENT'; end if;

  if p_status = 'confirmed' and current_order.inventory_reserved_at is null then
    perform inventory.variant_id
    from public.inventory inventory
    join public.order_items items on items.product_variant_id = inventory.variant_id
    join public.products products on products.id = items.product_id and not products.inquiry_only
    where items.order_request_id = p_order_id
    order by inventory.variant_id
    for update of inventory;
    if exists (
      select 1
      from public.order_items items
      join public.products products on products.id = items.product_id and not products.inquiry_only
      left join public.inventory inventory on inventory.variant_id = items.product_variant_id
      where items.order_request_id = p_order_id
        and (inventory.variant_id is null or (not inventory.allow_backorder and inventory.quantity - inventory.reserved_quantity < items.quantity))
    ) then raise exception using errcode = '23514', message = 'INSUFFICIENT_STOCK'; end if;
    update public.inventory inventory
    set reserved_quantity = inventory.reserved_quantity + required.quantity
    from (
      select items.product_variant_id, sum(items.quantity)::integer quantity
      from public.order_items items
      join public.products products on products.id = items.product_id and not products.inquiry_only
      where items.order_request_id = p_order_id
      group by items.product_variant_id
    ) required
    where inventory.variant_id = required.product_variant_id;
  elsif p_status = 'cancelled' and current_order.inventory_reserved_at is not null then
    perform inventory.variant_id
    from public.inventory inventory
    join public.order_items items on items.product_variant_id = inventory.variant_id
    join public.order_fulfillments groups on groups.id = items.fulfillment_id and groups.status in ('pending', 'confirmed', 'accepted', 'processing')
    where items.order_request_id = p_order_id
    order by inventory.variant_id
    for update of inventory;
    update public.inventory inventory
    set reserved_quantity = greatest(0, inventory.reserved_quantity - required.quantity)
    from (
      select items.product_variant_id, sum(items.quantity)::integer quantity
      from public.order_items items
      join public.order_fulfillments groups on groups.id = items.fulfillment_id and groups.status in ('pending', 'confirmed', 'accepted', 'processing')
      join public.products products on products.id = items.product_id and not products.inquiry_only
      where items.order_request_id = p_order_id
      group by items.product_variant_id
    ) required
    where inventory.variant_id = required.product_variant_id;
  elsif p_status = 'shipped' then
    update public.inventory inventory
    set quantity = inventory.quantity - required.quantity,
        reserved_quantity = greatest(0, inventory.reserved_quantity - required.quantity)
    from (
      select items.product_variant_id, sum(items.quantity)::integer quantity
      from public.order_items items
      join public.order_fulfillments groups on groups.id = items.fulfillment_id and groups.seller_owner_id is null and groups.status = 'processing'
      join public.products products on products.id = items.product_id and not products.inquiry_only
      where items.order_request_id = p_order_id
      group by items.product_variant_id
    ) required
    where inventory.variant_id = required.product_variant_id;
  end if;

  update public.order_requests
  set status = p_status,
      confirmed_at = case when p_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end,
      inventory_reserved_at = case when p_status = 'confirmed' and inventory_reserved_at is null then now() else inventory_reserved_at end
  where id = p_order_id returning * into current_order;

  update public.order_fulfillments
  set status = case
      when p_status = 'confirmed' and status = 'pending' then 'confirmed'::public.fulfillment_status
      when p_status = 'processing' and seller_owner_id is null and status in ('pending', 'confirmed') then 'processing'::public.fulfillment_status
      when p_status = 'shipped' and seller_owner_id is null and status = 'processing' then 'shipped'::public.fulfillment_status
      when p_status = 'delivered' and status = 'shipped' then 'delivered'::public.fulfillment_status
      when p_status = 'cancelled' and status in ('pending', 'confirmed', 'accepted', 'processing') then 'cancelled'::public.fulfillment_status
      else status
    end,
    preparing_at = case when p_status = 'processing' and seller_owner_id is null and preparing_at is null then now() else preparing_at end,
    shipped_at = case when p_status = 'shipped' and seller_owner_id is null and shipped_at is null then now() else shipped_at end,
    delivered_at = case when p_status = 'delivered' and status = 'shipped' and delivered_at is null then now() else delivered_at end
  where order_request_id = p_order_id;

  return current_order;
end;
$$;

revoke all on function public.save_seller_listing_inventory(uuid, jsonb), public.update_seller_listing_inventory(uuid, jsonb) from public, anon;
grant execute on function public.save_seller_listing_inventory(uuid, jsonb), public.update_seller_listing_inventory(uuid, jsonb) to authenticated;
revoke all on function public.sync_seller_listing_variant_quantity() from public, anon, authenticated;
revoke all on function public.create_order_request(jsonb,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_order_request(jsonb,jsonb,uuid,uuid) to service_role;
revoke all on function public.update_order_request_status(uuid, public.order_request_status) from public, anon;
grant execute on function public.update_order_request_status(uuid, public.order_request_status) to authenticated;

comment on column public.seller_listings.quantity is 'Legacy total quantity maintained from seller_listing_variants for compatibility.';
comment on table public.seller_listing_variants is 'Authoritative size and colour inventory matrix for seller listings.';

commit;
