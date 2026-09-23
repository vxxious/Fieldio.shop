begin;

alter table public.products
  add column average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  add column rating_count integer not null default 0 check (rating_count >= 0);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (char_length(trim(review_text)) between 20 and 3000),
  reviewer_name text not null check (char_length(reviewer_name) between 1 and 120),
  purchased_variant text,
  purchased_size text,
  purchased_color text,
  tags text[] not null default '{}',
  verified_purchase boolean not null default true check (verified_purchase),
  has_photos boolean not null default false,
  helpful_count integer not null default 0 check (helpful_count >= 0),
  status text not null default 'published' check (status in ('published', 'hidden')),
  moderation_reason text,
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, order_item_id)
);

create index product_reviews_product_feed_idx on public.product_reviews(product_id, status, created_at desc);
create index product_reviews_product_rating_idx on public.product_reviews(product_id, status, rating);
create index product_reviews_product_helpful_idx on public.product_reviews(product_id, status, helpful_count desc, created_at desc);
create index product_reviews_buyer_idx on public.product_reviews(buyer_id, created_at desc);
create index product_reviews_tags_idx on public.product_reviews using gin(tags);

create table public.product_review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  position smallint not null check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique (review_id, position)
);

create index product_review_images_review_idx on public.product_review_images(review_id, position);

create table public.product_review_helpful (
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table public.product_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'privacy', 'not_about_product', 'other')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);

create index product_review_reports_queue_idx on public.product_review_reports(status, created_at desc);

create trigger set_product_reviews_updated_at
before update on public.product_reviews
for each row execute procedure public.set_updated_at();

create or replace function public.refresh_product_rating(p_product_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products product
  set average_rating = aggregate.average_rating,
      rating_count = aggregate.rating_count
  from (
    select coalesce(round(avg(review.rating)::numeric, 2), 0) as average_rating,
           count(*)::integer as rating_count
    from public.product_reviews review
    where review.product_id = p_product_id and review.status = 'published'
  ) aggregate
  where product.id = p_product_id;
$$;

create or replace function public.refresh_product_rating_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.product_id <> new.product_id) then
    perform public.refresh_product_rating(old.product_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.refresh_product_rating(new.product_id);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger refresh_product_rating_after_insert
after insert on public.product_reviews
for each row execute function public.refresh_product_rating_trigger();
create trigger refresh_product_rating_after_update
after update of product_id, rating, status on public.product_reviews
for each row execute function public.refresh_product_rating_trigger();
create trigger refresh_product_rating_after_delete
after delete on public.product_reviews
for each row execute function public.refresh_product_rating_trigger();

create or replace function public.refresh_review_helpful_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_review_id uuid := coalesce(new.review_id, old.review_id);
begin
  update public.product_reviews review
  set helpful_count = (select count(*) from public.product_review_helpful vote where vote.review_id = v_review_id)
  where review.id = v_review_id;
  return coalesce(new, old);
end;
$$;

create trigger refresh_review_helpful_count_after_change
after insert or delete on public.product_review_helpful
for each row execute function public.refresh_review_helpful_count();

create or replace function public.refresh_review_has_photos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_review_id uuid := coalesce(new.review_id, old.review_id);
begin
  update public.product_reviews review
  set has_photos = exists (select 1 from public.product_review_images image where image.review_id = v_review_id)
  where review.id = v_review_id;
  return coalesce(new, old);
end;
$$;

create trigger refresh_review_has_photos_after_change
after insert or delete on public.product_review_images
for each row execute function public.refresh_review_has_photos();

alter table public.product_reviews enable row level security;
alter table public.product_review_images enable row level security;
alter table public.product_review_helpful enable row level security;
alter table public.product_review_reports enable row level security;

create policy "published reviews are public" on public.product_reviews
for select using (
  (status = 'published' and exists (
    select 1 from public.products product where product.id = product_id and product.status = 'active'
  ))
  or buyer_id = (select auth.uid())
  or public.has_admin_role(array['owner','admin'])
);

create policy "published review images are public" on public.product_review_images
for select using (
  exists (
    select 1
    from public.product_reviews review
    join public.products product on product.id = review.product_id
    where review.id = review_id
      and ((review.status = 'published' and product.status = 'active')
        or review.buyer_id = (select auth.uid())
        or public.has_admin_role(array['owner','admin']))
  )
);

create policy "buyers read own helpful votes" on public.product_review_helpful
for select to authenticated using (user_id = (select auth.uid()));

create policy "management reads review reports" on public.product_review_reports
for select to authenticated using (public.has_admin_role(array['owner','admin']));

revoke all on public.product_reviews, public.product_review_images, public.product_review_helpful, public.product_review_reports from anon, authenticated;
grant select on public.product_reviews, public.product_review_images to anon, authenticated;
grant select on public.product_review_helpful to authenticated;
grant select on public.product_review_reports to authenticated;

create or replace function public.product_review_summary(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with reviews as (
    select rating, has_photos, verified_purchase, tags
    from public.product_reviews
    where product_id = p_product_id and status = 'published'
  ), counts as (
    select coalesce(round(avg(rating)::numeric, 2), 0) as average_rating,
           count(*)::integer as total,
           count(*) filter (where rating = 5)::integer as five_star,
           count(*) filter (where rating = 4)::integer as four_star,
           count(*) filter (where rating = 3)::integer as three_star,
           count(*) filter (where rating = 2)::integer as two_star,
           count(*) filter (where rating = 1)::integer as one_star,
           count(*) filter (where has_photos)::integer as with_photos,
           count(*) filter (where verified_purchase)::integer as verified
    from reviews
  ), tag_counts as (
    select tag, count(*)::integer as count
    from reviews, unnest(tags) tag
    group by tag
    having count(*) >= 3 and (select total from counts) >= 5
    order by count(*) desc, tag
    limit 6
  )
  select jsonb_build_object(
    'averageRating', counts.average_rating,
    'total', counts.total,
    'breakdown', jsonb_build_object('5', counts.five_star, '4', counts.four_star, '3', counts.three_star, '2', counts.two_star, '1', counts.one_star),
    'withPhotos', counts.with_photos,
    'verified', counts.verified,
    'tags', coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'count', count)) from tag_counts), '[]'::jsonb)
  )
  from counts;
$$;

create or replace function public.seller_review_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with reviews as (
    select review.rating
    from public.product_reviews review
    join public.products product on product.id = review.product_id
    join public.seller_listings listing on listing.id = product.seller_listing_id
    where listing.owner_id = (select auth.uid()) and review.status = 'published'
  )
  select jsonb_build_object(
    'averageRating', coalesce(round(avg(rating)::numeric, 2), 0),
    'total', count(*)::integer,
    'breakdown', jsonb_build_object(
      '5', count(*) filter (where rating = 5), '4', count(*) filter (where rating = 4),
      '3', count(*) filter (where rating = 3), '2', count(*) filter (where rating = 2),
      '1', count(*) filter (where rating = 1)
    )
  ) from reviews;
$$;

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
  left join public.product_reviews review on review.order_item_id = item.id and review.buyer_id = (select auth.uid())
  where request.user_id = (select auth.uid())
    and request.status = 'delivered'
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
  if v_request.user_id <> (select auth.uid()) or v_request.status <> 'delivered' then raise exception 'Only a verified buyer can review this item'; end if;
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

create or replace function public.update_product_review(
  p_review_id uuid,
  p_rating integer,
  p_review_text text,
  p_tags text[] default '{}'
)
returns public.product_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare v_review public.product_reviews; v_tags text[];
begin
  if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if char_length(trim(coalesce(p_review_text, ''))) not between 20 and 3000 then raise exception 'Review must be between 20 and 3000 characters'; end if;
  select coalesce(array_agg(distinct tag order by tag), '{}') into v_tags from unnest(coalesce(p_tags, '{}')) tag;
  if cardinality(v_tags) > 3 or not v_tags <@ array['perfect_fit','good_quality','comfortable','true_to_description','beautiful_design','fast_delivery']::text[] then raise exception 'Invalid review tags'; end if;
  update public.product_reviews
  set rating = p_rating, review_text = trim(p_review_text), tags = v_tags
  where id = p_review_id and buyer_id = (select auth.uid())
  returning * into v_review;
  if v_review.id is null then raise exception 'Review not found'; end if;
  return v_review;
end;
$$;

create or replace function public.reserve_review_image(p_review_id uuid, p_storage_path text)
returns public.product_review_images
language plpgsql
security definer
set search_path = ''
as $$
declare v_review public.product_reviews; v_image public.product_review_images; v_position smallint;
begin
  select * into v_review from public.product_reviews where id = p_review_id and buyer_id = (select auth.uid()) for update;
  if v_review.id is null then raise exception 'Review not found'; end if;
  if p_storage_path !~ ('^' || (select auth.uid())::text || '/' || p_review_id::text || '/[0-9a-f-]{36}\.webp$') then raise exception 'Invalid review image path'; end if;
  select candidate::smallint into v_position
  from generate_series(0, 4) candidate
  where not exists (select 1 from public.product_review_images image where image.review_id = p_review_id and image.position = candidate)
  order by candidate limit 1;
  if v_position is null then raise exception 'A review can have up to 5 photos'; end if;
  insert into public.product_review_images(review_id, buyer_id, storage_path, position)
  values (p_review_id, (select auth.uid()), p_storage_path, v_position)
  returning * into v_image;
  return v_image;
end;
$$;

create or replace function public.toggle_review_helpful(p_review_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_buyer_id uuid; v_deleted integer;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to vote'; end if;
  select buyer_id into v_buyer_id from public.product_reviews where id = p_review_id and status = 'published';
  if v_buyer_id is null then raise exception 'Review not found'; end if;
  if v_buyer_id = (select auth.uid()) then raise exception 'You cannot vote on your own review'; end if;
  delete from public.product_review_helpful where review_id = p_review_id and user_id = (select auth.uid());
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then return false; end if;
  insert into public.product_review_helpful(review_id, user_id) values (p_review_id, (select auth.uid()));
  return true;
end;
$$;

create or replace function public.report_product_review(p_review_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_buyer_id uuid;
begin
  if p_reason not in ('spam','abuse','privacy','not_about_product','other') then raise exception 'Invalid report reason'; end if;
  select buyer_id into v_buyer_id from public.product_reviews where id = p_review_id and status = 'published';
  if v_buyer_id is null then raise exception 'Review not found'; end if;
  if v_buyer_id = (select auth.uid()) then raise exception 'You cannot report your own review'; end if;
  insert into public.product_review_reports(review_id, reporter_id, reason)
  values (p_review_id, (select auth.uid()), p_reason)
  on conflict (review_id, reporter_id) do update set reason = excluded.reason, status = 'open', resolved_by = null, resolved_at = null;
end;
$$;

create or replace function public.moderate_product_review(p_review_id uuid, p_decision text, p_reason text default null)
returns public.product_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare v_review public.product_reviews;
begin
  if not public.has_admin_role(array['owner','admin']) then raise exception 'Forbidden'; end if;
  if p_decision not in ('hide','restore') then raise exception 'Invalid moderation decision'; end if;
  if p_decision = 'hide' and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  update public.product_reviews set
    status = case when p_decision = 'hide' then 'hidden' else 'published' end,
    moderation_reason = case when p_decision = 'hide' then trim(p_reason) else null end,
    moderated_by = (select auth.uid()), moderated_at = now()
  where id = p_review_id returning * into v_review;
  if v_review.id is null then raise exception 'Review not found'; end if;
  update public.product_review_reports set status = case when p_decision = 'hide' then 'resolved' else 'dismissed' end,
    resolved_by = (select auth.uid()), resolved_at = now()
  where review_id = p_review_id and status = 'open';
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'review.' || p_decision, 'product_review', p_review_id::text, jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
  return v_review;
end;
$$;

revoke all on function public.refresh_product_rating(uuid), public.product_review_summary(uuid), public.seller_review_summary(), public.review_eligibility(uuid), public.create_product_review(uuid, integer, text, text[]), public.update_product_review(uuid, integer, text, text[]), public.reserve_review_image(uuid, text), public.toggle_review_helpful(uuid), public.report_product_review(uuid, text), public.moderate_product_review(uuid, text, text) from public;
grant execute on function public.product_review_summary(uuid) to anon, authenticated;
grant execute on function public.seller_review_summary(), public.review_eligibility(uuid), public.create_product_review(uuid, integer, text, text[]), public.update_product_review(uuid, integer, text, text[]), public.reserve_review_image(uuid, text), public.toggle_review_helpful(uuid), public.report_product_review(uuid, text), public.moderate_product_review(uuid, text, text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('review-media', 'review-media', true, 5242880, array['image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads review media" on storage.objects
for select using (bucket_id = 'review-media');

create policy "review owners upload reserved media" on storage.objects
for insert to authenticated with check (
  bucket_id = 'review-media'
  and exists (
    select 1 from public.product_review_images image
    join public.product_reviews review on review.id = image.review_id
    where image.storage_path = name and image.buyer_id = (select auth.uid()) and review.buyer_id = (select auth.uid())
  )
);

comment on table public.product_reviews is 'Verified-purchase product reviews. All writes use guarded RPCs.';
comment on table public.product_review_images is 'Reserved review image objects; Storage policies require a matching owner row.';

commit;
