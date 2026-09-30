begin;

alter table public.order_fulfillments
  add column accepted_at timestamptz,
  add column rejected_at timestamptz,
  add column preparing_at timestamptz,
  add column rejection_reason text,
  add constraint order_fulfillments_rejection_reason_length check (
    rejection_reason is null or char_length(btrim(rejection_reason)) between 10 and 500
  ),
  add constraint order_fulfillments_rejection_complete check (
    (status = 'rejected' and rejected_at is not null and rejection_reason is not null)
    or status <> 'rejected'
  );

update public.order_fulfillments
set accepted_at = coalesce(accepted_at, updated_at),
    preparing_at = coalesce(preparing_at, updated_at)
where status in ('processing', 'shipped', 'delivered');

-- Before fulfilment groups were authoritative, a delivered single-group order
-- could retain the group's original pending status. The parent is sufficient
-- evidence for that one group, but not for any group in a multi-group order.
-- Keep delivered_at null when the legacy record has no truthful timestamp.
update public.order_fulfillments fulfillment
set status = 'delivered'
from public.order_requests parent
where parent.id = fulfillment.order_request_id
  and parent.status = 'delivered'
  and fulfillment.status = 'pending'
  and exists (
    select 1
    from public.order_items item
    where item.fulfillment_id = fulfillment.id
  )
  and 1 = (
    select count(*)
    from public.order_fulfillments sibling
    where sibling.order_request_id = fulfillment.order_request_id
  );

drop function if exists public.seller_order_fulfillments();

create function public.seller_order_fulfillments()
returns table (
  id uuid,
  order_request_id uuid,
  public_reference text,
  status public.fulfillment_status,
  payment_status text,
  store_name text,
  customer_name text,
  customer_phone text,
  shipping_address text,
  carrier text,
  tracking_reference text,
  rejection_reason text,
  accepted_at timestamptz,
  rejected_at timestamptz,
  preparing_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
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
    select 1
    from public.seller_applications
    where seller_applications.owner_id = (select auth.uid())
      and seller_applications.status = 'approved'
  ) then raise exception using errcode = '42501', message = 'SELLER_ACCESS_REQUIRED'; end if;

  return query
  select groups.id, groups.order_request_id, orders.public_reference, groups.status, orders.payment_status, groups.store_name,
    case when groups.status in ('accepted', 'processing', 'shipped', 'delivered') then orders.customer_name end,
    case when groups.status in ('accepted', 'processing', 'shipped', 'delivered') then orders.customer_phone end,
    case when groups.status in ('accepted', 'processing', 'shipped', 'delivered') then orders.shipping_address end,
    groups.carrier, groups.tracking_reference, groups.rejection_reason,
    groups.accepted_at, groups.rejected_at, groups.preparing_at, groups.shipped_at, groups.delivered_at,
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

drop function if exists public.update_vendor_fulfillment_status(uuid, public.fulfillment_status, text, text);

create function public.update_vendor_fulfillment_status(
  p_fulfillment_id uuid,
  p_status public.fulfillment_status,
  p_carrier text default null,
  p_tracking_reference text default null,
  p_rejection_reason text default null
)
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

  select groups.* into fulfillment
  from public.order_fulfillments groups
  where groups.id = p_fulfillment_id
    and groups.seller_owner_id = (select auth.uid())
    and groups.seller_store_id is not null
  for update;

  if not found or not exists (
    select 1 from public.seller_stores where id = fulfillment.seller_store_id and owner_id = (select auth.uid()) and status = 'active'
  ) then raise exception using errcode = 'P0002', message = 'FULFILLMENT_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.order_requests where id = fulfillment.order_request_id and payment_status = 'confirmed'
  ) then raise exception using errcode = '23514', message = 'PAYMENT_NOT_CONFIRMED'; end if;
  if fulfillment.status = p_status then return fulfillment; end if;
  if not (
    (fulfillment.status = 'confirmed' and p_status in ('accepted', 'rejected'))
    or (fulfillment.status = 'accepted' and p_status = 'processing')
    or (fulfillment.status = 'processing' and p_status = 'shipped')
  ) then raise exception using errcode = '23514', message = 'INVALID_FULFILLMENT_STATUS_TRANSITION'; end if;
  if p_status = 'rejected' and char_length(btrim(coalesce(p_rejection_reason, ''))) not between 10 and 500 then
    raise exception using errcode = '23514', message = 'REJECTION_REASON_REQUIRED';
  end if;
  if p_status = 'shipped' and (
    nullif(btrim(p_carrier), '') is null or nullif(btrim(p_tracking_reference), '') is null
  ) then raise exception using errcode = '23514', message = 'SHIPPING_DETAILS_REQUIRED'; end if;

  if p_status in ('rejected', 'shipped') then
    perform inventory.variant_id
    from public.inventory inventory
    join public.order_items items on items.product_variant_id = inventory.variant_id
    join public.products products on products.id = items.product_id and not products.inquiry_only
    where items.fulfillment_id = fulfillment.id
    order by inventory.variant_id
    for update of inventory;

    if p_status = 'shipped' and exists (
      select 1
      from (
        select items.product_variant_id, sum(items.quantity)::integer as quantity
        from public.order_items items
        join public.products products on products.id = items.product_id and not products.inquiry_only
        where items.fulfillment_id = fulfillment.id
        group by items.product_variant_id
      ) required
      left join public.inventory inventory on inventory.variant_id = required.product_variant_id
      where inventory.variant_id is null
        or inventory.quantity < required.quantity
        or inventory.reserved_quantity < required.quantity
    ) then raise exception using errcode = '23514', message = 'INVENTORY_RESERVATION_MISSING'; end if;

    update public.inventory inventory
    set quantity = case when p_status = 'shipped' then inventory.quantity - required.quantity else inventory.quantity end,
        reserved_quantity = greatest(0, inventory.reserved_quantity - required.quantity)
    from (
      select items.product_variant_id, sum(items.quantity)::integer as quantity
      from public.order_items items
      join public.products products on products.id = items.product_id and not products.inquiry_only
      where items.fulfillment_id = fulfillment.id
      group by items.product_variant_id
    ) required
    where inventory.variant_id = required.product_variant_id;
  end if;

  update public.order_fulfillments
  set status = p_status,
      rejection_reason = case when p_status = 'rejected' then btrim(p_rejection_reason) else rejection_reason end,
      accepted_at = case when p_status = 'accepted' and accepted_at is null then now() else accepted_at end,
      rejected_at = case when p_status = 'rejected' and rejected_at is null then now() else rejected_at end,
      preparing_at = case when p_status = 'processing' and preparing_at is null then now() else preparing_at end,
      carrier = case when p_status = 'shipped' then btrim(p_carrier) else carrier end,
      tracking_reference = case when p_status = 'shipped' then btrim(p_tracking_reference) else tracking_reference end,
      shipped_at = case when p_status = 'shipped' and shipped_at is null then now() else shipped_at end
  where id = fulfillment.id
  returning * into fulfillment;

  return fulfillment;
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
    select 1 from public.order_fulfillments
    where order_request_id = p_order_id and seller_owner_id is not null and status not in ('accepted', 'processing', 'shipped', 'delivered', 'rejected', 'cancelled')
  ) then raise exception using errcode = '23514', message = 'VENDOR_ACCEPTANCE_PENDING'; end if;
  if p_status = 'processing' and not exists (
    select 1 from public.order_fulfillments
    where order_request_id = p_order_id and status in ('accepted', 'processing', 'shipped', 'delivered')
  ) then raise exception using errcode = '23514', message = 'NO_ACTIVE_FULFILLMENT'; end if;
  if p_status = 'shipped' and exists (
    select 1 from public.order_fulfillments
    where order_request_id = p_order_id and seller_owner_id is not null and status not in ('shipped', 'delivered', 'rejected', 'cancelled')
  ) then raise exception using errcode = '23514', message = 'VENDOR_FULFILLMENT_PENDING'; end if;
  if p_status = 'shipped' and not exists (
    select 1 from public.order_fulfillments
    where order_request_id = p_order_id and status in ('shipped', 'delivered')
  ) then raise exception using errcode = '23514', message = 'NO_ACTIVE_FULFILLMENT'; end if;

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
    set reserved_quantity = inventory.reserved_quantity + required.quantity
    from (
      select items.product_variant_id, sum(items.quantity)::integer as quantity
      from public.order_items items
      join public.products products on products.id = items.product_id and not products.inquiry_only
      where items.order_request_id = p_order_id
      group by items.product_variant_id
    ) required
    where inventory.variant_id = required.product_variant_id;
  elsif p_status = 'cancelled' and current_order.status in ('confirmed', 'processing') then
    update public.inventory inventory
    set reserved_quantity = greatest(0, inventory.reserved_quantity - required.quantity)
    from (
      select items.product_variant_id, sum(items.quantity)::integer as quantity
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
      select items.product_variant_id, sum(items.quantity)::integer as quantity
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
      confirmed_at = case when p_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end
  where id = p_order_id
  returning * into current_order;

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

create function public.confirm_vendor_fulfillment_delivery(p_fulfillment_id uuid)
returns public.order_fulfillments
language plpgsql
security definer
set search_path = ''
as $$
declare
  fulfillment public.order_fulfillments;
begin
  if not public.has_admin_role(array['owner','admin','fulfilment']) then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;

  select groups.* into fulfillment
  from public.order_fulfillments groups
  where groups.id = p_fulfillment_id
  for update;

  if not found then raise exception using errcode = 'P0002', message = 'FULFILLMENT_NOT_FOUND'; end if;
  if fulfillment.status = 'delivered' then return fulfillment; end if;
  if fulfillment.status <> 'shipped' then
    raise exception using errcode = '23514', message = 'FULFILLMENT_NOT_SHIPPED';
  end if;
  if not exists (
    select 1 from public.order_requests orders
    where orders.id = fulfillment.order_request_id and orders.payment_status = 'confirmed'
  ) then raise exception using errcode = '23514', message = 'PAYMENT_NOT_CONFIRMED'; end if;

  update public.order_fulfillments
  set status = 'delivered',
      delivered_at = coalesce(delivered_at, now())
  where id = fulfillment.id
  returning * into fulfillment;

  return fulfillment;
end;
$$;

revoke all on function public.seller_order_fulfillments() from public, anon;
grant execute on function public.seller_order_fulfillments() to authenticated;
revoke all on function public.update_vendor_fulfillment_status(uuid, public.fulfillment_status, text, text, text) from public, anon;
grant execute on function public.update_vendor_fulfillment_status(uuid, public.fulfillment_status, text, text, text) to authenticated;
revoke all on function public.confirm_vendor_fulfillment_delivery(uuid) from public, anon;
grant execute on function public.confirm_vendor_fulfillment_delivery(uuid) to authenticated;
revoke all on function public.update_order_request_status(uuid, public.order_request_status) from public, anon;
grant execute on function public.update_order_request_status(uuid, public.order_request_status) to authenticated;

commit;
