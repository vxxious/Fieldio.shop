begin;

drop policy "owners upload seller verification files" on storage.objects;
drop policy "owners replace seller verification files" on storage.objects;
drop policy "owners remove seller verification files" on storage.objects;

create policy "owners upload seller verification files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'seller-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    not exists (select 1 from public.seller_applications where owner_id = (select auth.uid()))
    or exists (select 1 from public.seller_applications where owner_id = (select auth.uid()) and status in ('draft','rejected'))
  )
);
create policy "owners replace seller verification files" on storage.objects for update to authenticated
using (
  bucket_id = 'seller-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.seller_applications where owner_id = (select auth.uid()) and status in ('draft','rejected'))
)
with check (
  bucket_id = 'seller-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.seller_applications where owner_id = (select auth.uid()) and status in ('draft','rejected'))
);
create policy "owners remove seller verification files" on storage.objects for delete to authenticated
using (
  bucket_id = 'seller-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.seller_applications where owner_id = (select auth.uid()) and status in ('draft','rejected'))
);

create or replace function public.review_seller_application(p_application_id uuid, p_decision text, p_reason text default null)
returns public.seller_applications
language plpgsql
security definer
set search_path = ''
as $$
declare application public.seller_applications;
begin
  if not public.has_admin_role(array['owner','admin']) then raise exception 'Not authorised'; end if;
  if p_decision not in ('approved','rejected','suspended') then raise exception 'Invalid decision'; end if;
  if p_decision in ('rejected','suspended') and nullif(trim(p_reason), '') is null then raise exception 'A reason is required'; end if;
  update public.seller_applications set status = p_decision::public.seller_review_status, review_reason = nullif(trim(p_reason), ''), reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = p_application_id and status in ('pending','approved') returning * into application;
  if application.id is null then raise exception 'Application is not reviewable'; end if;

  if p_decision = 'suspended' then
    update public.seller_stores set status = 'suspended' where owner_id = application.owner_id;
    update public.seller_listings set status = 'suspended', review_reason = p_reason, reviewed_at = now(), reviewed_by = (select auth.uid())
    where owner_id = application.owner_id and status <> 'archived';
    update public.products set status = 'archived'
    where seller_listing_id in (select id from public.seller_listings where owner_id = application.owner_id);
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.application_' || p_decision, 'seller_application', application.id);
  return application;
end;
$$;

commit;
