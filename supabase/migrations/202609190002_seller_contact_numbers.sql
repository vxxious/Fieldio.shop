begin;

alter table public.seller_applications
  add column phone_country_code char(2),
  add column whatsapp_country_code char(2),
  add column whatsapp_phone text;

update public.seller_applications
set phone_country_code = country_code,
    whatsapp_country_code = country_code,
    whatsapp_phone = phone;

alter table public.seller_applications
  alter column phone_country_code set not null,
  alter column whatsapp_country_code set not null,
  alter column whatsapp_phone set not null,
  add constraint seller_applications_phone_country_code_check check (phone_country_code ~ '^[A-Z]{2}$'),
  add constraint seller_applications_whatsapp_country_code_check check (whatsapp_country_code ~ '^[A-Z]{2}$'),
  add constraint seller_applications_phone_format_check check (phone ~ '^\+[1-9][0-9]{6,14}$') not valid,
  add constraint seller_applications_whatsapp_phone_check check (whatsapp_phone ~ '^\+[1-9][0-9]{6,14}$') not valid;

alter table public.seller_stores
  add column contact_phone_country_code char(2),
  add column contact_whatsapp_country_code char(2),
  add column contact_whatsapp_phone text;

update public.seller_stores store
set contact_phone_country_code = application.phone_country_code,
    contact_whatsapp_country_code = application.whatsapp_country_code,
    contact_whatsapp_phone = application.whatsapp_phone
from public.seller_applications application
where application.owner_id = store.owner_id;

alter table public.seller_stores
  alter column contact_phone_country_code set not null,
  alter column contact_whatsapp_country_code set not null,
  alter column contact_whatsapp_phone set not null,
  add constraint seller_stores_phone_country_code_check check (contact_phone_country_code ~ '^[A-Z]{2}$'),
  add constraint seller_stores_whatsapp_country_code_check check (contact_whatsapp_country_code ~ '^[A-Z]{2}$'),
  add constraint seller_stores_phone_format_check check (contact_phone ~ '^\+[1-9][0-9]{6,14}$') not valid,
  add constraint seller_stores_whatsapp_phone_check check (contact_whatsapp_phone ~ '^\+[1-9][0-9]{6,14}$') not valid;

grant insert (phone_country_code, whatsapp_country_code, whatsapp_phone) on public.seller_applications to authenticated;
grant update (phone_country_code, whatsapp_country_code, whatsapp_phone) on public.seller_applications to authenticated;
grant insert (contact_phone_country_code, contact_whatsapp_country_code, contact_whatsapp_phone) on public.seller_stores to authenticated;

create or replace function public.update_seller_contacts(
  p_contact_email text,
  p_phone_country_code text,
  p_phone text,
  p_whatsapp_country_code text,
  p_whatsapp_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application public.seller_applications;
  store public.seller_stores;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_phone_country_code !~ '^[A-Z]{2}$' or p_whatsapp_country_code !~ '^[A-Z]{2}$' then raise exception 'Choose valid country calling codes'; end if;
  if p_phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'Enter a valid phone number'; end if;
  if p_whatsapp_phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'Enter a valid WhatsApp number'; end if;
  if char_length(trim(p_contact_email)) > 254 or position('@' in trim(p_contact_email)) < 2 then raise exception 'Enter a valid contact email'; end if;

  select * into application from public.seller_applications
  where owner_id = (select auth.uid()) and status = 'approved' for update;
  if application.id is null then raise exception 'Approved seller access required'; end if;

  select * into store from public.seller_stores
  where owner_id = (select auth.uid()) and status = 'active' for update;
  if store.id is null then raise exception 'Active seller store required'; end if;

  update public.seller_applications
  set contact_email = lower(trim(p_contact_email)), phone_country_code = p_phone_country_code, phone = p_phone,
      whatsapp_country_code = p_whatsapp_country_code, whatsapp_phone = p_whatsapp_phone
  where id = application.id;

  update public.seller_stores
  set contact_email = lower(trim(p_contact_email)), contact_phone_country_code = p_phone_country_code, contact_phone = p_phone,
      contact_whatsapp_country_code = p_whatsapp_country_code, contact_whatsapp_phone = p_whatsapp_phone
  where id = store.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values ((select auth.uid()), 'seller.contacts_updated', 'seller_store', store.id);

  return jsonb_build_object('updated', true);
end;
$$;

revoke all on function public.update_seller_contacts(text, text, text, text, text) from public;
grant execute on function public.update_seller_contacts(text, text, text, text, text) to authenticated;

commit;
