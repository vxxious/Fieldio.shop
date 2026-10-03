begin;

-- Applied after the shopping client has moved to shop_variant_availability.
drop policy "public read active product inventory" on public.inventory;
revoke select on public.inventory from public, anon, authenticated;
grant select on public.inventory to authenticated, service_role;

commit;
