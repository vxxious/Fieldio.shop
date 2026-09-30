create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

select is((select count(*) from public.order_requests where id = '60000000-0000-0000-0000-000000000001'), 1::bigint, 'legacy order survives migrations 003-010');
select is((select payment_status from public.order_requests where id = '60000000-0000-0000-0000-000000000001'), 'pending', 'legacy order receives a safe pending payment state');
select ok((select inventory_reserved_at is not null from public.order_requests where id = '60000000-0000-0000-0000-000000000001'), 'legacy confirmed order receives a reservation timestamp');
select is((select count(*) from public.order_fulfillments where id = '70000000-0000-0000-0000-000000000001'), 1::bigint, 'legacy fulfillment survives');
select is((select count(*) from public.product_reviews where id = '90000000-0000-0000-0000-000000000001'), 1::bigint, 'legacy review survives');
select is((select status from public.seller_payouts where id = 'a0000000-0000-0000-0000-000000000001'), 'paid', 'paid legacy payout history remains paid');
select is((select status from public.seller_payout_items where payout_id = 'a0000000-0000-0000-0000-000000000001'), 'paid', 'legacy payout item is classified as paid');
select is((select count(*) from public.seller_listing_variants where listing_id = '30000000-0000-0000-0000-000000000002'), 2::bigint, 'published legacy variants are preserved exactly');
select is((select sum(quantity) from public.seller_listing_variants where listing_id = '30000000-0000-0000-0000-000000000002'), 5::bigint, 'published legacy inventory total remains exact');
select is((select count(*) from public.seller_listing_variants where listing_id = '30000000-0000-0000-0000-000000000001'), 1::bigint, 'scalar legacy stock is not fabricated across option rows');
select is((select sum(quantity) from public.seller_listing_variants where listing_id = '30000000-0000-0000-0000-000000000001'), 5::bigint, 'scalar legacy stock total remains unchanged');
select is((select quantity from public.seller_listings where id = '30000000-0000-0000-0000-000000000001'), 5, 'legacy listing compatibility quantity remains unchanged');
select is((select status from public.order_fulfillments where id = '70000000-0000-0000-0000-000000000002'), 'delivered', 'delivered parent reconciles its sole legacy pending fulfillment');
select is((select delivered_at from public.order_fulfillments where id = '70000000-0000-0000-0000-000000000002'), null::timestamptz, 'legacy reconciliation does not fabricate delivered_at');
select is((select count(*) from public.product_reviews where id = '90000000-0000-0000-0000-000000000002' and order_item_id = '80000000-0000-0000-0000-000000000002'), 1::bigint, 'review on reconciled legacy item remains valid');
select is((select count(*) from public.order_items where order_request_id = '60000000-0000-0000-0000-000000000002' and id = '80000000-0000-0000-0000-000000000002' and quantity = 1 and line_total = 12000), 1::bigint, 'reconciled legacy order item remains unchanged');
select is((select status from public.seller_payouts where id = 'a0000000-0000-0000-0000-000000000001'), 'paid', 'unrelated paid payout history remains immutable');
select is((select amount from public.seller_payout_items where payout_id = 'a0000000-0000-0000-0000-000000000001'), 10200::bigint, 'unrelated paid payout amount remains unchanged');
select is((select quantity from public.inventory where variant_id = '50000000-0000-0000-0000-000000000001'), 2, 'legacy reconciliation leaves inventory unchanged');
select is((select status from public.order_fulfillments where id = '70000000-0000-0000-0000-000000000003'), 'pending', 'genuinely pending order remains pending');
select is((select status from public.order_fulfillments where id = '70000000-0000-0000-0000-000000000004'), 'pending', 'pending group in a multi-vendor legacy order is not inferred as delivered');
select is((select count(*) from public.order_fulfillments where order_request_id = '60000000-0000-0000-0000-000000000004'), 2::bigint, 'multi-vendor legacy groups remain intact');

select * from finish();
