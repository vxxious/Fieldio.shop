begin;

drop policy if exists "owners remove seller listing media" on storage.objects;
drop policy if exists "owners and management read seller listing media" on storage.objects;
drop policy if exists "owners upload seller listing media" on storage.objects;
drop policy if exists "owners remove seller verification files" on storage.objects;
drop policy if exists "owners replace seller verification files" on storage.objects;
drop policy if exists "owners read seller verification files" on storage.objects;
drop policy if exists "owners upload seller verification files" on storage.objects;
delete from storage.buckets where id in ('seller-verification', 'seller-listing-media');

drop function if exists public.review_seller_listing(uuid, text, text, jsonb);
drop function if exists public.submit_seller_listing(uuid);
drop function if exists public.review_seller_application(uuid, text, text);
drop function if exists public.submit_seller_application();

alter table public.products drop column if exists seller_listing_id;
drop table if exists public.seller_listing_images;
drop table if exists public.seller_listings;
drop table if exists public.seller_stores;
drop table if exists public.seller_applications;
drop type if exists public.product_condition;
drop type if exists public.seller_listing_status;
drop type if exists public.seller_review_status;
drop type if exists public.seller_kind;

commit;
