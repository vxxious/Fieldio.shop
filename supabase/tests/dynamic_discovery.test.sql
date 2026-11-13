begin;

do $$
<<fixture>>
declare
  prada_id uuid;
  louis_id uuid;
  category_id uuid;
  vendor_id uuid;
  store_id uuid;
  listing_id uuid;
  vendor_product_id uuid;
  original_publication timestamptz;
begin
  select id into prada_id from public.brands where slug = 'prada';
  select id into louis_id from public.brands where slug = 'louis-vuitton';
  select id into category_id from public.categories where is_active order by id limit 1;
  select owner_id, id into vendor_id, store_id from public.seller_stores where status = 'active' order by id limit 1;
  if prada_id is null or louis_id is null or category_id is null or vendor_id is null then
    raise exception 'Required isolated fixture data is missing';
  end if;

  insert into public.products(sku, slug, name, brand_id, category_id, price, currency, tags, status)
  values ('DISCOVERY-LOUIS', 'discovery-louis', 'Louis test piece', louis_id, category_id, 10000, 'GBP', array['women'], 'active');
  select published_at into original_publication from public.products where sku = 'DISCOVERY-LOUIS';
  if original_publication is null or not exists (select 1 from public.discovery_products where sku = 'DISCOVERY-LOUIS' and new_in_active) then
    raise exception 'Admin publication did not enter New In';
  end if;
  update public.products set name = 'Louis edited piece' where sku = 'DISCOVERY-LOUIS';
  if (select published_at from public.products where sku = 'DISCOVERY-LOUIS') is distinct from original_publication then
    raise exception 'Editing reset the publication time';
  end if;
  update public.products set status = 'draft' where sku = 'DISCOVERY-LOUIS';
  if exists (select 1 from public.discovery_products where sku = 'DISCOVERY-LOUIS') then raise exception 'Unpublished admin piece remained public'; end if;
  update public.products set status = 'active' where sku = 'DISCOVERY-LOUIS';
  if not exists (select 1 from public.discovery_products where sku = 'DISCOVERY-LOUIS' and new_in_active) then raise exception 'Republished admin piece missed New In'; end if;

  insert into public.products(sku, slug, name, brand_id, category_id, price, compare_at_price, currency, tags, status, published_at, sale_ends_at)
  values
    ('DISCOVERY-PRADA', 'discovery-prada', 'Prada sale piece', prada_id, category_id, 8000, 10000, 'GBP', array['men'], 'active', now() - interval '1 hour', now() + interval '1 day'),
    ('DISCOVERY-EXPIRED', 'discovery-expired', 'Prada expired offer', prada_id, category_id, 8000, 10000, 'GBP', array['men'], 'active', now() - interval '4 days', now() - interval '1 hour'),
    ('DISCOVERY-OLD', 'discovery-old', 'Older Prada piece', prada_id, category_id, 10000, null, 'GBP', array['men'], 'active', now() - interval '4 days', null);
  if not exists (select 1 from public.discovery_products where sku = 'DISCOVERY-PRADA' and sale_active and new_in_active and original_price = 10000 and effective_price = 8000) then
    raise exception 'Active offer did not reach New In and Sale';
  end if;
  update public.products set price = 10000, compare_at_price = null where sku = 'DISCOVERY-PRADA';
  if exists (select 1 from public.discovery_products where sku = 'DISCOVERY-PRADA' and sale_active) then raise exception 'Removed offer remained in Sale'; end if;
  update public.products set price = 8000, compare_at_price = 10000 where sku = 'DISCOVERY-PRADA';
  if exists (select 1 from public.discovery_products where sku = 'DISCOVERY-EXPIRED' and sale_active)
    or (select effective_price from public.discovery_products where sku = 'DISCOVERY-EXPIRED') <> 10000
    or exists (select 1 from public.discovery_products where sku = 'DISCOVERY-OLD' and new_in_active) then
    raise exception 'Expired offer or New In cutoff is wrong';
  end if;
  update public.products set sale_starts_at = now() + interval '1 day', sale_ends_at = now() + interval '2 days' where sku = 'DISCOVERY-PRADA';
  if exists (select 1 from public.discovery_products where sku = 'DISCOVERY-PRADA' and sale_active)
    or (select effective_price from public.discovery_products where sku = 'DISCOVERY-PRADA') <> 10000 then
    raise exception 'Scheduled offer appeared before its start';
  end if;
  update public.products set sale_starts_at = null, sale_ends_at = now() + interval '1 day' where sku = 'DISCOVERY-PRADA';

  insert into public.seller_listings(owner_id, store_id, title, description, category_id, condition, price, currency, quantity, weight_kg, status, brand_id)
  values (vendor_id, store_id, 'Pending discovery piece', 'A pending seller piece for isolated discovery checks.', category_id, 'excellent', 12000, 'GBP', 1, 1, 'pending', prada_id)
  returning id into listing_id;
  insert into public.products(sku, slug, name, category_id, price, currency, tags, status, seller_listing_id)
  values ('DISCOVERY-VENDOR', 'discovery-vendor', 'Vendor test piece', category_id, 12000, 'GBP', array['women'], 'draft', listing_id)
  returning id into vendor_product_id;
  if exists (select 1 from public.discovery_products where id = vendor_product_id) then raise exception 'Pending vendor piece leaked'; end if;
  update public.seller_listings set status = 'approved', published_product_id = vendor_product_id where id = listing_id;
  update public.products set status = 'active' where id = vendor_product_id;
  if not exists (select 1 from public.discovery_products where id = vendor_product_id and brand_id = prada_id and new_in_active) then
    raise exception 'Approved vendor piece missing from brand or New In';
  end if;
  insert into public.seller_listings(owner_id, store_id, title, description, category_id, condition, price, currency, quantity, weight_kg, status, brand_id)
  values (vendor_id, store_id, 'Older discovery piece', 'An older seller piece for isolated discovery checks.', category_id, 'excellent', 12000, 'GBP', 1, 1, 'approved', prada_id)
  returning id into listing_id;
  insert into public.products(sku, slug, name, category_id, price, currency, tags, status, published_at, seller_listing_id)
  values ('DISCOVERY-VENDOR-OLD', 'discovery-vendor-old', 'Older vendor piece', category_id, 12000, 'GBP', array['women'], 'draft', now() - interval '8 days', listing_id)
  returning id into vendor_product_id;
  update public.products set status = 'active' where id = vendor_product_id;
  if not exists (select 1 from public.discovery_products where id = vendor_product_id and not new_in_active) then
    raise exception 'Older vendor piece crossed the seven-day window';
  end if;

  insert into public.products(sku, slug, name, brand_id, category_id, price, currency, tags, status, published_at)
  select 'DISCOVERY-PAGE-' || n, 'discovery-page-' || n, 'Pagination piece ' || n, prada_id, category_id, 5000 + n, 'GBP', array['men'], 'active', now() - interval '1 hour'
  from generate_series(1, 100) n;
  if (select count(*) from public.discovery_products where sku like 'DISCOVERY-PAGE-%') <> 100 then raise exception '100-piece fixture failed'; end if;
  if (select count(*) from (select id from public.discovery_products where sku like 'DISCOVERY-PAGE-%' order by published_at desc, id desc limit 12 offset 96) page) <> 4 then
    raise exception 'Backend page boundary failed';
  end if;
  if (select count(*) from public.discovery_products d where d.sku like 'DISCOVERY-PAGE-%' and d.brand_id = prada_id and d.tags @> array['men'] and d.category_id = fixture.category_id and d.currency = 'GBP' and d.effective_price between 5001 and 5100) <> 100 then
    raise exception 'Combined filters failed';
  end if;

  insert into public.seller_listings(owner_id, store_id, title, description, audience, category_id, condition, price, currency, quantity, weight_kg, status, brand_id)
  values (vendor_id, store_id, 'Review flow discovery piece', 'A pending seller piece for the actual approval flow.', 'women', category_id, 'excellent', 11000, 'GBP', 1, 1, 'pending', louis_id)
  returning id into listing_id;
  insert into public.seller_listing_variants(listing_id, owner_id, size, color, quantity)
  values (listing_id, vendor_id, 'M', 'Black', 1);
  if exists (select 1 from public.discovery_products where sku like 'SELL-%' and name = 'Review flow discovery piece') then
    raise exception 'Pending review piece leaked';
  end if;
end $$;

select set_config('request.jwt.claim.sub', (select user_id::text from public.admin_users where role in ('owner','admin') order by user_id limit 1), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', (select user_id::text from public.admin_users where role in ('owner','admin') order by user_id limit 1), 'role', 'authenticated', 'aal', 'aal2')::text, true);
set local role authenticated;
do $$
declare listing_id uuid;
begin
  select id into listing_id from public.seller_listings where title = 'Review flow discovery piece';
  perform public.review_seller_listing(listing_id, 'approved', null, '[{"storage_path":"test/discovery-review.jpg","public_url":"https://example.test/review.jpg","alt_text":"Review piece","position":0}]'::jsonb);
  if not exists (select 1 from public.discovery_products p join public.brands b on b.id = p.brand_id where p.seller_listing_id = listing_id and b.slug = 'louis-vuitton' and p.new_in_active) then
    raise exception 'Real review flow missed the assigned brand or New In';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', (select owner_id::text from public.seller_listings where title = 'Pending discovery piece'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', (select owner_id::text from public.seller_listings where title = 'Pending discovery piece'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
set local role authenticated;
do $$
declare listing_id uuid;
begin
  select id into listing_id from public.seller_listings where title = 'Pending discovery piece';
  perform public.set_vendor_discount(listing_id, 9000, 12000, now() - interval '1 minute', now() + interval '1 day');
  if not exists (select 1 from public.discovery_products where sku = 'DISCOVERY-VENDOR' and sale_active and effective_price = 9000) then
    raise exception 'Authorized vendor offer did not reach Sale';
  end if;
  begin
    perform public.set_vendor_discount(listing_id, 9000, 8000);
    raise exception 'Invalid vendor discount was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.set_vendor_discount(listing_id, 8000, 12000);
    raise exception 'Unrelated user changed vendor pricing';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role anon;
do $$
begin
  if exists (select 1 from public.discovery_products where sku = 'DISCOVERY-VENDOR-OLD' and new_in_active)
    or exists (select 1 from public.discovery_products where sku = 'DISCOVERY-PRADA' and not sale_active) then
    raise exception 'Anonymous discovery visibility is inconsistent';
  end if;
end $$;
reset role;

rollback;
