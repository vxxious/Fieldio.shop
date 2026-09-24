begin;

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
    select 1
    from public.seller_applications applications
    where applications.owner_id = (select auth.uid()) and applications.status = 'approved'
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

revoke all on function public.seller_order_fulfillments() from public, anon;
grant execute on function public.seller_order_fulfillments() to authenticated;

commit;
