begin;

create or replace function public.has_admin_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt()->>'aal') = 'aal2'
    and public.current_admin_role() = any(p_roles),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.jwt()->>'aal') = 'aal2' and public.current_admin_role() is not null;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.jwt()->>'aal') = 'aal2' and public.current_admin_role() = 'owner';
$$;

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

update public.products
set inquiry_only = false
where seller_listing_id is not null;

update public.inventory inventory
set quantity = listing.quantity,
    reserved_quantity = least(inventory.reserved_quantity, listing.quantity),
    allow_backorder = false
from public.product_variants variant
join public.products product on product.id = variant.product_id
join public.seller_listings listing on listing.id = product.seller_listing_id
where inventory.variant_id = variant.id;

comment on function public.has_admin_role(text[]) is 'Requires both an assigned staff role and an AAL2 session.';
comment on function public.is_admin() is 'Returns true only for staff using an AAL2 session.';
comment on function public.is_owner() is 'Returns true only for an owner using an AAL2 session.';

commit;
