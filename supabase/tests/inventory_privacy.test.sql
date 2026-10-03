create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
begin;
select no_plan();

create function pg_temp.inventory_test_user(p_user_id uuid)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  return set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, false);
end $$;

insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'inventory-buyer@fieldio.test', '', now(), '{}', '{}', now(), now(), false, false),
  ('92000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'inventory-vendor-a@fieldio.test', '', now(), '{}', '{}', now(), now(), false, false),
  ('92000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'inventory-vendor-b@fieldio.test', '', now(), '{}', '{}', now(), now(), false, false),
  ('93000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'inventory-admin@fieldio.test', '', now(), '{}', '{}', now(), now(), false, false);

insert into public.admin_users(user_id, role, email)
values ('93000000-0000-0000-0000-000000000001', 'admin', 'inventory-admin@fieldio.test');

insert into public.seller_applications(owner_id, kind, legal_name, business_name, country_code, phone, contact_email, identity_document_path, address_document_path, declaration_accepted, status, phone_country_code, whatsapp_country_code, whatsapp_phone)
values
  ('92000000-0000-0000-0000-000000000001', 'vendor', 'Inventory Vendor A', 'Inventory Store A', 'GB', '+447700900011', 'inventory-vendor-a@fieldio.test', 'test/id-a', 'test/address-a', true, 'approved', 'GB', 'GB', '+447700900011'),
  ('92000000-0000-0000-0000-000000000002', 'vendor', 'Inventory Vendor B', 'Inventory Store B', 'GB', '+447700900012', 'inventory-vendor-b@fieldio.test', 'test/id-b', 'test/address-b', true, 'approved', 'GB', 'GB', '+447700900012');

insert into public.seller_stores(id, owner_id, name, slug, description, contact_email, contact_phone, contact_phone_country_code, contact_whatsapp_country_code, contact_whatsapp_phone)
values
  ('94000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'Inventory Store A', 'inventory-store-a', 'Inventory privacy test store A.', 'inventory-vendor-a@fieldio.test', '+447700900011', 'GB', 'GB', '+447700900011'),
  ('94000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 'Inventory Store B', 'inventory-store-b', 'Inventory privacy test store B.', 'inventory-vendor-b@fieldio.test', '+447700900012', 'GB', 'GB', '+447700900012');

do $$
declare category_id uuid;
begin
  select id into category_id from public.categories order by created_at, id limit 1;
  insert into public.seller_listings(id, owner_id, store_id, title, description, category_id, condition, price, currency, colors, sizes, quantity, weight_kg, status, audience, authenticity_confirmed)
  values
    ('95000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'Inventory A', 'Private stock test product A.', category_id, 'new_with_tags', 10000, 'GBP', array['Black'], array['M'], 9, 1, 'approved', 'unisex', true),
    ('95000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000002', 'Inventory B', 'Private stock test product B.', category_id, 'new_with_tags', 20000, 'GBP', array['White'], array['L'], 5, 1, 'approved', 'unisex', true),
    ('95000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'Private inventory A', 'Unpublished inventory test product.', category_id, 'new_with_tags', 30000, 'GBP', array['Blue'], array['S'], 3, 1, 'approved', 'unisex', true);
  insert into public.products(id, sku, name, slug, category_id, price, currency, status, published_at, seller_listing_id)
  values
    ('96000000-0000-0000-0000-000000000001', 'PRIVACY-P1', 'Inventory A', 'inventory-a', category_id, 10000, 'GBP', 'active', now(), '95000000-0000-0000-0000-000000000001'),
    ('96000000-0000-0000-0000-000000000002', 'PRIVACY-P2', 'Inventory B', 'inventory-b', category_id, 20000, 'GBP', 'active', now(), '95000000-0000-0000-0000-000000000002'),
    ('96000000-0000-0000-0000-000000000003', 'PRIVACY-P3', 'Private inventory A', 'private-inventory-a', category_id, 30000, 'GBP', 'draft', null, '95000000-0000-0000-0000-000000000003');
end $$;

insert into public.product_variants(id, product_id, sku, name, size, color) values
  ('97000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', 'PRIVACY-V1', 'Black / M', 'M', 'Black'),
  ('97000000-0000-0000-0000-000000000002', '96000000-0000-0000-0000-000000000002', 'PRIVACY-V2', 'White / L', 'L', 'White'),
  ('97000000-0000-0000-0000-000000000003', '96000000-0000-0000-0000-000000000003', 'PRIVACY-V3', 'Blue / S', 'S', 'Blue');

insert into public.inventory(variant_id, quantity, reserved_quantity, low_stock_threshold) values
  ('97000000-0000-0000-0000-000000000001', 9, 2, 3),
  ('97000000-0000-0000-0000-000000000002', 5, 1, 2),
  ('97000000-0000-0000-0000-000000000003', 3, 0, 2);

insert into public.seller_listing_variants(listing_id, owner_id, published_variant_id, size, color, quantity) values
  ('95000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', 'M', 'Black', 9),
  ('95000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', '97000000-0000-0000-0000-000000000002', 'L', 'White', 5),
  ('95000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000003', 'S', 'Blue', 3);

select ok(not has_table_privilege('anon', 'public.inventory', 'select'), 'anonymous has no direct inventory table access');
set role anon;
select throws_ok($$select reserved_quantity from public.inventory$$, '42501', null, 'anonymous cannot read reserved quantity');
select is((select count(*) from public.shop_variant_availability(array['97000000-0000-0000-0000-000000000001'::uuid, '97000000-0000-0000-0000-000000000002'::uuid])), 2::bigint, 'anonymous can shop active variants');
select is((select available_quantity from public.shop_variant_availability(array['97000000-0000-0000-0000-000000000001'::uuid])), 7, 'public availability excludes reservations without disclosing them');
select is((select count(*) from public.shop_variant_availability(array['97000000-0000-0000-0000-000000000003'::uuid])), 0::bigint, 'private product availability is hidden');

set role authenticated;
select pg_temp.inventory_test_user('91000000-0000-0000-0000-000000000001');
select is((select count(*) from public.inventory), 0::bigint, 'buyer cannot read operational inventory rows');
select is((select count(*) from public.products where id = '96000000-0000-0000-0000-000000000001'), 1::bigint, 'buyer can browse the active product');
select is((select count(*) from public.product_variants where id = '97000000-0000-0000-0000-000000000001'), 1::bigint, 'buyer can select an active variant');
select is((select available_quantity from public.shop_variant_availability(array['97000000-0000-0000-0000-000000000001'::uuid])), 7, 'buyer can obtain purchasable availability');

select pg_temp.inventory_test_user('92000000-0000-0000-0000-000000000001');
select is((select count(*) from public.inventory), 2::bigint, 'Vendor A sees own active and private inventory only');
select is((select reserved_quantity from public.inventory where variant_id = '97000000-0000-0000-0000-000000000001'), 2, 'Vendor A sees own reservations');
select is((select quantity - reserved_quantity from public.inventory where variant_id = '97000000-0000-0000-0000-000000000001'), 7, 'Vendor A sees own available stock');
select is((select low_stock_threshold from public.inventory where variant_id = '97000000-0000-0000-0000-000000000001'), 3, 'Vendor A sees own low-stock threshold');
select is((select count(*) from public.inventory where variant_id = '97000000-0000-0000-0000-000000000002'), 0::bigint, 'Vendor A cannot see Vendor B inventory');

select pg_temp.inventory_test_user('92000000-0000-0000-0000-000000000002');
select is((select count(*) from public.inventory), 1::bigint, 'Vendor B sees own inventory only');
select is((select quantity from public.inventory where variant_id = '97000000-0000-0000-0000-000000000002'), 5, 'Vendor B sees on-hand stock');
select is((select count(*) from public.inventory where variant_id = '97000000-0000-0000-0000-000000000001'), 0::bigint, 'Vendor B cannot see Vendor A inventory');

select pg_temp.inventory_test_user('93000000-0000-0000-0000-000000000001');
select is(public.current_admin_role(), 'admin', 'test admin role is active');
select ok(public.has_admin_role(array['owner','admin','editor','fulfilment']), 'admin inventory policy recognizes test admin');
select is((select count(*) from public.inventory where variant_id in (
  '97000000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000002',
  '97000000-0000-0000-0000-000000000003'
)), 3::bigint, 'admin retains full inventory access');
select * from finish();
rollback;
