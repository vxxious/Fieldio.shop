begin;

drop policy if exists "owners read profile media metadata" on storage.objects;

commit;
