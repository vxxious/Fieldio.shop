-- Restore the thirty matching image files before reactivating these listings.
begin;

update public.products
set status = 'active', updated_at = now()
where sku ~ '^FIELDIO-IMPORT-20260913-(DIOR|GUCCI|LV|PRADA|YSL)-00[1-6]$'
  and status = 'archived';

commit;
