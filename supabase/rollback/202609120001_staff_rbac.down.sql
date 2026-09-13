begin;

drop trigger if exists audit_brands on public.brands;
drop trigger if exists audit_categories on public.categories;
drop trigger if exists audit_collections on public.collections;
drop trigger if exists audit_products on public.products;
drop trigger if exists audit_product_images on public.product_images;
drop trigger if exists audit_product_variants on public.product_variants;
drop trigger if exists audit_inventory on public.inventory;
drop trigger if exists audit_collection_products on public.collection_products;
drop trigger if exists audit_editorial_content on public.editorial_content;
drop trigger if exists audit_orders on public.order_requests;

create or replace function public.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values(auth.uid(), TG_OP, TG_TABLE_NAME, coalesce(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id'));
  return coalesce(NEW, OLD);
end;
$$;
create trigger audit_products after insert or update on public.products for each row execute function public.audit_admin_change();
create trigger audit_orders after update on public.order_requests for each row execute function public.audit_admin_change();

drop function if exists public.update_order_request_status(uuid, public.order_request_status);

alter function public.handle_new_user() set search_path = public;
alter function public.create_order_request(jsonb, jsonb, uuid, uuid) set search_path = public;
alter function public.consume_rate_limit(text, integer, integer) set search_path = public;

drop policy "profiles self or management select" on public.profiles;
create policy "profiles self select" on public.profiles for select using (auth.uid() = id or public.is_admin());

drop policy "staff view own role" on public.admin_users;
create policy "admins view admins" on public.admin_users for select to authenticated using (public.is_admin());

drop policy "catalog staff manage brands" on public.brands;
drop policy "catalog staff manage categories" on public.categories;
drop policy "catalog staff manage collections" on public.collections;
drop policy "catalog staff manage products" on public.products;
drop policy "catalog staff manage images" on public.product_images;
drop policy "catalog staff manage variants" on public.product_variants;
drop policy "operations staff manage inventory" on public.inventory;
drop policy "catalog staff manage collection products" on public.collection_products;
create policy "admins manage catalog" on public.brands for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage collections" on public.collections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage images" on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage variants" on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage inventory" on public.inventory for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage collection products" on public.collection_products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "customers and fulfilment read order requests" on public.order_requests;
drop policy "customers and fulfilment read order items" on public.order_items;
create policy "users read own order requests" on public.order_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins manage order requests" on public.order_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read own order items" on public.order_items for select to authenticated using (exists (select 1 from public.order_requests o where o.id = order_request_id and (o.user_id = auth.uid() or public.is_admin())));
create policy "admins manage order items" on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "management manage subscribers" on public.newsletter_subscribers;
drop policy "management manage contact messages" on public.contact_messages;
drop policy "customers and management read wholesale enquiries" on public.wholesale_inquiries;
drop policy "management manage wholesale enquiries" on public.wholesale_inquiries;
drop policy "catalog staff manage editorial content" on public.editorial_content;
drop policy "management read audit logs" on public.audit_logs;
create policy "admins manage subscribers" on public.newsletter_subscribers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage contact messages" on public.contact_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read own wholesale enquiries" on public.wholesale_inquiries for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins manage wholesale enquiries" on public.wholesale_inquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage editorial content" on public.editorial_content for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read audit logs" on public.audit_logs for select to authenticated using (public.is_admin());

drop policy "catalog staff upload product image objects" on storage.objects;
drop policy "catalog staff update product image objects" on storage.objects;
drop policy "catalog staff delete product image objects" on storage.objects;
create policy "admins upload product image objects" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "admins update product image objects" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy "admins delete product image objects" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $$;
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'owner'); $$;

drop function if exists public.has_admin_role(text[]);
drop function if exists public.current_admin_role();

commit;
