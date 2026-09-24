begin;

drop function if exists public.update_vendor_fulfillment_status(uuid, public.fulfillment_status);

create function public.update_vendor_fulfillment_status(
  p_fulfillment_id uuid,
  p_status public.fulfillment_status,
  p_carrier text default null,
  p_tracking_reference text default null
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
  if p_status = 'shipped' and (
    nullif(btrim(p_carrier), '') is null or nullif(btrim(p_tracking_reference), '') is null
  ) then raise exception using errcode = '23514', message = 'SHIPPING_DETAILS_REQUIRED'; end if;

  update public.order_fulfillments
  set status = p_status,
      carrier = case when p_status = 'shipped' then btrim(p_carrier) else carrier end,
      tracking_reference = case when p_status = 'shipped' then btrim(p_tracking_reference) else tracking_reference end,
      shipped_at = case when p_status = 'shipped' and shipped_at is null then now() else shipped_at end
  where id = fulfillment.id
  returning * into fulfillment;
  return fulfillment;
end;
$$;

revoke all on function public.update_vendor_fulfillment_status(uuid, public.fulfillment_status, text, text) from public, anon;
grant execute on function public.update_vendor_fulfillment_status(uuid, public.fulfillment_status, text, text) to authenticated;

commit;
