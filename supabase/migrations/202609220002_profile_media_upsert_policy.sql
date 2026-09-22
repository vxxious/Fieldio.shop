begin;

create policy "owners read profile media metadata"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-media'
  and name in ((select auth.uid())::text || '/avatar', (select auth.uid())::text || '/store-logo')
);

commit;
