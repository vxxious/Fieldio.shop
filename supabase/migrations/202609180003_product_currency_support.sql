begin;

alter table public.products drop constraint products_currency_supported;
alter table public.products add constraint products_currency_supported check (currency ~ '^[A-Z]{3}$');
alter table public.seller_listings add constraint seller_listings_currency_supported check (currency ~ '^[A-Z]{3}$');

commit;
