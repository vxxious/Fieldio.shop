begin;

alter table public.product_review_images
  add column status text not null default 'ready' check (status in ('pending', 'ready'));

alter table public.product_review_images
  drop constraint product_review_images_position_check,
  add constraint product_review_images_position_check check (position between 0 and 9);

create or replace function public.refresh_review_has_photos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_review_id uuid := coalesce(new.review_id, old.review_id);
begin
  update public.product_reviews review
  set has_photos = exists (
    select 1 from public.product_review_images image
    where image.review_id = v_review_id and image.status = 'ready'
  )
  where review.id = v_review_id;
  return coalesce(new, old);
end;
$$;

drop trigger refresh_review_has_photos_after_change on public.product_review_images;
create trigger refresh_review_has_photos_after_change
after insert or delete or update of status on public.product_review_images
for each row execute function public.refresh_review_has_photos();

drop policy "published review images are public" on public.product_review_images;
create policy "authorized users read ready review images" on public.product_review_images
for select using (
  status = 'ready'
  and exists (
    select 1
    from public.product_reviews review
    join public.products product on product.id = review.product_id
    where review.id = review_id
      and ((review.status = 'published' and product.status = 'active')
        or review.buyer_id = (select auth.uid())
        or public.has_admin_role(array['owner','admin']))
  )
);

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

  delete from public.product_review_images image
  where image.review_id = p_review_id
    and image.status = 'pending'
    and image.created_at < now() - interval '1 hour';

  if (select count(*) from public.product_review_images image where image.review_id = p_review_id and image.status = 'pending') >= 5 then
    raise exception 'Too many pending review photos';
  end if;

  select candidate::smallint into v_position
  from generate_series(5, 9) candidate
  where not exists (select 1 from public.product_review_images image where image.review_id = p_review_id and image.position = candidate)
  order by candidate limit 1;
  if v_position is null then raise exception 'A review can have up to 5 pending photos'; end if;

  insert into public.product_review_images(review_id, buyer_id, storage_path, position, status)
  values (p_review_id, (select auth.uid()), p_storage_path, v_position, 'pending')
  returning * into v_image;
  return v_image;
end;
$$;

create or replace function public.finalize_review_images(
  p_review_id uuid,
  p_remove_image_ids uuid[] default '{}',
  p_pending_image_ids uuid[] default '{}'
)
returns public.product_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.product_reviews;
  v_pending_count integer;
  v_remaining_count integer;
  v_image record;
  v_position smallint;
begin
  select * into v_review
  from public.product_reviews
  where id = p_review_id and buyer_id = (select auth.uid())
  for update;
  if v_review.id is null then raise exception 'Review not found'; end if;

  if exists (
    select 1 from unnest(coalesce(p_remove_image_ids, '{}')) requested(id)
    where not exists (
      select 1 from public.product_review_images image
      where image.id = requested.id and image.review_id = p_review_id
        and image.buyer_id = (select auth.uid()) and image.status = 'ready'
    )
  ) then raise exception 'Invalid review photo removal'; end if;

  select count(*) into v_pending_count
  from public.product_review_images image
  where image.id = any(coalesce(p_pending_image_ids, '{}'))
    and image.review_id = p_review_id
    and image.buyer_id = (select auth.uid())
    and image.status = 'pending';

  if v_pending_count <> cardinality(coalesce(p_pending_image_ids, '{}')) then
    raise exception 'Invalid pending review photos';
  end if;

  if exists (
    select 1
    from public.product_review_images image
    where image.id = any(coalesce(p_pending_image_ids, '{}'))
      and not exists (
        select 1 from storage.objects object
        where object.bucket_id = 'review-media' and object.name = image.storage_path
      )
  ) then raise exception 'A review photo did not finish uploading'; end if;

  select count(*) into v_remaining_count
  from public.product_review_images image
  where image.review_id = p_review_id
    and image.status = 'ready'
    and not (image.id = any(coalesce(p_remove_image_ids, '{}')));

  if v_remaining_count + v_pending_count > 5 then raise exception 'A review can have up to 5 photos'; end if;

  delete from public.product_review_images image
  where image.review_id = p_review_id
    and image.id = any(coalesce(p_remove_image_ids, '{}'));

  for v_image in
    select image.id
    from public.product_review_images image
    where image.id = any(coalesce(p_pending_image_ids, '{}'))
    order by image.created_at, image.id
  loop
    select candidate::smallint into v_position
    from generate_series(0, 4) candidate
    where not exists (
      select 1 from public.product_review_images image
      where image.review_id = p_review_id and image.status = 'ready' and image.position = candidate
    )
    order by candidate limit 1;

    update public.product_review_images
    set position = v_position, status = 'ready'
    where id = v_image.id;
  end loop;

  select * into v_review from public.product_reviews where id = p_review_id;
  return v_review;
end;
$$;

revoke all on function public.finalize_review_images(uuid, uuid[], uuid[]) from public;
grant execute on function public.finalize_review_images(uuid, uuid[], uuid[]) to authenticated;

update storage.buckets set public = false where id = 'review-media';

drop policy "public reads review media" on storage.objects;
create policy "authorized users read review media" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'review-media'
  and exists (
    select 1
    from public.product_review_images image
    join public.product_reviews review on review.id = image.review_id
    join public.products product on product.id = review.product_id
    where image.storage_path = name
      and image.status = 'ready'
      and ((review.status = 'published' and product.status = 'active')
        or review.buyer_id = (select auth.uid())
        or public.has_admin_role(array['owner','admin']))
  )
);

create policy "review owners delete own media" on storage.objects
for delete to authenticated using (
  bucket_id = 'review-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on column public.product_review_images.status is 'Pending photos stay private until the buyer atomically finalizes the review image set.';

commit;
