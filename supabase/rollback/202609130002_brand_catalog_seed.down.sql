begin;

delete from public.products
where sku like 'FIELDIO-IMPORT-20260913-%';

commit;
