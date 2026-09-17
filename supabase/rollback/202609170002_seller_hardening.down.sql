begin;

drop policy "owners upload seller verification files" on storage.objects;
drop policy "owners replace seller verification files" on storage.objects;
drop policy "owners remove seller verification files" on storage.objects;
create policy "owners upload seller verification files" on storage.objects for insert to authenticated
with check (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners replace seller verification files" on storage.objects for update to authenticated
using (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners remove seller verification files" on storage.objects for delete to authenticated
using (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);

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
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.application_' || p_decision, 'seller_application', application.id);
  return application;
end;
$$;

commit;
