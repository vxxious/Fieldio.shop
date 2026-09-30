-- Loaded only after resetting the isolated database to migration 202609250002.
do $$
declare
  vendor_id constant uuid := '10000000-0000-0000-0000-000000000001';
  vendor_two_id constant uuid := '10000000-0000-0000-0000-000000000003';
  buyer_id constant uuid := '10000000-0000-0000-0000-000000000002';
  store_id constant uuid := '20000000-0000-0000-0000-000000000001';
  store_two_id constant uuid := '20000000-0000-0000-0000-000000000002';
  draft_listing_id constant uuid := '30000000-0000-0000-0000-000000000001';
  live_listing_id constant uuid := '30000000-0000-0000-0000-000000000002';
  second_listing_id constant uuid := '30000000-0000-0000-0000-000000000003';
  product_id constant uuid := '40000000-0000-0000-0000-000000000001';
  second_product_id constant uuid := '40000000-0000-0000-0000-000000000002';
  variant_one constant uuid := '50000000-0000-0000-0000-000000000001';
  variant_two constant uuid := '50000000-0000-0000-0000-000000000002';
  second_variant constant uuid := '50000000-0000-0000-0000-000000000003';
  order_id constant uuid := '60000000-0000-0000-0000-000000000001';
  contradictory_order_id constant uuid := '60000000-0000-0000-0000-000000000002';
  pending_order_id constant uuid := '60000000-0000-0000-0000-000000000003';
  multi_order_id constant uuid := '60000000-0000-0000-0000-000000000004';
  fulfillment_id constant uuid := '70000000-0000-0000-0000-000000000001';
  contradictory_fulfillment_id constant uuid := '70000000-0000-0000-0000-000000000002';
  pending_fulfillment_id constant uuid := '70000000-0000-0000-0000-000000000003';
  multi_fulfillment_one constant uuid := '70000000-0000-0000-0000-000000000004';
  multi_fulfillment_two constant uuid := '70000000-0000-0000-0000-000000000005';
  item_id constant uuid := '80000000-0000-0000-0000-000000000001';
  contradictory_item_id constant uuid := '80000000-0000-0000-0000-000000000002';
  review_id constant uuid := '90000000-0000-0000-0000-000000000001';
  contradictory_review_id constant uuid := '90000000-0000-0000-0000-000000000002';
  payout_id constant uuid := 'a0000000-0000-0000-0000-000000000001';
  category_id uuid;
begin
  select id into category_id from public.categories order by created_at, id limit 1;

  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
  values
    (vendor_id, 'authenticated', 'authenticated', 'legacy-vendor@fieldio.test', '', now(), '{}', '{"full_name":"Legacy Vendor"}', now(), now(), false, false),
    (buyer_id, 'authenticated', 'authenticated', 'legacy-buyer@fieldio.test', '', now(), '{}', '{"full_name":"Legacy Buyer"}', now(), now(), false, false),
    (vendor_two_id, 'authenticated', 'authenticated', 'legacy-vendor-two@fieldio.test', '', now(), '{}', '{"full_name":"Legacy Vendor Two"}', now(), now(), false, false);

  insert into public.seller_applications(owner_id, kind, legal_name, business_name, country_code, phone, contact_email, identity_document_path, address_document_path, declaration_accepted, status, phone_country_code, whatsapp_country_code, whatsapp_phone)
  values
    (vendor_id, 'vendor', 'Legacy Vendor', 'Legacy Store', 'GB', '+447700900001', 'legacy-vendor@fieldio.test', 'legacy/id', 'legacy/address', true, 'approved', 'GB', 'GB', '+447700900001'),
    (vendor_two_id, 'vendor', 'Legacy Vendor Two', 'Legacy Store Two', 'GB', '+447700900003', 'legacy-vendor-two@fieldio.test', 'legacy-two/id', 'legacy-two/address', true, 'approved', 'GB', 'GB', '+447700900003');
  insert into public.seller_stores(id, owner_id, name, slug, description, contact_email, contact_phone, contact_phone_country_code, contact_whatsapp_country_code, contact_whatsapp_phone)
  values
    (store_id, vendor_id, 'Legacy Store', 'legacy-store', 'A legacy storefront retained for migration verification.', 'legacy-vendor@fieldio.test', '+447700900001', 'GB', 'GB', '+447700900001'),
    (store_two_id, vendor_two_id, 'Legacy Store Two', 'legacy-store-two', 'A second legacy storefront retained for multi-vendor verification.', 'legacy-vendor-two@fieldio.test', '+447700900003', 'GB', 'GB', '+447700900003');

  insert into public.seller_listings(id, owner_id, store_id, title, description, category_id, condition, price, currency, colors, sizes, quantity, weight_kg, status, audience, authenticity_confirmed)
  values
    (draft_listing_id, vendor_id, store_id, 'Legacy draft', 'A legacy unpublished listing with scalar stock only.', category_id, 'new_with_tags', 10000, 'GBP', array['Black'], array['S','M','L'], 5, 1, 'draft', 'unisex', true),
    (live_listing_id, vendor_id, store_id, 'Legacy live', 'A legacy published listing with exact variant inventory.', category_id, 'new_with_tags', 12000, 'GBP', array['Black'], array['S','M'], 5, 1, 'approved', 'unisex', true),
    (second_listing_id, vendor_two_id, store_two_id, 'Legacy second live', 'A second legacy published listing.', category_id, 'new_with_tags', 14000, 'GBP', array['White'], array['M'], 4, 1, 'approved', 'unisex', true);

  insert into public.products(id, sku, name, slug, category_id, description, short_description, price, currency, status, published_at, seller_listing_id)
  values
    (product_id, 'LEGACY-PRODUCT', 'Legacy live', 'legacy-live', category_id, 'Legacy published product.', 'Legacy product.', 12000, 'GBP', 'active', now(), live_listing_id),
    (second_product_id, 'LEGACY-PRODUCT-2', 'Legacy second live', 'legacy-second-live', category_id, 'Second legacy published product.', 'Second legacy product.', 14000, 'GBP', 'active', now(), second_listing_id);
  update public.seller_listings set published_product_id = product_id where id = live_listing_id;
  update public.seller_listings set published_product_id = second_product_id where id = second_listing_id;
  insert into public.product_variants(id, product_id, sku, name, size, color)
  values
    (variant_one, product_id, 'LEGACY-S', 'Black / S', 'S', 'Black'),
    (variant_two, product_id, 'LEGACY-M', 'Black / M', 'M', 'Black'),
    (second_variant, second_product_id, 'LEGACY-2-M', 'White / M', 'M', 'White');
  insert into public.inventory(variant_id, quantity) values (variant_one, 2), (variant_two, 3), (second_variant, 4);

  insert into public.order_requests(id, user_id, customer_name, customer_phone, customer_email, shipping_address, status, currency, subtotal, total, confirmed_at)
  values (order_id, buyer_id, 'Legacy Buyer', '+447700900002', 'legacy-buyer@fieldio.test', '1 Legacy Road', 'delivered', 'GBP', 12000, 12000, now() - interval '2 days');
  insert into public.order_fulfillments(id, order_request_id, seller_owner_id, seller_store_id, store_name, status, carrier, tracking_reference, shipped_at, delivered_at, group_key, gross_amount, payout_status)
  values (fulfillment_id, order_id, vendor_id, store_id, 'Legacy Store', 'delivered', 'Legacy Carrier', 'LEGACY-TRACK', now() - interval '1 day', now(), store_id::text, 12000, 'paid');
  insert into public.order_items(id, fulfillment_id, order_request_id, product_id, product_variant_id, product_name, brand_name, sku, variant_name, size, color, quantity, unit_price, line_total, currency)
  values (item_id, fulfillment_id, order_id, product_id, variant_one, 'Legacy live', 'Legacy Store', 'LEGACY-S', 'Black / S', 'S', 'Black', 1, 12000, 12000, 'GBP');
  insert into public.product_reviews(id, product_id, buyer_id, order_item_id, product_variant_id, rating, review_text, reviewer_name, purchased_variant, purchased_size, purchased_color)
  values (review_id, product_id, buyer_id, item_id, variant_one, 5, 'This legacy review remains valid after the migration chain.', 'Legacy B.', 'Black / S', 'S', 'Black');
  insert into public.seller_payouts(id, seller_owner_id, amount, currency, status, reference, paid_at)
  values (payout_id, vendor_id, 10200, 'GBP', 'paid', 'LEGACY-PAYOUT', now());
  insert into public.seller_payout_items(payout_id, fulfillment_id, amount)
  values (payout_id, fulfillment_id, 10200);

  -- Exact production-shaped legacy contradiction: the old parent was the
  -- delivery source of truth, while its sole item-bearing group stayed pending.
  insert into public.order_requests(id, user_id, customer_name, customer_phone, customer_email, shipping_address, status, currency, subtotal, total, confirmed_at)
  values
    (contradictory_order_id, buyer_id, 'Legacy Buyer', '+447700900002', 'legacy-buyer@fieldio.test', '1 Legacy Road', 'delivered', 'GBP', 12000, 12000, now() - interval '2 days'),
    (pending_order_id, buyer_id, 'Legacy Buyer', '+447700900002', 'legacy-buyer@fieldio.test', '1 Legacy Road', 'order_request', 'GBP', 12000, 12000, null),
    (multi_order_id, buyer_id, 'Legacy Buyer', '+447700900002', 'legacy-buyer@fieldio.test', '1 Legacy Road', 'delivered', 'GBP', 26000, 26000, now() - interval '2 days');

  insert into public.order_fulfillments(id, order_request_id, seller_owner_id, seller_store_id, store_name, status, delivered_at, group_key, gross_amount, payout_status)
  values
    (contradictory_fulfillment_id, contradictory_order_id, vendor_id, store_id, 'Legacy Store', 'pending', null, store_id::text, 12000, 'pending'),
    (pending_fulfillment_id, pending_order_id, vendor_id, store_id, 'Legacy Store', 'pending', null, store_id::text, 12000, 'pending'),
    (multi_fulfillment_one, multi_order_id, vendor_id, store_id, 'Legacy Store', 'pending', null, store_id::text, 12000, 'pending'),
    (multi_fulfillment_two, multi_order_id, vendor_two_id, store_two_id, 'Legacy Store Two', 'delivered', now() - interval '1 day', store_two_id::text, 14000, 'pending');

  insert into public.order_items(id, fulfillment_id, order_request_id, product_id, product_variant_id, product_name, brand_name, sku, variant_name, size, color, quantity, unit_price, line_total, currency)
  values
    (contradictory_item_id, contradictory_fulfillment_id, contradictory_order_id, product_id, variant_one, 'Legacy live', 'Legacy Store', 'LEGACY-S', 'Black / S', 'S', 'Black', 1, 12000, 12000, 'GBP'),
    ('80000000-0000-0000-0000-000000000003', pending_fulfillment_id, pending_order_id, product_id, variant_one, 'Legacy live', 'Legacy Store', 'LEGACY-S', 'Black / S', 'S', 'Black', 1, 12000, 12000, 'GBP'),
    ('80000000-0000-0000-0000-000000000004', multi_fulfillment_one, multi_order_id, product_id, variant_one, 'Legacy live', 'Legacy Store', 'LEGACY-S', 'Black / S', 'S', 'Black', 1, 12000, 12000, 'GBP'),
    ('80000000-0000-0000-0000-000000000005', multi_fulfillment_two, multi_order_id, second_product_id, second_variant, 'Legacy second live', 'Legacy Store Two', 'LEGACY-2-M', 'White / M', 'M', 'White', 1, 14000, 14000, 'GBP');

  insert into public.product_reviews(id, product_id, buyer_id, order_item_id, product_variant_id, rating, review_text, reviewer_name, purchased_variant, purchased_size, purchased_color)
  values (contradictory_review_id, product_id, buyer_id, contradictory_item_id, variant_one, 4, 'This production-shaped legacy review remains valid after reconciliation.', 'Legacy B.', 'Black / S', 'S', 'Black');
end $$;
