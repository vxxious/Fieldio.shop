begin;

create type public.order_fulfillment_summary_status as enum (
  'pending',
  'awaiting_vendor',
  'partially_accepted',
  'accepted',
  'preparing',
  'partially_fulfilled',
  'shipped',
  'partially_delivered',
  'delivered',
  'partially_rejected',
  'rejected',
  'cancelled'
);

alter table public.order_requests
  add column fulfillment_status public.order_fulfillment_summary_status not null default 'pending';

create function public.compute_order_fulfillment_status(p_order_id uuid)
returns public.order_fulfillment_summary_status
language sql
volatile
security definer
set search_path = ''
as $$
  with totals as (
    select
      count(*)::integer total,
      count(*) filter (where status = 'confirmed')::integer confirmed,
      count(*) filter (where status = 'accepted')::integer accepted,
      count(*) filter (where status = 'processing')::integer processing,
      count(*) filter (where status = 'shipped')::integer shipped,
      count(*) filter (where status = 'delivered')::integer delivered,
      count(*) filter (where status = 'rejected')::integer rejected,
      count(*) filter (where status = 'cancelled')::integer cancelled
    from public.order_fulfillments
    where order_request_id = p_order_id
  )
  select (case
    when total = 0 then 'pending'
    when delivered = total then 'delivered'
    when rejected = total then 'rejected'
    when cancelled = total then 'cancelled'
    when delivered > 0 then 'partially_delivered'
    when shipped = total then 'shipped'
    when shipped > 0 then 'partially_fulfilled'
    when rejected + cancelled > 0 then 'partially_rejected'
    when processing > 0 then 'preparing'
    when accepted = total then 'accepted'
    when accepted > 0 then 'partially_accepted'
    when confirmed > 0 then 'awaiting_vendor'
    else 'pending'
  end)::public.order_fulfillment_summary_status
  from totals;
$$;

revoke all on function public.compute_order_fulfillment_status(uuid) from public, anon, authenticated;

create function public.sync_order_fulfillment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_id uuid := case when TG_OP = 'DELETE' then old.order_request_id else new.order_request_id end;
  summary public.order_fulfillment_summary_status;
  active_count integer;
  preparing_count integer;
  shipped_count integer;
  delivered_count integer;
begin
  summary := public.compute_order_fulfillment_status(order_id);

  select
    count(*) filter (where status not in ('rejected', 'cancelled')),
    count(*) filter (where status in ('processing', 'shipped', 'delivered')),
    count(*) filter (where status = 'shipped'),
    count(*) filter (where status = 'delivered')
  into active_count, preparing_count, shipped_count, delivered_count
  from public.order_fulfillments
  where order_request_id = order_id;

  update public.order_requests
  set fulfillment_status = summary,
      status = case
        when status not in ('confirmed', 'processing', 'shipped', 'delivered') then status
        when active_count > 0 and delivered_count = active_count then 'delivered'::public.order_request_status
        when active_count > 0 and shipped_count + delivered_count = active_count then 'shipped'::public.order_request_status
        when preparing_count > 0 then 'processing'::public.order_request_status
        else 'confirmed'::public.order_request_status
      end
  where id = order_id;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.sync_order_fulfillment_status() from public, anon, authenticated;

create trigger sync_order_fulfillment_status
after insert or delete or update of status on public.order_fulfillments
for each row execute function public.sync_order_fulfillment_status();

update public.order_requests requests
set fulfillment_status = public.compute_order_fulfillment_status(requests.id);

create function public.buyer_order_fulfillments()
returns table (
  order_request_id uuid,
  store_name text,
  status public.fulfillment_status,
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
    groups.updated_at,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', order_items.id,
      'productName', order_items.product_name,
      'quantity', order_items.quantity
    ) order by order_items.product_name, order_items.id) filter (where order_items.id is not null), '[]'::jsonb)
  from public.order_fulfillments groups
  join public.order_requests requests on requests.id = groups.order_request_id
  left join public.order_items on order_items.fulfillment_id = groups.id
  where requests.user_id = (select auth.uid())
  group by groups.id;
$$;

revoke all on function public.buyer_order_fulfillments() from public, anon;
grant execute on function public.buyer_order_fulfillments() to authenticated;

create or replace function public.review_eligibility(p_product_id uuid)
returns table (
  order_item_id uuid,
  product_variant_id uuid,
  purchased_variant text,
  purchased_size text,
  purchased_color text,
  purchased_at timestamptz,
  existing_review_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select item.id, item.product_variant_id, item.variant_name, item.size, item.color, request.created_at, review.id
  from public.order_items item
  join public.order_requests request on request.id = item.order_request_id
  join public.order_fulfillments fulfillment on fulfillment.id = item.fulfillment_id and fulfillment.status = 'delivered'
  left join public.product_reviews review on review.order_item_id = item.id and review.buyer_id = (select auth.uid())
  where request.user_id = (select auth.uid())
    and item.product_id = p_product_id
  order by request.created_at desc;
$$;

create or replace function public.create_product_review(
  p_order_item_id uuid,
  p_rating integer,
  p_review_text text,
  p_tags text[] default '{}'
)
returns public.product_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.order_items;
  v_request public.order_requests;
  v_profile public.profiles;
  v_review public.product_reviews;
  v_tags text[];
  v_name text;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to write a review'; end if;
  if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if char_length(trim(coalesce(p_review_text, ''))) not between 20 and 3000 then raise exception 'Review must be between 20 and 3000 characters'; end if;

  select * into v_item from public.order_items where id = p_order_item_id for update;
  if v_item.id is null or v_item.product_id is null then raise exception 'Purchased item not found'; end if;
  select * into v_request from public.order_requests where id = v_item.order_request_id;
  if v_request.user_id <> (select auth.uid()) or not exists (
    select 1 from public.order_fulfillments fulfillment
    where fulfillment.id = v_item.fulfillment_id and fulfillment.status = 'delivered'
  ) then raise exception 'Only a verified buyer can review this item'; end if;
  if exists (
    select 1 from public.products product
    join public.seller_listings listing on listing.id = product.seller_listing_id
    where product.id = v_item.product_id and listing.owner_id = (select auth.uid())
  ) then raise exception 'Sellers cannot review their own products'; end if;

  select coalesce(array_agg(distinct tag order by tag), '{}') into v_tags
  from unnest(coalesce(p_tags, '{}')) tag;
  if cardinality(v_tags) > 3 or not v_tags <@ array['perfect_fit','good_quality','comfortable','true_to_description','beautiful_design','fast_delivery']::text[] then
    raise exception 'Invalid review tags';
  end if;

  select * into v_profile from public.profiles where id = (select auth.uid());
  v_name := trim(coalesce(v_profile.full_name, ''));
  if v_name = '' then
    v_name := 'Fieldio buyer';
  elsif position(' ' in v_name) > 0 then
    v_name := split_part(v_name, ' ', 1) || ' ' || left(regexp_replace(v_name, '^.*\s+', ''), 1) || '.';
  else
    v_name := left(v_name, 1) || '***';
  end if;

  insert into public.product_reviews (
    product_id, buyer_id, order_item_id, product_variant_id, rating, review_text, reviewer_name,
    purchased_variant, purchased_size, purchased_color, tags
  ) values (
    v_item.product_id, (select auth.uid()), v_item.id, v_item.product_variant_id, p_rating, trim(p_review_text), v_name,
    v_item.variant_name, v_item.size, v_item.color, v_tags
  ) returning * into v_review;
  return v_review;
exception when unique_violation then
  raise exception 'This purchased item already has a review';
end;
$$;

commit;
