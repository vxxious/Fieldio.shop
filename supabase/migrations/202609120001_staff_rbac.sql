begin;

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.admin_users where user_id = (select auth.uid());
$$;

create or replace function public.has_admin_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_admin_role() = any(p_roles), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_admin_role() is not null;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_admin_role() = 'owner';
$$;

revoke all on function public.current_admin_role() from public, anon;
revoke all on function public.has_admin_role(text[]) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_owner() from public;
grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.has_admin_role(text[]) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_owner() to authenticated;

alter function public.handle_new_user() set search_path = '';
alter function public.create_order_request(jsonb, jsonb, uuid, uuid) set search_path = '';
alter function public.consume_rate_limit(text, integer, integer) set search_path = '';

drop policy "profiles self select" on public.profiles;
create policy "profiles self or management select" on public.profiles for select to authenticated
using ((select auth.uid()) = id or public.has_admin_role(array['owner','admin']));

drop policy "admins view admins" on public.admin_users;
create policy "staff view own role" on public.admin_users for select to authenticated
using (user_id = (select auth.uid()) or public.is_owner());

drop policy "admins manage catalog" on public.brands;
drop policy "admins manage categories" on public.categories;
drop policy "admins manage collections" on public.collections;
drop policy "admins manage products" on public.products;
drop policy "admins manage images" on public.product_images;
drop policy "admins manage variants" on public.product_variants;
drop policy "admins manage inventory" on public.inventory;
drop policy "admins manage collection products" on public.collection_products;

create policy "catalog staff manage brands" on public.brands for all to authenticated
using (public.has_admin_role(array['owner','admin','editor'])) with check (public.has_admin_role(array['owner','admin','editor']));
create policy "catalog staff manage categories" on public.categories for all to authenticated
using (public.has_admin_role(array['owner','admin','editor'])) with check (public.has_admin_role(array['owner','admin','editor']));
create policy "catalog staff manage collections" on public.collections for all to authenticated
using (public.has_admin_role(array['owner','admin','editor'])) with check (public.has_admin_role(array['owner','admin','editor']));
create policy "catalog staff manage products" on public.products for all to authenticated
using (public.has_admin_role(array['owner','admin','editor'])) with check (public.has_admin_role(array['owner','admin','editor']));
create policy "catalog staff manage images" on public.product_images for all to authenticated
using (public.has_admin_role(array['owner','admin','editor'])) with check (public.has_admin_role(array['owner','admin','editor']));
create policy "catalog staff manage variants" on public.product_variants for all to authenticated
using (public.has_admin_role(array['owner','admin','editor'])) with check (public.has_admin_role(array['owner','admin','editor']));
create policy "operations staff manage inventory" on public.inventory for all to authenticated
using (public.has_admin_role(array['owner','admin','editor','fulfilment'])) with check (public.has_admin_role(array['owner','admin','editor','fulfilment']));
create policy "catalog staff manage collection products" on public.collection_products for all to authenticated
using (public.has_admin_role(array['owner','admin','editor'])) with check (public.has_admin_role(array['owner','admin','editor']));

drop policy "users read own order requests" on public.order_requests;
drop policy "admins manage order requests" on public.order_requests;
create policy "customers and fulfilment read order requests" on public.order_requests for select to authenticated
using (user_id = (select auth.uid()) or public.has_admin_role(array['owner','admin','fulfilment']));

drop policy "users read own order items" on public.order_items;
drop policy "admins manage order items" on public.order_items;
create policy "customers and fulfilment read order items" on public.order_items for select to authenticated
using (exists (
  select 1 from public.order_requests orders
  where orders.id = order_request_id
    and (orders.user_id = (select auth.uid()) or public.has_admin_role(array['owner','admin','fulfilment']))
));

drop policy "admins manage subscribers" on public.newsletter_subscribers;
drop policy "admins manage contact messages" on public.contact_messages;
drop policy "users read own wholesale enquiries" on public.wholesale_inquiries;
drop policy "admins manage wholesale enquiries" on public.wholesale_inquiries;
drop policy "admins manage editorial content" on public.editorial_content;
drop policy "admins read audit logs" on public.audit_logs;

create policy "management manage subscribers" on public.newsletter_subscribers for all to authenticated
using (public.has_admin_role(array['owner','admin'])) with check (public.has_admin_role(array['owner','admin']));
create policy "management manage contact messages" on public.contact_messages for all to authenticated
using (public.has_admin_role(array['owner','admin'])) with check (public.has_admin_role(array['owner','admin']));
create policy "customers and management read wholesale enquiries" on public.wholesale_inquiries for select to authenticated
using (user_id = (select auth.uid()) or public.has_admin_role(array['owner','admin']));
create policy "management manage wholesale enquiries" on public.wholesale_inquiries for all to authenticated
using (public.has_admin_role(array['owner','admin'])) with check (public.has_admin_role(array['owner','admin']));
create policy "catalog staff manage editorial content" on public.editorial_content for all to authenticated
using (public.has_admin_role(array['owner','admin','editor'])) with check (public.has_admin_role(array['owner','admin','editor']));
create policy "management read audit logs" on public.audit_logs for select to authenticated
using (public.has_admin_role(array['owner','admin']));

drop policy "admins upload product image objects" on storage.objects;
drop policy "admins update product image objects" on storage.objects;
drop policy "admins delete product image objects" on storage.objects;
create policy "catalog staff upload product image objects" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.has_admin_role(array['owner','admin','editor']));
create policy "catalog staff update product image objects" on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.has_admin_role(array['owner','admin','editor']))
with check (bucket_id = 'product-images' and public.has_admin_role(array['owner','admin','editor']));
create policy "catalog staff delete product image objects" on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.has_admin_role(array['owner','admin','editor']));

create or replace function public.update_order_request_status(p_order_id uuid, p_status public.order_request_status)
returns public.order_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.order_requests;
begin
  if not public.has_admin_role(array['owner','admin','fulfilment']) then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;

  select * into current_order from public.order_requests where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_REQUEST_NOT_FOUND'; end if;
  if current_order.status = p_status then return current_order; end if;

  if not (
    case current_order.status
      when 'order_request' then p_status in ('awaiting_confirmation', 'cancelled')
      when 'awaiting_confirmation' then p_status in ('confirmed', 'cancelled')
      when 'confirmed' then p_status in ('processing', 'cancelled')
      when 'processing' then p_status in ('shipped', 'cancelled')
      when 'shipped' then p_status = 'delivered'
      else false
    end
  ) then
    raise exception using errcode = '23514', message = 'INVALID_ORDER_STATUS_TRANSITION';
  end if;

  update public.order_requests
  set status = p_status,
      confirmed_at = case when p_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end
  where id = p_order_id
  returning * into current_order;
  return current_order;
end;
$$;

revoke all on function public.update_order_request_status(uuid, public.order_request_status) from public, anon;
grant execute on function public.update_order_request_status(uuid, public.order_request_status) to authenticated;

create or replace function public.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_row jsonb := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values (
    (select auth.uid()),
    TG_OP,
    TG_TABLE_NAME,
    coalesce(changed_row->>'id', changed_row->>'variant_id', changed_row->>'product_id', changed_row->>'collection_id')
  );
  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

drop trigger if exists audit_products on public.products;
drop trigger if exists audit_orders on public.order_requests;
create trigger audit_brands after insert or update or delete on public.brands for each row execute function public.audit_admin_change();
create trigger audit_categories after insert or update or delete on public.categories for each row execute function public.audit_admin_change();
create trigger audit_collections after insert or update or delete on public.collections for each row execute function public.audit_admin_change();
create trigger audit_products after insert or update or delete on public.products for each row execute function public.audit_admin_change();
create trigger audit_product_images after insert or update or delete on public.product_images for each row execute function public.audit_admin_change();
create trigger audit_product_variants after insert or update or delete on public.product_variants for each row execute function public.audit_admin_change();
create trigger audit_inventory after insert or update or delete on public.inventory for each row execute function public.audit_admin_change();
create trigger audit_collection_products after insert or update or delete on public.collection_products for each row execute function public.audit_admin_change();
create trigger audit_editorial_content after insert or update or delete on public.editorial_content for each row execute function public.audit_admin_change();
create trigger audit_orders after update on public.order_requests for each row execute function public.audit_admin_change();

commit;
