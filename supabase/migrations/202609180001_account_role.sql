begin;

create or replace function public.current_account_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_admin_role() is not null then 'admin'
    when exists (
      select 1
      from public.seller_applications
      where owner_id = (select auth.uid())
        and status in ('approved', 'suspended')
    ) then 'seller'
    else 'buyer'
  end;
$$;

revoke all on function public.current_account_role() from public, anon;
grant execute on function public.current_account_role() to authenticated;

comment on function public.current_account_role() is
  'Returns the signed-in user account role. Permissions remain enforced by RLS and staff/seller status.';

commit;
