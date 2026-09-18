begin;

do $$
begin
  if exists (select 1 from public.products where currency not in ('GBP', 'EUR', 'USD')) then
    raise exception 'Cannot restore the legacy currency constraint while products use regional currencies';
  end if;
end;
$$;

alter table public.seller_listings drop constraint seller_listings_currency_supported;
alter table public.products drop constraint products_currency_supported;
alter table public.products add constraint products_currency_supported check (currency in ('GBP', 'EUR', 'USD'));

commit;
