begin;

create or replace function public.suspend_seller_listing(p_listing_id uuid, p_reason text)
returns public.seller_listings
language plpgsql
security definer
set search_path = ''
as $$
declare listing public.seller_listings;
begin
  if not public.has_admin_role(array['owner','admin']) then raise exception 'Not authorised'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A reason is required'; end if;

  select * into listing from public.seller_listings where id = p_listing_id and status = 'approved' for update;
  if listing.id is null then raise exception 'Listing is not approved'; end if;

  update public.seller_listings
  set status = 'suspended', review_reason = trim(p_reason), reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = listing.id
  returning * into listing;

  update public.products set status = 'archived' where seller_listing_id = listing.id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'seller.listing_suspended', 'seller_listing', listing.id, jsonb_build_object('reason', trim(p_reason)));
  return listing;
end;
$$;

revoke all on function public.suspend_seller_listing(uuid, text) from public, anon;
grant execute on function public.suspend_seller_listing(uuid, text) to authenticated;

commit;
