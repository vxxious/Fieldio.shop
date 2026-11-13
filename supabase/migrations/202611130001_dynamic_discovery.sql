begin;

alter table public.products
  add column sale_starts_at timestamptz,
  add column sale_ends_at timestamptz;
alter table public.seller_listings add column brand_id uuid references public.brands(id) on delete set null;
grant insert (brand_id), update (brand_id) on public.seller_listings to authenticated;

alter table public.products add constraint products_sale_window_check
  check (sale_starts_at is null or sale_ends_at is null or sale_starts_at < sale_ends_at);
alter table public.products add constraint products_discount_price_check
  check (compare_at_price is null or (price is not null and price > 0 and compare_at_price > price)) not valid;

grant insert (sale_starts_at, sale_ends_at), update (sale_starts_at, sale_ends_at) on public.products to authenticated;
create index products_live_brand_published_idx on public.products(brand_id, published_at desc, id desc) where status = 'active';
create index products_live_sale_idx on public.products(published_at desc, id) where status = 'active' and compare_at_price is not null;

create function public.product_sale_active(p public.products)
returns boolean language sql stable set search_path = '' as $$
  select p.compare_at_price is not null and p.price is not null and p.compare_at_price > p.price
    and (p.sale_starts_at is null or p.sale_starts_at <= now())
    and (p.sale_ends_at is null or p.sale_ends_at > now())
$$;

create function public.current_product_price(p public.products)
returns integer language sql stable set search_path = '' as $$
  select case when public.product_sale_active(p) then p.price when p.compare_at_price > p.price then p.compare_at_price else p.price end
$$;

create function public.set_product_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.seller_listing_id is not null and tg_op = 'INSERT' then
    select coalesce(listing.brand_id, new.brand_id) into new.brand_id
    from public.seller_listings listing where listing.id = new.seller_listing_id;
  end if;
  if new.status = 'active' then
    if tg_op = 'INSERT' then
      new.published_at := coalesce(new.published_at, now());
    elsif old.status <> 'active' then
      new.published_at := case when new.seller_listing_id is not null then coalesce(old.published_at, now()) else now() end;
    else
      new.published_at := coalesce(old.published_at, now());
    end if;
  elsif tg_op = 'UPDATE' then
    new.published_at := old.published_at;
  end if;
  return new;
end;
$$;

create trigger set_product_publication before insert or update on public.products
for each row execute function public.set_product_publication();

create view public.discovery_products with (security_invoker = true) as
select p.*,
  public.current_product_price(p) as effective_price,
  case when public.product_sale_active(p) then p.compare_at_price else null end as original_price,
  public.product_sale_active(p) as sale_active,
  (p.published_at > now() - case when p.seller_listing_id is null then interval '3 days' else interval '7 days' end) as new_in_active,
  case when public.product_sale_active(p) then floor((p.compare_at_price - p.price) * 100.0 / p.compare_at_price)::integer else null end as saving_percent
from public.products p
where p.status = 'active' and p.published_at <= now();
grant select on public.discovery_products to anon, authenticated;
grant select on public.brands, public.categories, public.collections, public.product_images, public.product_variants, public.collection_products to anon, authenticated;
revoke all on function public.product_sale_active(public.products), public.current_product_price(public.products), public.set_product_publication() from public, anon, authenticated;
grant execute on function public.product_sale_active(public.products), public.current_product_price(public.products) to anon, authenticated;

create function public.set_vendor_discount(p_listing_id uuid, p_price integer, p_compare_at_price integer default null, p_starts_at timestamptz default null, p_ends_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare listing public.seller_listings;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'SIGN_IN_REQUIRED'; end if;
  if p_price is null or p_price <= 0 or (p_compare_at_price is not null and p_compare_at_price <= p_price)
    or (p_compare_at_price is null and (p_starts_at is not null or p_ends_at is not null))
    or (p_starts_at is not null and p_ends_at is not null and p_starts_at >= p_ends_at)
  then raise exception using errcode = '22023', message = 'INVALID_DISCOUNT'; end if;
  select * into listing from public.seller_listings
  where id = p_listing_id and owner_id = (select auth.uid()) and status = 'approved' for update;
  if not found or not exists (select 1 from public.seller_applications where owner_id = listing.owner_id and status = 'approved')
    or not exists (select 1 from public.seller_stores where id = listing.store_id and owner_id = listing.owner_id and status = 'active')
  then raise exception using errcode = '42501', message = 'LISTING_NOT_AVAILABLE'; end if;
  update public.products set price = p_price, compare_at_price = p_compare_at_price,
    sale_starts_at = p_starts_at, sale_ends_at = p_ends_at
  where id = listing.published_product_id and seller_listing_id = listing.id;
  if not found then raise exception using errcode = 'P0002', message = 'PUBLISHED_PRODUCT_NOT_FOUND'; end if;
  update public.seller_listings set price = p_price, compare_at_price = p_compare_at_price where id = listing.id;
end;
$$;
revoke all on function public.set_vendor_discount(uuid,integer,integer,timestamptz,timestamptz) from public, anon;
grant execute on function public.set_vendor_discount(uuid,integer,integer,timestamptz,timestamptz) to authenticated;

-- Checkout uses exactly the same price rule as discovery, including after a promotion expires.
create or replace function public.create_order_request(p_customer jsonb, p_items jsonb, p_user_id uuid, p_request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
    v_price := case when public.product_sale_active(v_product) then v_product.price else coalesce(v_variant.price_override, public.current_product_price(v_product)) end;
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
revoke all on function public.create_order_request(jsonb,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_order_request(jsonb,jsonb,uuid,uuid) to service_role;

commit;
