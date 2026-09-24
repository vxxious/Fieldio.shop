begin;

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
    select 1 from public.order_fulfillments
    where order_request_id = p_order_id and status in ('shipped', 'delivered')
  ) then raise exception using errcode = '23514', message = 'INVALID_ORDER_STATUS_TRANSITION'; end if;

  if p_status = 'shipped' and exists (
    select 1 from public.order_fulfillments
    where order_request_id = p_order_id and seller_owner_id is not null and status not in ('shipped', 'delivered')
  ) then raise exception using errcode = '23514', message = 'VENDOR_FULFILLMENT_PENDING'; end if;

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
      when p_status = 'confirmed' and status = 'pending' then 'confirmed'::public.fulfillment_status
      when p_status = 'processing' and status in ('pending', 'confirmed') then 'processing'::public.fulfillment_status
      when p_status = 'shipped' and status not in ('delivered', 'cancelled') then 'shipped'::public.fulfillment_status
      when p_status = 'delivered' and status <> 'cancelled' then 'delivered'::public.fulfillment_status
      when p_status = 'cancelled' and status not in ('shipped', 'delivered') then 'cancelled'::public.fulfillment_status
      else status
    end,
    shipped_at = case when p_status = 'shipped' and shipped_at is null then now() else shipped_at end,
    delivered_at = case when p_status = 'delivered' and delivered_at is null then now() else delivered_at end
  where order_request_id = p_order_id;

  return current_order;
end;
$$;

revoke all on function public.update_order_request_status(uuid, public.order_request_status) from public, anon;
grant execute on function public.update_order_request_status(uuid, public.order_request_status) to authenticated;

commit;
