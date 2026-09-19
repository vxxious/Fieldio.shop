begin;

alter type public.product_condition add value if not exists 'very_good' after 'excellent';

alter table public.products
  add column condition text check (condition is null or condition in ('new_with_tags', 'new_without_tags', 'excellent', 'very_good', 'good', 'fair')),
  add column seller_verified boolean not null default false,
  add column seller_store_name text,
  add column seller_store_slug text,
  add column seller_country_code char(2);

create index products_seller_store_idx on public.products(seller_store_slug, status) where seller_verified;

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

  return new;
end;
$$;

create trigger set_seller_product_trust_metadata
before insert or update of seller_listing_id on public.products
for each row execute function public.set_seller_product_trust_metadata();

revoke all on function public.set_seller_product_trust_metadata() from public;

update public.products product
set condition = listing.condition::text,
    seller_verified = true,
    seller_store_name = store.name,
    seller_store_slug = store.slug,
    seller_country_code = application.country_code
from public.seller_listings listing
join public.seller_stores store on store.id = listing.store_id and store.owner_id = listing.owner_id
join public.seller_applications application on application.owner_id = listing.owner_id and application.status = 'approved'
where product.seller_listing_id = listing.id;

create or replace function public.require_defect_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and old.status is distinct from 'pending' and new.condition in ('good', 'fair')
    and (select count(*) from public.seller_listing_images where listing_id = new.id) < 2
  then
    raise exception 'Good and Fair items require a close-up image showing wear or defects';
  end if;
  return new;
end;
$$;

create trigger require_seller_listing_defect_evidence
before update of status on public.seller_listings
for each row execute function public.require_defect_evidence();

revoke all on function public.require_defect_evidence() from public;

commit;
