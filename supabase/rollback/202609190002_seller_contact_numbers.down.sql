begin;

drop function if exists public.update_seller_contacts(text, text, text, text, text);

alter table public.seller_stores
  drop constraint if exists seller_stores_phone_format_check,
  drop column if exists contact_whatsapp_phone,
  drop column if exists contact_whatsapp_country_code,
  drop column if exists contact_phone_country_code;

alter table public.seller_applications
  drop constraint if exists seller_applications_phone_format_check,
  drop column if exists whatsapp_phone,
  drop column if exists whatsapp_country_code,
  drop column if exists phone_country_code;

commit;
