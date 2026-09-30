begin;

drop function public.buyer_order_fulfillments();

create function public.buyer_order_fulfillments()
returns table (
  order_request_id uuid,
  store_name text,
  status public.fulfillment_status,
  carrier text,
  tracking_reference text,
  accepted_at timestamptz,
  preparing_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  rejected_at timestamptz,
  updated_at timestamptz,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    groups.order_request_id,
    groups.store_name,
    groups.status,
    groups.carrier,
    groups.tracking_reference,
    groups.accepted_at,
    groups.preparing_at,
    groups.shipped_at,
    groups.delivered_at,
    groups.rejected_at,
    groups.updated_at,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', order_items.id,
      'productId', order_items.product_id,
      'productSlug', products.slug,
      'productName', order_items.product_name,
      'quantity', order_items.quantity,
      'reviewId', reviews.id
    ) order by order_items.product_name, order_items.id) filter (where order_items.id is not null), '[]'::jsonb)
  from public.order_fulfillments groups
  join public.order_requests requests on requests.id = groups.order_request_id
  left join public.order_items on order_items.fulfillment_id = groups.id
  left join public.products on products.id = order_items.product_id
  left join public.product_reviews reviews
    on reviews.order_item_id = order_items.id
    and reviews.buyer_id = (select auth.uid())
  where requests.user_id = (select auth.uid())
  group by groups.id;
$$;

revoke all on function public.buyer_order_fulfillments() from public, anon;
grant execute on function public.buyer_order_fulfillments() to authenticated;

commit;
