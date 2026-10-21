begin;

do $$
declare
  archived_count integer;
begin
  update public.products
  set status = 'archived', updated_at = now()
  where sku ~ '^FIELDIO-IMPORT-20260913-(DIOR|GUCCI|LV|PRADA|YSL)-00[1-6]$';

  get diagnostics archived_count = row_count;
  if archived_count <> 30 then
    raise exception 'Expected 30 first-batch brand products, found %', archived_count;
  end if;
end;
$$;

commit;
