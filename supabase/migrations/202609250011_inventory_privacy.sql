begin;

-- Public shopping needs availability, not operational inventory columns.
create function public.shop_variant_availability(p_variant_ids uuid[])
returns table(variant_id uuid, available_quantity integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_variant_ids is null or cardinality(p_variant_ids) > 200 then
    raise exception using errcode = '22023', message = 'INVALID_VARIANT_IDS';
  end if;

  return query
  select inventory.variant_id,
    case when inventory.allow_backorder then null::integer
      else greatest(0, inventory.quantity - inventory.reserved_quantity) end
  from public.inventory inventory
  join public.product_variants variant on variant.id = inventory.variant_id and variant.is_active
  join public.products product on product.id = variant.product_id
  where inventory.variant_id = any(p_variant_ids)
    and product.status = 'active'
    and product.published_at <= now();
end;
$$;

revoke all on function public.shop_variant_availability(uuid[]) from public, anon, authenticated;
grant execute on function public.shop_variant_availability(uuid[]) to anon, authenticated;

create policy "verified sellers read own inventory" on public.inventory
for select to authenticated
using (exists (
  select 1
  from public.seller_listing_variants matrix
  join public.seller_listings listing on listing.id = matrix.listing_id and listing.owner_id = matrix.owner_id
  join public.seller_stores store on store.id = listing.store_id and store.owner_id = listing.owner_id and store.status = 'active'
  join public.seller_applications application on application.owner_id = listing.owner_id and application.status = 'approved'
  where matrix.published_variant_id = variant_id
    and matrix.owner_id = (select auth.uid())
));

comment on function public.shop_variant_availability(uuid[]) is
  'Public, active-variant purchasable availability only; never returns inventory reservations or stock-management fields.';

commit;
