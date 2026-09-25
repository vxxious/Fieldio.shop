begin;
revoke insert, update on public.products from authenticated;
grant insert, update on public.products to authenticated;
commit;
