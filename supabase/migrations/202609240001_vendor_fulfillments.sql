begin;

create type public.fulfillment_status as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');

create table public.order_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete cascade,
  seller_owner_id uuid references auth.users(id) on delete set null,
  seller_store_id uuid references public.seller_stores(id) on delete set null,
  store_name text not null,
  status public.fulfillment_status not null default 'pending',
  carrier text,
  tracking_reference text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  group_key text not null,
  constraint order_fulfillments_order_group_unique unique (order_request_id, group_key),
  constraint order_fulfillments_tracking_length check (char_length(tracking_reference) <= 120),
  constraint order_fulfillments_carrier_length check (char_length(carrier) <= 120)
);

alter table public.order_items add column fulfillment_id uuid references public.order_fulfillments(id) on delete restrict;

create index order_fulfillments_seller_idx on public.order_fulfillments(seller_owner_id, created_at desc);
create index order_fulfillments_order_idx on public.order_fulfillments(order_request_id);
create index order_fulfillments_status_idx on public.order_fulfillments(status, updated_at desc);
create index order_items_fulfillment_idx on public.order_items(fulfillment_id);

insert into public.order_fulfillments(order_request_id, seller_owner_id, seller_store_id, store_name, group_key)
select distinct items.order_request_id, listings.owner_id, stores.id, coalesce(stores.name, 'Fieldio'), coalesce(stores.id::text, 'fieldio')
from public.order_items items
left join public.products products on products.id = items.product_id
left join public.seller_listings listings on listings.id = products.seller_listing_id
left join public.seller_stores stores on stores.id = listings.store_id
on conflict on constraint order_fulfillments_order_group_unique do nothing;

update public.order_items items
set fulfillment_id = fulfillments.id
from public.order_fulfillments fulfillments
where fulfillments.order_request_id = items.order_request_id
  and fulfillments.group_key = coalesce((
    select stores.id::text
    from public.products products
    join public.seller_listings listings on listings.id = products.seller_listing_id
    join public.seller_stores stores on stores.id = listings.store_id
    where products.id = items.product_id
  ), 'fieldio');

alter table public.order_items alter column fulfillment_id set not null;

create trigger set_order_fulfillments_updated_at before update on public.order_fulfillments
for each row execute procedure public.set_updated_at();
create trigger audit_order_fulfillments after update on public.order_fulfillments
for each row execute function public.audit_admin_change();

alter table public.order_fulfillments enable row level security;

create policy "staff read all fulfillment groups" on public.order_fulfillments for select to authenticated
using (public.has_admin_role(array['owner','admin','fulfilment']));
create policy "approved sellers read own fulfillment groups" on public.order_fulfillments for select to authenticated
using (
  seller_owner_id = (select auth.uid())
  and exists (select 1 from public.seller_applications where owner_id = (select auth.uid()) and status = 'approved')
  and exists (select 1 from public.seller_stores where id = seller_store_id and owner_id = (select auth.uid()) and status = 'active')
);
create policy "approved sellers read own fulfillment items" on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.order_fulfillments fulfillments
    join public.seller_applications applications on applications.owner_id = fulfillments.seller_owner_id and applications.status = 'approved'
    join public.seller_stores stores on stores.id = fulfillments.seller_store_id and stores.status = 'active'
    where fulfillments.id = fulfillment_id
      and fulfillments.seller_owner_id = (select auth.uid())
      and stores.owner_id = (select auth.uid())
  )
);

revoke all on public.order_fulfillments from public, anon, authenticated;
grant select on public.order_fulfillments to authenticated;

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
  if jsonb_array_length(p_items) not between 1 and 25 then raise exception 'INVALID_ITEMS'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  select * into v_order from public.order_requests where request_key = p_request_key;
  if found then
    if v_order.customer_email <> p_customer->>'email' or v_order.user_id is distinct from p_user_id then raise exception 'INVALID_RETRY'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('key', items.id, 'productId', items.product_id, 'variantId', items.product_variant_id, 'productName', items.product_name, 'brand', items.brand_name, 'sku', items.sku, 'selectedVariant', items.variant_name, 'selectedSize', items.size, 'quantity', items.quantity, 'unitPrice', items.unit_price, 'currency', items.currency, 'image', '') order by items.created_at), '[]'::jsonb)
      into v_result from public.order_items items where items.order_request_id = v_order.id;
    return jsonb_build_object('reference', v_order.public_reference, 'items', v_result);
  end if;
  if (select count(*) <> count(distinct item->>'variantId') from jsonb_array_elements(p_items) item) then raise exception 'DUPLICATE_VARIANT'; end if;

  insert into public.order_requests(user_id, customer_name, customer_phone, customer_email, shipping_address, customer_note, request_key, status)
  values(p_user_id, p_customer->>'name', p_customer->>'phone', p_customer->>'email', p_customer->>'shippingAddress', p_customer->>'note', p_request_key, 'order_request') returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity not between 1 and 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and status = 'active' and published_at <= now() for share;
    if not found then raise exception 'UNAVAILABLE_ITEM'; end if;
    select * into v_variant from public.product_variants where id = (v_item->>'variantId')::uuid and product_id = v_product.id and is_active for share;
    if not found then raise exception 'UNAVAILABLE_ITEM'; end if;
    select * into v_inventory from public.inventory where variant_id = v_variant.id for share;
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
  update public.order_requests set currency = v_currency, subtotal = case when v_unpriced then null else v_subtotal end, total = null where id = v_order.id;
  return jsonb_build_object('reference', v_order.public_reference, 'items', v_result);
end;
$$;

revoke all on function public.create_order_request(jsonb,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_order_request(jsonb,jsonb,uuid,uuid) to service_role;

create or replace function public.seller_order_fulfillments()
returns table (
  id uuid,
  order_request_id uuid,
  public_reference text,
  status public.fulfillment_status,
  store_name text,
  customer_name text,
  customer_phone text,
  shipping_address text,
  carrier text,
  tracking_reference text,
  created_at timestamptz,
  updated_at timestamptz,
  items jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.seller_applications where owner_id = (select auth.uid()) and status = 'approved'
  ) then raise exception using errcode = '42501', message = 'SELLER_ACCESS_REQUIRED'; end if;

  return query
  select groups.id, groups.order_request_id, orders.public_reference, groups.status, groups.store_name,
    orders.customer_name, orders.customer_phone, orders.shipping_address, groups.carrier, groups.tracking_reference,
    groups.created_at, groups.updated_at,
    coalesce(jsonb_agg(jsonb_build_object('id', order_items.id, 'productName', order_items.product_name, 'variantName', order_items.variant_name, 'size', order_items.size, 'color', order_items.color, 'quantity', order_items.quantity, 'sku', order_items.sku) order by order_items.created_at), '[]'::jsonb)
  from public.order_fulfillments groups
  join public.order_requests orders on orders.id = groups.order_request_id
  join public.order_items order_items on order_items.fulfillment_id = groups.id
  join public.seller_stores stores on stores.id = groups.seller_store_id and stores.owner_id = groups.seller_owner_id and stores.status = 'active'
  where groups.seller_owner_id = (select auth.uid())
  group by groups.id, orders.id
  order by groups.created_at desc;
end;
$$;

create or replace function public.update_vendor_fulfillment_status(p_fulfillment_id uuid, p_status public.fulfillment_status)
returns public.order_fulfillments
language plpgsql
security definer
set search_path = ''
as $$
declare
  fulfillment public.order_fulfillments;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.seller_applications where owner_id = (select auth.uid()) and status = 'approved'
  ) then raise exception using errcode = '42501', message = 'SELLER_ACCESS_REQUIRED'; end if;

  select * into fulfillment from public.order_fulfillments
  where id = p_fulfillment_id and seller_owner_id = (select auth.uid()) and seller_store_id is not null
  for update;
  if not found or not exists (
    select 1 from public.seller_stores where id = fulfillment.seller_store_id and owner_id = (select auth.uid()) and status = 'active'
  ) then raise exception using errcode = 'P0002', message = 'FULFILLMENT_NOT_FOUND'; end if;
  if fulfillment.status = p_status then return fulfillment; end if;
  if not (
    (fulfillment.status = 'confirmed' and p_status in ('processing', 'shipped'))
    or (fulfillment.status = 'processing' and p_status = 'shipped')
  ) then raise exception using errcode = '23514', message = 'INVALID_FULFILLMENT_STATUS_TRANSITION'; end if;

  update public.order_fulfillments
  set status = p_status,
      shipped_at = case when p_status = 'shipped' and shipped_at is null then now() else shipped_at end
  where id = fulfillment.id
  returning * into fulfillment;
  return fulfillment;
end;
$$;

revoke all on function public.seller_order_fulfillments() from public, anon;
revoke all on function public.update_vendor_fulfillment_status(uuid, public.fulfillment_status) from public, anon;
grant execute on function public.seller_order_fulfillments() to authenticated;
grant execute on function public.update_vendor_fulfillment_status(uuid, public.fulfillment_status) to authenticated;

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

  if p_status = 'confirmed' then
    perform inventory.variant_id
    from public.inventory inventory
    join public.order_items items on items.product_variant_id = inventory.variant_id
    join public.products products on products.id = items.product_id
    where items.order_request_id = p_order_id and not products.inquiry_only
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
    set reserved_quantity = inventory.reserved_quantity + items.quantity
    from public.order_items items
    join public.products products on products.id = items.product_id and not products.inquiry_only
    where items.order_request_id = p_order_id and inventory.variant_id = items.product_variant_id;
  elsif p_status = 'cancelled' and current_order.status in ('confirmed', 'processing') then
    update public.inventory inventory
    set reserved_quantity = greatest(0, inventory.reserved_quantity - items.quantity)
    from public.order_items items
    join public.products products on products.id = items.product_id and not products.inquiry_only
    where items.order_request_id = p_order_id and inventory.variant_id = items.product_variant_id;
  elsif p_status = 'shipped' then
    update public.inventory inventory
    set quantity = greatest(0, inventory.quantity - items.quantity),
        reserved_quantity = greatest(0, inventory.reserved_quantity - items.quantity)
    from public.order_items items
    join public.products products on products.id = items.product_id and not products.inquiry_only
    where items.order_request_id = p_order_id and inventory.variant_id = items.product_variant_id;
  end if;

  update public.order_requests
  set status = p_status,
      confirmed_at = case when p_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end
  where id = p_order_id
  returning * into current_order;

  update public.order_fulfillments
  set status = case
      when p_status = 'confirmed' then 'confirmed'::public.fulfillment_status
      when p_status = 'processing' then 'processing'::public.fulfillment_status
      when p_status = 'shipped' then 'shipped'::public.fulfillment_status
      when p_status = 'delivered' then 'delivered'::public.fulfillment_status
      when p_status = 'cancelled' then 'cancelled'::public.fulfillment_status
      else status
    end,
    shipped_at = case when p_status = 'shipped' and shipped_at is null then now() else shipped_at end,
    delivered_at = case when p_status = 'delivered' and delivered_at is null then now() else delivered_at end
  where order_request_id = p_order_id
    and status not in ('delivered', 'cancelled');

  return current_order;
end;
$$;

revoke all on function public.update_order_request_status(uuid, public.order_request_status) from public, anon;
grant execute on function public.update_order_request_status(uuid, public.order_request_status) to authenticated;

commit;
