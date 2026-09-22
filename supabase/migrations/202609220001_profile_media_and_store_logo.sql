begin;

alter table public.seller_stores
  add column logo_path text,
  add constraint seller_stores_logo_path_check
    check (logo_path is null or logo_path = owner_id::text || '/store-logo');

alter table public.products
  add column seller_store_logo_path text;

grant update (logo_path) on public.seller_stores to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "owners upload profile media" on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and name in ((select auth.uid())::text || '/avatar', (select auth.uid())::text || '/store-logo')
);
create policy "owners replace profile media" on storage.objects for update to authenticated
using (
  bucket_id = 'profile-media'
  and name in ((select auth.uid())::text || '/avatar', (select auth.uid())::text || '/store-logo')
)
with check (
  bucket_id = 'profile-media'
  and name in ((select auth.uid())::text || '/avatar', (select auth.uid())::text || '/store-logo')
);
create policy "owners remove profile media" on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-media'
  and name in ((select auth.uid())::text || '/avatar', (select auth.uid())::text || '/store-logo')
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')),
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), nullif(new.raw_user_meta_data ->> 'picture', ''))
  );
  insert into public.wishlists (user_id) values (new.id);
  return new;
end;
$$;

update public.profiles profile
set avatar_url = coalesce(nullif(account.raw_user_meta_data ->> 'avatar_url', ''), nullif(account.raw_user_meta_data ->> 'picture', ''))
from auth.users account
where account.id = profile.id
  and profile.avatar_url is null
  and coalesce(nullif(account.raw_user_meta_data ->> 'avatar_url', ''), nullif(account.raw_user_meta_data ->> 'picture', '')) is not null;

create or replace function public.set_seller_product_trust_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.seller_listing_id is null then return new; end if;

  select listing.condition::text, true, store.name, store.slug, application.country_code, store.logo_path
    into new.condition, new.seller_verified, new.seller_store_name, new.seller_store_slug, new.seller_country_code, new.seller_store_logo_path
  from public.seller_listings listing
  join public.seller_stores store on store.id = listing.store_id and store.owner_id = listing.owner_id
  join public.seller_applications application on application.owner_id = listing.owner_id and application.status = 'approved'
  where listing.id = new.seller_listing_id;

  new.inquiry_only := false;
  return new;
end;
$$;

create or replace function public.sync_seller_store_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products product
  set seller_store_name = new.name,
      seller_store_slug = new.slug,
      seller_store_logo_path = new.logo_path
  where product.seller_listing_id in (
    select listing.id from public.seller_listings listing where listing.store_id = new.id
  );
  return new;
end;
$$;

create trigger sync_seller_store_profile
after update of name, slug, logo_path on public.seller_stores
for each row execute function public.sync_seller_store_profile();

update public.products product
set seller_store_logo_path = store.logo_path
from public.seller_listings listing
join public.seller_stores store on store.id = listing.store_id
where product.seller_listing_id = listing.id;

revoke all on function public.sync_seller_store_profile() from public;

comment on column public.seller_stores.logo_path is 'Owner-managed public logo stored in the profile-media bucket.';
comment on column public.products.seller_store_logo_path is 'Public seller logo path copied from the approved listing store.';

commit;
