begin;

drop trigger if exists sync_seller_store_profile on public.seller_stores;
drop function if exists public.sync_seller_store_profile();

create or replace function public.set_seller_product_trust_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.seller_listing_id is null then return new; end if;

  select listing.condition::text, true, store.name, store.slug, application.country_code
    into new.condition, new.seller_verified, new.seller_store_name, new.seller_store_slug, new.seller_country_code
  from public.seller_listings listing
  join public.seller_stores store on store.id = listing.store_id and store.owner_id = listing.owner_id
  join public.seller_applications application on application.owner_id = listing.owner_id and application.status = 'approved'
  where listing.id = new.seller_listing_id;

  new.inquiry_only := false;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  insert into public.wishlists (user_id) values (new.id);
  return new;
end;
$$;

alter table public.products drop column if exists seller_store_logo_path;
alter table public.seller_stores drop column if exists logo_path;

drop policy if exists "owners upload profile media" on storage.objects;
drop policy if exists "owners replace profile media" on storage.objects;
drop policy if exists "owners remove profile media" on storage.objects;
delete from storage.objects where bucket_id = 'profile-media';
delete from storage.buckets where id = 'profile-media';

commit;
