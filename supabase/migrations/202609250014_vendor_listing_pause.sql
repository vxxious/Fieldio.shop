begin;

alter table public.seller_listings add column is_paused boolean not null default false;

create function public.set_vendor_listing_paused(p_listing_id uuid, p_paused boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare listing_row public.seller_listings; product_row public.products;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'SIGN_IN_REQUIRED'; end if;
  if p_paused is null then raise exception using errcode = '22023', message = 'PAUSE_STATE_REQUIRED'; end if;
  select * into listing_row from public.seller_listings
  where id = p_listing_id and owner_id = (select auth.uid()) and status = 'approved'
  for update;
  if not found then raise exception using errcode = '42501', message = 'LISTING_NOT_AVAILABLE'; end if;
  if not exists (select 1 from public.seller_applications where owner_id = listing_row.owner_id and status = 'approved')
    or not exists (select 1 from public.seller_stores where id = listing_row.store_id and owner_id = listing_row.owner_id and status = 'active')
  then raise exception using errcode = '42501', message = 'STORE_NOT_ACTIVE'; end if;
  select * into product_row from public.products
  where id = listing_row.published_product_id and seller_listing_id = listing_row.id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PUBLISHED_PRODUCT_NOT_FOUND'; end if;
  if listing_row.is_paused = p_paused then return p_paused; end if;
  if p_paused and product_row.status <> 'active' then
    raise exception using errcode = '23514', message = 'PRODUCT_NOT_ACTIVE';
  end if;
  if not p_paused and product_row.status <> 'draft' then
    raise exception using errcode = '23514', message = 'PRODUCT_STATUS_CHANGED';
  end if;
  update public.products set status = case when p_paused then 'draft'::public.product_status else 'active'::public.product_status end
  where id = product_row.id;
  update public.seller_listings set is_paused = p_paused where id = listing_row.id;
  return p_paused;
end;
$$;

revoke all on function public.set_vendor_listing_paused(uuid,boolean) from public, anon;
grant execute on function public.set_vendor_listing_paused(uuid,boolean) to authenticated;

commit;
