create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.set_test_user(p_user_id uuid)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  return set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, false);
end $$;

create function public.lifecycle_test_item(p_request_key uuid, p_product_id uuid default null)
returns uuid language sql stable security definer set search_path = '' as $$
  select items.id
  from public.order_items items
  join public.order_requests orders on orders.id = items.order_request_id
  where orders.request_key = p_request_key
    and (p_product_id is null or items.product_id = p_product_id)
  order by items.id limit 1
$$;

-- Stable identities used throughout the suite.
insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('01000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'buyer-one@fieldio.test', '', now(), '{}', '{"full_name":"Buyer One"}', now(), now(), false, false),
  ('01000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'buyer-two@fieldio.test', '', now(), '{}', '{"full_name":"Buyer Two"}', now(), now(), false, false),
  ('02000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'vendor-one@fieldio.test', '', now(), '{}', '{"full_name":"Vendor One"}', now(), now(), false, false),
  ('02000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'vendor-two@fieldio.test', '', now(), '{}', '{"full_name":"Vendor Two"}', now(), now(), false, false),
  ('02000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'vendor-other@fieldio.test', '', now(), '{}', '{"full_name":"Vendor Other"}', now(), now(), false, false),
  ('03000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@fieldio.test', '', now(), '{}', '{"full_name":"Fieldio Owner"}', now(), now(), false, false),
  ('03000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'operations@fieldio.test', '', now(), '{}', '{"full_name":"Operations Staff"}', now(), now(), false, false),
  ('03000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'admin@fieldio.test', '', now(), '{}', '{"full_name":"Fieldio Admin"}', now(), now(), false, false);

insert into public.admin_users(user_id, role, email) values
  ('03000000-0000-0000-0000-000000000001', 'owner', 'owner@fieldio.test'),
  ('03000000-0000-0000-0000-000000000002', 'fulfilment', 'operations@fieldio.test'),
  ('03000000-0000-0000-0000-000000000003', 'admin', 'admin@fieldio.test');

insert into public.seller_applications(owner_id, kind, legal_name, business_name, country_code, phone, contact_email, identity_document_path, address_document_path, declaration_accepted, status, phone_country_code, whatsapp_country_code, whatsapp_phone)
values
  ('02000000-0000-0000-0000-000000000001', 'vendor', 'Vendor One', 'Store One', 'GB', '+447700900011', 'vendor-one@fieldio.test', 'test/id-1', 'test/address-1', true, 'approved', 'GB', 'GB', '+447700900011'),
  ('02000000-0000-0000-0000-000000000002', 'vendor', 'Vendor Two', 'Store Two', 'GB', '+447700900012', 'vendor-two@fieldio.test', 'test/id-2', 'test/address-2', true, 'approved', 'GB', 'GB', '+447700900012'),
  ('02000000-0000-0000-0000-000000000003', 'vendor', 'Vendor Other', 'Store Other', 'GB', '+447700900013', 'vendor-other@fieldio.test', 'test/id-3', 'test/address-3', true, 'approved', 'GB', 'GB', '+447700900013');
insert into public.seller_stores(id, owner_id, name, slug, description, contact_email, contact_phone, contact_phone_country_code, contact_whatsapp_country_code, contact_whatsapp_phone)
values
  ('11000000-0000-0000-0000-000000000001', '02000000-0000-0000-0000-000000000001', 'Store One', 'store-one', 'Verified test storefront for lifecycle verification.', 'vendor-one@fieldio.test', '+447700900011', 'GB', 'GB', '+447700900011'),
  ('11000000-0000-0000-0000-000000000002', '02000000-0000-0000-0000-000000000002', 'Store Two', 'store-two', 'Second verified storefront for lifecycle verification.', 'vendor-two@fieldio.test', '+447700900012', 'GB', 'GB', '+447700900012'),
  ('11000000-0000-0000-0000-000000000003', '02000000-0000-0000-0000-000000000003', 'Store Other', 'store-other', 'Unrelated verified storefront for authorization checks.', 'vendor-other@fieldio.test', '+447700900013', 'GB', 'GB', '+447700900013');

do $$
declare category_id uuid;
begin
  select id into category_id from public.categories order by created_at, id limit 1;
  insert into public.seller_listings(id, owner_id, store_id, title, description, category_id, condition, price, currency, colors, sizes, quantity, weight_kg, status, audience, authenticity_confirmed)
  values
    ('12000000-0000-0000-0000-000000000001', '02000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Vendor one product', 'Production lifecycle test product from vendor one.', category_id, 'new_with_tags', 10000, 'GBP', array['Black'], array['M'], 20, 1, 'approved', 'unisex', true),
    ('12000000-0000-0000-0000-000000000002', '02000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'Vendor two product', 'Production lifecycle test product from vendor two.', category_id, 'new_with_tags', 20000, 'GBP', array['White'], array['L'], 20, 1, 'approved', 'unisex', true),
    ('12000000-0000-0000-0000-000000000003', '02000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Final unit product', 'Concurrency lifecycle test product with one final unit.', category_id, 'new_with_tags', 30000, 'GBP', array['Blue'], array['S'], 1, 1, 'approved', 'unisex', true);
  insert into public.products(id, sku, name, slug, category_id, description, short_description, price, currency, status, published_at, seller_listing_id)
  values
    ('13000000-0000-0000-0000-000000000001', 'TEST-P1', 'Vendor one product', 'vendor-one-product', category_id, 'Vendor one lifecycle product.', 'Vendor one product.', 10000, 'GBP', 'active', now(), '12000000-0000-0000-0000-000000000001'),
    ('13000000-0000-0000-0000-000000000002', 'TEST-P2', 'Vendor two product', 'vendor-two-product', category_id, 'Vendor two lifecycle product.', 'Vendor two product.', 20000, 'GBP', 'active', now(), '12000000-0000-0000-0000-000000000002'),
    ('13000000-0000-0000-0000-000000000003', 'TEST-P3', 'Final unit product', 'final-unit-product', category_id, 'Concurrency lifecycle product.', 'Final unit product.', 30000, 'GBP', 'active', now(), '12000000-0000-0000-0000-000000000003');
  update public.seller_listings set published_product_id = case id
    when '12000000-0000-0000-0000-000000000001' then '13000000-0000-0000-0000-000000000001'::uuid
    when '12000000-0000-0000-0000-000000000002' then '13000000-0000-0000-0000-000000000002'::uuid
    else '13000000-0000-0000-0000-000000000003'::uuid end;
end $$;
insert into public.product_variants(id, product_id, sku, name, size, color) values
  ('14000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'TEST-V1', 'Black / M', 'M', 'Black'),
  ('14000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'TEST-V2', 'White / L', 'L', 'White'),
  ('14000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000003', 'TEST-LAST', 'Blue / S', 'S', 'Blue');
insert into public.inventory(variant_id, quantity) values
  ('14000000-0000-0000-0000-000000000001', 20),
  ('14000000-0000-0000-0000-000000000002', 20),
  ('14000000-0000-0000-0000-000000000003', 1);

-- Single-vendor order creation reserves, rather than deducts, exact variant stock.
set role service_role;
select public.create_order_request(
  '{"name":"Buyer One","phone":"+447700900101","email":"buyer-one@fieldio.test","shippingAddress":"1 Test Road"}',
  '[{"productId":"13000000-0000-0000-0000-000000000001","variantId":"14000000-0000-0000-0000-000000000001","quantity":1}]',
  '01000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001');
reset role;
select is((select payment_status from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001'), 'pending', 'new order starts payment pending');
select is((select quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000001'), 20, 'order creation does not deduct physical stock');
select is((select reserved_quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000001'), 1, 'order creation reserves the exact variant');

set role authenticated;
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.update_order_request_status((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001'), 'awaiting_confirmation');
select public.update_order_request_status((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001'), 'confirmed');
select is((select reserved_quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000001'), 1, 'confirmation does not double reserve inventory');
select public.confirm_order_payment((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001'), 10000, 0, 'bank_transfer', 'PAY-SINGLE');

select pg_temp.set_test_user('02000000-0000-0000-0000-000000000001');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'accepted');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'processing');
select throws_ok(
  $$select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'shipped', null, null)$$,
  '23514', 'SHIPPING_DETAILS_REQUIRED', 'shipping without carrier and tracking rolls back');
select is((select reserved_quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000001'), 1, 'failed shipment leaves reservation intact');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'shipped', 'DHL', 'DHL-SINGLE');
select is((select quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000001'), 19, 'shipment deducts exact physical inventory');
select is((select reserved_quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000001'), 0, 'shipment clears exact reservation');

select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select lives_ok(
  $$select public.confirm_vendor_fulfillment_delivery((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1))$$,
  'admin confirms one vendor delivery');
select is((select status::text from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001'), 'delivered', 'single-vendor master order becomes delivered');
select is((select payout_status from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001')), 'eligible', 'paid delivered vendor earning becomes eligible');

select pg_temp.set_test_user('01000000-0000-0000-0000-000000000001');
select is((select count(*) from public.review_eligibility('13000000-0000-0000-0000-000000000001')), 1::bigint, 'delivered buyer is eligible for the exact purchased item');
select public.create_product_review((select id from public.order_items where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001')), 5, 'The exact delivered product arrived in excellent condition.', array['good_quality']);
select is((select rating_count from public.products where id = '13000000-0000-0000-0000-000000000001'), 1, 'verified review updates product aggregate');

select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select public.create_seller_payout('02000000-0000-0000-0000-000000000001', 'GBP');
select public.update_seller_payout((select id from public.seller_payouts where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'approved');
select public.update_seller_payout((select id from public.seller_payouts where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'paid', 'PAYOUT-SINGLE');
select is((select status from public.seller_payouts where reference = 'PAYOUT-SINGLE'), 'paid', 'single-vendor payout is approved and paid');

-- Multi-vendor order: each group progresses and tracks independently.
reset role;
set role service_role;
select public.create_order_request(
  '{"name":"Buyer One","phone":"+447700900101","email":"buyer-one@fieldio.test","shippingAddress":"1 Test Road"}',
  '[{"productId":"13000000-0000-0000-0000-000000000001","variantId":"14000000-0000-0000-0000-000000000001","quantity":2},{"productId":"13000000-0000-0000-0000-000000000002","variantId":"14000000-0000-0000-0000-000000000002","quantity":1}]',
  '01000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000002');
reset role;
select is((select count(*) from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002')), 2::bigint, 'multi-vendor order splits into two fulfillments');
select is((select reserved_quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000001'), 2, 'vendor one exact variant reserves independently');
select is((select reserved_quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000002'), 1, 'vendor two exact variant reserves independently');

set role authenticated;
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select public.update_order_request_status((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002'), 'awaiting_confirmation');
select public.update_order_request_status((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002'), 'confirmed');
select public.confirm_order_payment((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002'), 40000, 0, 'bank_transfer', 'PAY-MULTI');
select pg_temp.set_test_user('02000000-0000-0000-0000-000000000001');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'accepted');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'processing');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'shipped', 'DHL', 'DHL-MULTI-1');
select pg_temp.set_test_user('02000000-0000-0000-0000-000000000002');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000002' order by created_at desc limit 1), 'accepted');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000002' order by created_at desc limit 1), 'processing');
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select is((select fulfillment_status::text from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002'), 'partially_fulfilled', 'one vendor ships while the other prepares');
select is((select status::text from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002'), 'processing', 'master order remains truthfully processing during partial fulfilment');
select public.confirm_vendor_fulfillment_delivery((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1));
select is((select fulfillment_status::text from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002'), 'partially_delivered', 'one delivered group produces partial delivery');
select pg_temp.set_test_user('02000000-0000-0000-0000-000000000002');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000002' order by created_at desc limit 1), 'shipped', 'UPS', 'UPS-MULTI-2');
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select public.confirm_vendor_fulfillment_delivery((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000002' order by created_at desc limit 1));
select is((select fulfillment_status::text from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002'), 'delivered', 'all groups delivered produces final delivered state');
select is((select count(distinct tracking_reference) from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002')), 2::bigint, 'vendor groups retain independent tracking');

-- Rejection releases only the rejected reservation and preserves the completed group.
reset role;
set role service_role;
select public.create_order_request(
  '{"name":"Buyer One","phone":"+447700900101","email":"buyer-one@fieldio.test","shippingAddress":"1 Test Road"}',
  '[{"productId":"13000000-0000-0000-0000-000000000001","variantId":"14000000-0000-0000-0000-000000000001","quantity":1},{"productId":"13000000-0000-0000-0000-000000000002","variantId":"14000000-0000-0000-0000-000000000002","quantity":2}]',
  '01000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000003');
reset role;
set role authenticated;
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select public.update_order_request_status((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000003'), 'awaiting_confirmation');
select public.update_order_request_status((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000003'), 'confirmed');
select public.confirm_order_payment((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000003'), 50000, 0, 'bank_transfer', 'PAY-REJECT');
select pg_temp.set_test_user('02000000-0000-0000-0000-000000000001');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'accepted');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'processing');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'shipped', 'DHL', 'DHL-REJECT-1');
select pg_temp.set_test_user('02000000-0000-0000-0000-000000000002');
select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000002' order by created_at desc limit 1), 'rejected', null, null, 'Inventory was damaged before dispatch');
select is((select reserved_quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000002'), 0, 'rejected vendor reservation is released');
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select public.confirm_vendor_fulfillment_delivery((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' order by created_at desc limit 1));
select is((select fulfillment_status::text from public.order_requests where request_key = '15000000-0000-0000-0000-000000000003'), 'partially_delivered', 'delivered plus rejected derives partial delivery');
select is((select status::text from public.order_requests where request_key = '15000000-0000-0000-0000-000000000003'), 'delivered', 'rejection does not destroy the completed transaction');
select is((select payout_status from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000003') and seller_owner_id = '02000000-0000-0000-0000-000000000001'), 'eligible', 'accepted delivered vendor remains payout eligible');
select pg_temp.set_test_user('01000000-0000-0000-0000-000000000001');
select is((select count(*) from public.review_eligibility('13000000-0000-0000-0000-000000000001') where order_item_id = (select id from public.order_items where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000003') and product_id = '13000000-0000-0000-0000-000000000001')), 1::bigint, 'unrelated vendor rejection preserves valid review eligibility');

-- Payment protection and rollback.
reset role;
set role service_role;
select public.create_order_request(
  '{"name":"Buyer One","phone":"+447700900101","email":"buyer-one@fieldio.test","shippingAddress":"1 Test Road"}',
  '[{"productId":"13000000-0000-0000-0000-000000000002","variantId":"14000000-0000-0000-0000-000000000002","quantity":1}]',
  '01000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000004');
reset role;
set role authenticated;
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select public.update_order_request_status((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000004'), 'awaiting_confirmation');
select public.update_order_request_status((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000004'), 'confirmed');
select throws_ok($$select public.confirm_order_payment((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000004'), 0, 0, 'cash', 'BAD')$$, '22023', 'INVALID_PAYMENT_AMOUNT', 'invalid payment confirmation rolls back');
select is((select payment_status from public.order_requests where request_key = '15000000-0000-0000-0000-000000000004'), 'pending', 'failed payment leaves payment pending');
select pg_temp.set_test_user('02000000-0000-0000-0000-000000000002');
select throws_ok($$select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000002' order by created_at desc limit 1), 'accepted')$$, '23514', 'PAYMENT_NOT_CONFIRMED', 'vendor cannot fulfil before payment');
reset role;
insert into public.seller_payouts(id, seller_owner_id, amount, currency) values ('16000000-0000-0000-0000-000000000001', '02000000-0000-0000-0000-000000000002', 1000, 'GBP');
select throws_ok($$insert into public.seller_payout_items(payout_id, fulfillment_id, amount) values ('16000000-0000-0000-0000-000000000001', (select id from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000004')), 1000)$$, '23514', 'PAYOUT_NOT_ELIGIBLE', 'unpaid fulfillment cannot enter a payout');
select is((select count(*) from public.seller_payout_items where payout_id = '16000000-0000-0000-0000-000000000001'), 0::bigint, 'failed payout insert leaves no partial payout item');

-- Authorization is enforced by grants, RLS and security-definer checks.
set role anon;
select throws_ok($$select public.update_vendor_fulfillment_status('00000000-0000-0000-0000-000000000000', 'accepted')$$, '42501', null, 'anonymous cannot invoke vendor mutation');
select throws_ok($$select * from public.order_requests$$, '42501', null, 'anonymous cannot read private orders');
set role authenticated;
select pg_temp.set_test_user('01000000-0000-0000-0000-000000000002');
select throws_ok($$select public.update_vendor_fulfillment_status((select id from public.order_fulfillments limit 1), 'accepted')$$, '42501', 'SELLER_ACCESS_REQUIRED', 'buyer cannot perform vendor fulfillment');
select pg_temp.set_test_user('02000000-0000-0000-0000-000000000003');
select throws_ok($$select public.update_vendor_fulfillment_status((select id from public.order_fulfillments where seller_owner_id = '02000000-0000-0000-0000-000000000001' limit 1), 'accepted')$$, 'P0002', 'FULFILLMENT_NOT_FOUND', 'unrelated vendor cannot mutate another vendor fulfillment');
select is((select count(*) from public.order_fulfillments where seller_owner_id <> '02000000-0000-0000-0000-000000000003'), 0::bigint, 'RLS hides other vendors fulfillment rows');
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000002');
select throws_ok($$select public.confirm_order_payment((select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000004'), 20000, 0, 'cash', 'OPS-NO')$$, '42501', 'STAFF_ACCESS_REQUIRED', 'non-finance operations staff cannot confirm payment');
select throws_ok($$select public.create_seller_payout('02000000-0000-0000-0000-000000000001', 'GBP')$$, '42501', 'STAFF_ACCESS_REQUIRED', 'non-finance operations staff cannot create payouts');

-- Review security: unrelated, undelivered and self-review attempts fail.
select pg_temp.set_test_user('01000000-0000-0000-0000-000000000002');
select throws_ok($$select public.create_product_review(public.lifecycle_test_item('15000000-0000-0000-0000-000000000002'), 5, 'I did not buy this delivered marketplace item.', '{}')$$, 'P0001', 'Only a verified buyer can review this item', 'unverified buyer cannot review');
select pg_temp.set_test_user('01000000-0000-0000-0000-000000000001');
select throws_ok($$select public.create_product_review(public.lifecycle_test_item('15000000-0000-0000-0000-000000000004'), 5, 'This item has not been delivered to me yet.', '{}')$$, 'P0001', 'Only a verified buyer can review this item', 'buyer cannot review an undelivered item');
reset role;
insert into public.order_requests(id, user_id, customer_name, customer_phone, customer_email, shipping_address, status, currency, subtotal, shipping_total, total, confirmed_at, payment_status, payment_amount, payment_method, payment_reference, payment_confirmed_at, fulfillment_status, inventory_reserved_at)
values ('17000000-0000-0000-0000-000000000001', '02000000-0000-0000-0000-000000000001', 'Vendor One', '+447700900011', 'vendor-one@fieldio.test', 'Vendor address', 'delivered', 'GBP', 10000, 0, 10000, now(), 'confirmed', 10000, 'cash', 'SELF', now(), 'delivered', now());
insert into public.order_fulfillments(id, order_request_id, seller_owner_id, seller_store_id, store_name, status, delivered_at, group_key)
values ('18000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '02000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Store One', 'delivered', now(), 'self-review');
insert into public.order_items(id, fulfillment_id, order_request_id, product_id, product_variant_id, product_name, brand_name, sku, variant_name, size, color, quantity, unit_price, line_total, currency)
values ('19000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'Vendor one product', 'Store One', 'TEST-V1', 'Black / M', 'M', 'Black', 1, 10000, 10000, 'GBP');
set role authenticated;
select pg_temp.set_test_user('02000000-0000-0000-0000-000000000001');
select throws_ok($$select public.create_product_review('19000000-0000-0000-0000-000000000001', 5, 'A seller must not review their own marketplace product.', '{}')$$, 'P0001', 'Sellers cannot review their own products', 'seller cannot review own product');

-- Payout holds are scoped, concurrent-safe, releasable and immutable after payment.
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select public.create_seller_payout('02000000-0000-0000-0000-000000000001', 'GBP');
select public.create_seller_payout('02000000-0000-0000-0000-000000000002', 'GBP');
select public.update_seller_payout((select id from public.seller_payouts where seller_owner_id = '02000000-0000-0000-0000-000000000001' and status = 'pending' order by created_at desc limit 1), 'approved');
select public.update_seller_payout((select id from public.seller_payouts where seller_owner_id = '02000000-0000-0000-0000-000000000002' and status = 'pending' order by created_at desc limit 1), 'approved');
select pg_temp.set_test_user('01000000-0000-0000-0000-000000000001');
select public.open_marketplace_return(
  (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002'),
  (select id from public.order_items where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002') and product_id = '13000000-0000-0000-0000-000000000001'),
  1, 'damaged', 'The delivered item arrived damaged and cannot be used.');
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select is((select payout_hold_status from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002') and seller_owner_id = '02000000-0000-0000-0000-000000000001'), 'held', 'case holds only affected vendor fulfillment');
select is((select payout_hold_status from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002') and seller_owner_id = '02000000-0000-0000-0000-000000000002'), 'clear', 'unrelated vendor remains clear');
select throws_ok($$select public.update_seller_payout((select payout_id from public.seller_payout_items where fulfillment_id = (select id from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002') and seller_owner_id = '02000000-0000-0000-0000-000000000001') order by payout_id desc limit 1), 'paid', 'MUST-NOT-PAY')$$, '23514', null, 'held earnings cannot be paid through payout endpoint');
select public.update_marketplace_case('return', (select id from public.marketplace_returns order by created_at desc limit 1), 'rejected', 'Evidence did not support this return.', 'release');
select is((select payout_hold_status from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000002') and seller_owner_id = '02000000-0000-0000-0000-000000000001'), 'clear', 'explicit release clears payout hold');

select pg_temp.set_test_user('01000000-0000-0000-0000-000000000001');
select public.open_marketplace_dispute(
  (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001'),
  (select id from public.order_items where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001')),
  'item', 'The already paid item requires a financial recovery record.');
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select is((select status from public.seller_payouts where reference = 'PAYOUT-SINGLE'), 'paid', 'opening case never rewrites paid payout history');
select is((select count(*) from public.payout_adjustments where kind = 'recovery_pending' and payout_id = (select id from public.seller_payouts where reference = 'PAYOUT-SINGLE')), 1::bigint, 'paid payout creates recovery adjustment');
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000002');
select public.update_marketplace_case('dispute', (select id from public.marketplace_disputes order by created_at desc limit 1), 'reviewing');
select pg_temp.set_test_user('03000000-0000-0000-0000-000000000001');
select public.update_marketplace_case('dispute', (select id from public.marketplace_disputes order by created_at desc limit 1), 'resolved', 'Refund approved after review.', 'refund');
select is((select count(*) from public.payout_adjustments where kind = 'refund' and payout_id = (select id from public.seller_payouts where reference = 'PAYOUT-SINGLE')), 1::bigint, 'refund appends a financial adjustment');
select is((select count(distinct kind) from public.payout_adjustments where payout_id = (select id from public.seller_payouts where reference = 'PAYOUT-SINGLE')), 2::bigint, 'recovery and refund history both remain immutable');
reset role;
select throws_ok($$update public.payout_adjustments set amount = 0 where payout_id = (select id from public.seller_payouts where reference = 'PAYOUT-SINGLE')$$, '55000', 'PAYOUT_ADJUSTMENTS_ARE_IMMUTABLE', 'financial adjustments cannot be rewritten');
select throws_ok($$delete from public.payout_adjustments where payout_id = (select id from public.seller_payouts where reference = 'PAYOUT-SINGLE')$$, '55000', 'PAYOUT_ADJUSTMENTS_ARE_IMMUTABLE', 'financial adjustments cannot be deleted');

-- Event and notification integrity.
select ok((select count(*) >= 8 from public.order_events where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001')), 'important lifecycle actions append order events');
select ok((select bool_and(created_at is not null) from public.order_events), 'every lifecycle event has a truthful database timestamp');
select is((select created_at from public.order_events where event_type = 'fulfillment_status_changed' and to_status = 'shipped' and order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001') order by id desc limit 1), (select shipped_at from public.order_fulfillments where order_request_id = (select id from public.order_requests where request_key = '15000000-0000-0000-0000-000000000001')), 'shipment event timestamp matches shipment transition');
set role authenticated;
select pg_temp.set_test_user('01000000-0000-0000-0000-000000000001');
select throws_ok($$update public.order_events set note = 'tampered' where id = (select min(id) from public.order_events)$$, '42501', null, 'buyer cannot modify event history');
reset role;
select throws_ok($$delete from public.order_events where id = (select min(id) from public.order_events)$$, '55000', 'ORDER_EVENTS_ARE_IMMUTABLE', 'event history cannot be deleted even with table access');
insert into public.notification_deliveries(event_key, recipient_email, template, status) values ('order:test:confirmed', 'buyer-one@fieldio.test', 'order-status', 'sent');
select throws_ok($$insert into public.notification_deliveries(event_key, recipient_email, template, status) values ('order:test:confirmed', 'buyer-one@fieldio.test', 'order-status', 'sent')$$, '23505', null, 'retry cannot duplicate a notification delivery record');

-- Real concurrent reservation of the final unit: exactly one remote transaction wins.
create or replace function public.lifecycle_test_reserve(p_user uuid, p_key uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform public.create_order_request(
    jsonb_build_object('name', 'Concurrent Buyer', 'phone', '+447700900199', 'email', p_user::text || '@fieldio.test', 'shippingAddress', 'Concurrency Road'),
    jsonb_build_array(jsonb_build_object('productId', '13000000-0000-0000-0000-000000000003', 'variantId', '14000000-0000-0000-0000-000000000003', 'quantity', 1)),
    p_user, p_key
  );
  return true;
exception when others then
  return false;
end $$;
select dblink_connect('buyer_a', 'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres');
select dblink_connect('buyer_b', 'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres');
select dblink_send_query('buyer_a', $$select public.lifecycle_test_reserve('01000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000011')$$);
select dblink_send_query('buyer_b', $$select public.lifecycle_test_reserve('01000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000012')$$);
create temporary table lifecycle_concurrency_results(ok boolean);
insert into lifecycle_concurrency_results select ok from dblink_get_result('buyer_a') as result(ok boolean);
insert into lifecycle_concurrency_results select ok from dblink_get_result('buyer_b') as result(ok boolean);
select is((select count(*) from lifecycle_concurrency_results where ok), 1::bigint, 'exactly one concurrent buyer reserves the final unit');
select is((select reserved_quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000003'), 1, 'final unit has exactly one reservation');
select ok((select quantity >= 0 and reserved_quantity between 0 and quantity from public.inventory where variant_id = '14000000-0000-0000-0000-000000000003'), 'concurrent stock never becomes negative or over-reserved');
select is((select count(*) from public.order_requests where request_key in ('15000000-0000-0000-0000-000000000011','15000000-0000-0000-0000-000000000012')), 1::bigint, 'failed concurrent order rolls back without a partial order');
select dblink_disconnect('buyer_a');
select dblink_disconnect('buyer_b');
drop function public.lifecycle_test_reserve(uuid, uuid);
drop function public.lifecycle_test_item(uuid, uuid);

select * from finish();
