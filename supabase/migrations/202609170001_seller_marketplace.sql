begin;

create type public.seller_kind as enum ('seller', 'vendor');
create type public.seller_review_status as enum ('draft', 'pending', 'approved', 'rejected', 'suspended');
create type public.seller_listing_status as enum ('draft', 'pending', 'approved', 'rejected', 'archived', 'suspended');
create type public.product_condition as enum ('new_with_tags', 'new_without_tags', 'excellent', 'good', 'fair');

create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  kind public.seller_kind not null,
  legal_name text not null check (char_length(legal_name) between 2 and 120),
  business_name text,
  country_code char(2) not null,
  phone text not null,
  contact_email text not null,
  website text,
  identity_document_path text not null,
  address_document_path text not null,
  business_document_path text,
  declaration_accepted boolean not null default false check (declaration_accepted),
  status public.seller_review_status not null default 'draft',
  review_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seller_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 20 and 2000),
  contact_email text not null,
  contact_phone text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seller_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.seller_stores(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text not null check (char_length(description) between 20 and 5000),
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid references public.categories(id) on delete restrict,
  condition public.product_condition not null,
  price integer not null check (price > 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price > price),
  currency char(3) not null default 'GBP',
  colors text[] not null default '{}',
  sizes text[] not null default '{}',
  quantity integer not null check (quantity between 1 and 10000),
  weight_kg numeric(8,3) not null check (weight_kg > 0 and weight_kg <= 1000),
  status public.seller_listing_status not null default 'draft',
  review_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seller_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null,
  position integer not null default 0 check (position between 0 and 9),
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);

alter table public.products add column seller_listing_id uuid unique references public.seller_listings(id) on delete set null;

create index seller_applications_status_idx on public.seller_applications(status, submitted_at);
create index seller_listings_owner_idx on public.seller_listings(owner_id, created_at desc);
create index seller_listings_review_idx on public.seller_listings(status, submitted_at);
create index seller_listing_images_listing_idx on public.seller_listing_images(listing_id, position);

create trigger set_seller_applications_updated_at before update on public.seller_applications for each row execute procedure public.set_updated_at();
create trigger set_seller_stores_updated_at before update on public.seller_stores for each row execute procedure public.set_updated_at();
create trigger set_seller_listings_updated_at before update on public.seller_listings for each row execute procedure public.set_updated_at();

alter table public.seller_applications enable row level security;
alter table public.seller_stores enable row level security;
alter table public.seller_listings enable row level security;
alter table public.seller_listing_images enable row level security;

create policy "owners and management read seller applications" on public.seller_applications for select to authenticated
using (owner_id = (select auth.uid()) or public.has_admin_role(array['owner','admin']));
create policy "owners create seller applications" on public.seller_applications for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'draft');
create policy "owners edit open seller applications" on public.seller_applications for update to authenticated
using (owner_id = (select auth.uid()) and status in ('draft','rejected'))
with check (owner_id = (select auth.uid()) and status in ('draft','rejected'));

create policy "owners and management read seller stores" on public.seller_stores for select to authenticated
using (owner_id = (select auth.uid()) or public.has_admin_role(array['owner','admin']));
create policy "verified owners create seller stores" on public.seller_stores for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.seller_applications where owner_id = (select auth.uid()) and status = 'approved'
));
create policy "owners edit active seller stores" on public.seller_stores for update to authenticated
using (owner_id = (select auth.uid()) and status = 'active')
with check (owner_id = (select auth.uid()) and status = 'active');

create policy "owners and management read seller listings" on public.seller_listings for select to authenticated
using (owner_id = (select auth.uid()) or public.has_admin_role(array['owner','admin']));
create policy "verified owners create seller listings" on public.seller_listings for insert to authenticated
with check (
  owner_id = (select auth.uid()) and status = 'draft'
  and exists (select 1 from public.seller_stores where id = store_id and owner_id = (select auth.uid()) and status = 'active')
  and exists (select 1 from public.seller_applications where owner_id = (select auth.uid()) and status = 'approved')
);
create policy "owners edit open seller listings" on public.seller_listings for update to authenticated
using (owner_id = (select auth.uid()) and status in ('draft','rejected'))
with check (owner_id = (select auth.uid()) and status in ('draft','rejected'));
create policy "owners remove draft seller listings" on public.seller_listings for delete to authenticated
using (owner_id = (select auth.uid()) and status = 'draft');

create policy "owners and management read seller listing images" on public.seller_listing_images for select to authenticated
using (owner_id = (select auth.uid()) or public.has_admin_role(array['owner','admin']));
create policy "owners add seller listing images" on public.seller_listing_images for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.seller_listings where id = listing_id and owner_id = (select auth.uid()) and status in ('draft','rejected')
));
create policy "owners remove seller listing images" on public.seller_listing_images for delete to authenticated
using (owner_id = (select auth.uid()) and exists (
  select 1 from public.seller_listings where id = listing_id and owner_id = (select auth.uid()) and status in ('draft','rejected')
));

revoke all on public.seller_applications, public.seller_stores, public.seller_listings, public.seller_listing_images from anon, authenticated;
grant select on public.seller_applications, public.seller_stores, public.seller_listings, public.seller_listing_images to authenticated;
grant insert (owner_id, kind, legal_name, business_name, country_code, phone, contact_email, website, identity_document_path, address_document_path, business_document_path, declaration_accepted) on public.seller_applications to authenticated;
grant update (kind, legal_name, business_name, country_code, phone, contact_email, website, identity_document_path, address_document_path, business_document_path, declaration_accepted) on public.seller_applications to authenticated;
grant insert (owner_id, name, slug, description, contact_email, contact_phone) on public.seller_stores to authenticated;
grant update (name, slug, description, contact_email, contact_phone) on public.seller_stores to authenticated;
grant insert (id, owner_id, store_id, title, description, category_id, subcategory_id, condition, price, compare_at_price, currency, colors, sizes, quantity, weight_kg) on public.seller_listings to authenticated;
grant update (title, description, category_id, subcategory_id, condition, price, compare_at_price, currency, colors, sizes, quantity, weight_kg) on public.seller_listings to authenticated;
grant delete on public.seller_listings to authenticated;
grant insert (listing_id, owner_id, storage_path, alt_text, position) on public.seller_listing_images to authenticated;
grant delete on public.seller_listing_images to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('seller-verification', 'seller-verification', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('seller-listing-media', 'seller-listing-media', false, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "owners upload seller verification files" on storage.objects for insert to authenticated
with check (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners read seller verification files" on storage.objects for select to authenticated
using (bucket_id = 'seller-verification' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.has_admin_role(array['owner','admin'])));
create policy "owners replace seller verification files" on storage.objects for update to authenticated
using (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners remove seller verification files" on storage.objects for delete to authenticated
using (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owners upload seller listing media" on storage.objects for insert to authenticated
with check (bucket_id = 'seller-listing-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners and management read seller listing media" on storage.objects for select to authenticated
using (bucket_id = 'seller-listing-media' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.has_admin_role(array['owner','admin'])));
create policy "owners remove seller listing media" on storage.objects for delete to authenticated
using (bucket_id = 'seller-listing-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.submit_seller_application()
returns public.seller_applications
language plpgsql
security definer
set search_path = ''
as $$
declare application public.seller_applications;
begin
  select * into application from public.seller_applications where owner_id = (select auth.uid()) for update;
  if application.id is null or application.status not in ('draft','rejected') then raise exception 'Application cannot be submitted'; end if;
  if not application.declaration_accepted then raise exception 'Verification declaration is required'; end if;
  update public.seller_applications set status = 'pending', review_reason = null, submitted_at = now(), reviewed_at = null, reviewed_by = null
  where id = application.id returning * into application;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.application_submitted', 'seller_application', application.id);
  return application;
end;
$$;

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

create or replace function public.submit_seller_listing(p_listing_id uuid)
returns public.seller_listings
language plpgsql
security definer
set search_path = ''
as $$
declare listing public.seller_listings;
begin
  select * into listing from public.seller_listings where id = p_listing_id and owner_id = (select auth.uid()) for update;
  if listing.id is null or listing.status not in ('draft','rejected') then raise exception 'Listing cannot be submitted'; end if;
  if not exists (select 1 from public.seller_listing_images where listing_id = listing.id) then raise exception 'Add at least one product image'; end if;
  update public.seller_listings set status = 'pending', review_reason = null, submitted_at = now(), reviewed_at = null, reviewed_by = null
  where id = listing.id returning * into listing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.listing_submitted', 'seller_listing', listing.id);
  return listing;
end;
$$;

create or replace function public.review_seller_listing(p_listing_id uuid, p_decision text, p_reason text default null, p_public_images jsonb default '[]'::jsonb)
returns public.seller_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.seller_listings;
  store public.seller_stores;
  brand_id uuid;
  product_id uuid;
  product_slug text;
  image jsonb;
  size_value text;
  variant_id uuid;
  variant_index integer := 0;
begin
  if not public.has_admin_role(array['owner','admin']) then raise exception 'Not authorised'; end if;
  if p_decision not in ('approved','rejected','suspended') then raise exception 'Invalid decision'; end if;
  if p_decision in ('rejected','suspended') and nullif(trim(p_reason), '') is null then raise exception 'A reason is required'; end if;
  select * into listing from public.seller_listings where id = p_listing_id and status = 'pending' for update;
  if listing.id is null then raise exception 'Listing is not pending review'; end if;

  if p_decision = 'approved' then
    if jsonb_typeof(p_public_images) <> 'array' or jsonb_array_length(p_public_images) = 0 then raise exception 'Published images are required'; end if;
    select * into store from public.seller_stores where id = listing.store_id and status = 'active';
    if store.id is null then raise exception 'Seller store is not active'; end if;
    select id into brand_id from public.brands where lower(name) = lower(store.name) limit 1;
    if brand_id is null then
      insert into public.brands(name, slug, description, is_active) values (store.name, store.slug, store.description, true) returning id into brand_id;
    end if;
    product_slug := regexp_replace(lower(listing.title), '[^a-z0-9]+', '-', 'g');
    product_slug := trim(both '-' from product_slug) || '-' || left(replace(listing.id::text, '-', ''), 8);
    insert into public.products(sku, name, slug, brand_id, category_id, description, short_description, price, compare_at_price, currency, is_sale, inquiry_only, tags, status, published_at, seller_listing_id)
    values ('SELL-' || upper(left(replace(listing.id::text, '-', ''), 12)), listing.title, product_slug, brand_id, coalesce(listing.subcategory_id, listing.category_id), listing.description, left(listing.description, 240), listing.price, listing.compare_at_price, listing.currency, listing.compare_at_price is not null, true, array[listing.condition::text, 'verified-seller'], 'active', now(), listing.id)
    returning id into product_id;
    for image in select value from jsonb_array_elements(p_public_images) loop
      insert into public.product_images(product_id, storage_path, public_url, alt_text, position)
      values (product_id, image->>'storage_path', image->>'public_url', coalesce(nullif(image->>'alt_text',''), listing.title), coalesce((image->>'position')::integer, 0));
    end loop;
    if coalesce(array_length(listing.sizes, 1), 0) = 0 then
      listing.sizes := array['Available'];
    end if;
    foreach size_value in array listing.sizes loop
      variant_index := variant_index + 1;
      insert into public.product_variants(product_id, sku, name, size, color, attributes, is_active)
      values (product_id, 'SELL-' || upper(left(replace(listing.id::text, '-', ''), 10)) || '-' || variant_index, coalesce(nullif(size_value, ''), 'Available'), nullif(size_value, 'Available'), nullif(array_to_string(listing.colors, ' / '), ''), jsonb_build_object('seller_quantity', listing.quantity, 'weight_kg', listing.weight_kg), true)
      returning id into variant_id;
      insert into public.inventory(variant_id, quantity, allow_backorder) values (variant_id, 0, true);
    end loop;
  end if;

  update public.seller_listings set status = p_decision::public.seller_listing_status, review_reason = nullif(trim(p_reason), ''), reviewed_at = now(), reviewed_by = (select auth.uid()), published_product_id = coalesce(product_id, published_product_id)
  where id = listing.id returning * into listing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values ((select auth.uid()), 'seller.listing_' || p_decision, 'seller_listing', listing.id);
  return listing;
end;
$$;

revoke all on function public.submit_seller_application() from public;
revoke all on function public.review_seller_application(uuid, text, text) from public;
revoke all on function public.submit_seller_listing(uuid) from public;
revoke all on function public.review_seller_listing(uuid, text, text, jsonb) from public;
grant execute on function public.submit_seller_application() to authenticated;
grant execute on function public.review_seller_application(uuid, text, text) to authenticated;
grant execute on function public.submit_seller_listing(uuid) to authenticated;
grant execute on function public.review_seller_listing(uuid, text, text, jsonb) to authenticated;

commit;
