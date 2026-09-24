begin;

drop function if exists public.seller_order_fulfillments();
drop function if exists public.update_vendor_fulfillment_status(uuid, public.fulfillment_status);

create or replace function public.update_order_request_status(p_order_id uuid, p_status public.order_request_status)
returns public.order_requests
language plpgsql
security definer
set search_path = ''
as $$
declare current_order public.order_requests;
begin
  if not public.has_admin_role(array['owner','admin','fulfilment']) then raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED'; end if;
  select * into current_order from public.order_requests where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_REQUEST_NOT_FOUND'; end if;
  if current_order.status = p_status then return current_order; end if;
  if not (case current_order.status when 'order_request' then p_status in ('awaiting_confirmation','cancelled') when 'awaiting_confirmation' then p_status in ('confirmed','cancelled') when 'confirmed' then p_status in ('processing','cancelled') when 'processing' then p_status in ('shipped','cancelled') when 'shipped' then p_status = 'delivered' else false end) then raise exception using errcode = '23514', message = 'INVALID_ORDER_STATUS_TRANSITION'; end if;
  update public.order_requests set status = p_status, confirmed_at = case when p_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end where id = p_order_id returning * into current_order;
  return current_order;
end;
$$;

revoke all on function public.update_order_request_status(uuid, public.order_request_status) from public, anon;
grant execute on function public.update_order_request_status(uuid, public.order_request_status) to authenticated;

create or replace function public.create_order_request(p_customer jsonb, p_items jsonb, p_user_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.order_requests;
  v_item jsonb;
  v_product public.products;
  v_variant public.product_variants;
  v_inventory public.inventory;
  v_price integer;
  v_quantity integer;
  v_subtotal integer := 0;
  v_unpriced boolean := false;
  v_currency text;
  v_result jsonb := '[]'::jsonb;
  v_brand text;
begin
  if jsonb_array_length(p_items) not between 1 and 25 then raise exception 'INVALID_ITEMS'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  select * into v_order from public.order_requests where request_key = p_request_key;
  if found then
    if v_order.customer_email <> p_customer->>'email' or v_order.user_id is distinct from p_user_id then raise exception 'INVALID_RETRY'; end if;
    select jsonb_agg(jsonb_build_object('key', items.id, 'productId', items.product_id, 'variantId', items.product_variant_id, 'productName', items.product_name, 'brand', items.brand_name, 'sku', items.sku, 'selectedVariant', items.variant_name, 'selectedSize', items.size, 'quantity', items.quantity, 'unitPrice', items.unit_price, 'currency', items.currency, 'image', ''))
      into v_result from public.order_items items where items.order_request_id = v_order.id;
    return jsonb_build_object('reference', v_order.public_reference, 'items', v_result);
  end if;
  if (select count(*) <> count(distinct item->>'variantId') from jsonb_array_elements(p_items) item) then raise exception 'DUPLICATE_VARIANT'; end if;
  insert into public.order_requests(user_id, customer_name, customer_phone, customer_email, shipping_address, customer_note, request_key, status)
  values(p_user_id, p_customer->>'name', p_customer->>'phone', p_customer->>'email', p_customer->>'shippingAddress', p_customer->>'note', p_request_key, 'order_request') returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity not between 1 and 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and status = 'active' and published_at <= now() for share;
    if not found then raise exception 'UNAVAILABLE_ITEM'; end if;
    select * into v_variant from public.product_variants where id = (v_item->>'variantId')::uuid and product_id = v_product.id and is_active for share;
    if not found then raise exception 'UNAVAILABLE_ITEM'; end if;
    select * into v_inventory from public.inventory where variant_id = v_variant.id for share;
    if not v_product.inquiry_only and (not found or (not v_inventory.allow_backorder and v_inventory.quantity - v_inventory.reserved_quantity < v_quantity)) then raise exception 'INSUFFICIENT_STOCK'; end if;
    if v_currency is not null and v_currency <> v_product.currency then raise exception 'MIXED_CURRENCY'; end if;
    v_currency := v_product.currency;
    v_price := coalesce(v_variant.price_override, v_product.price);
    v_unpriced := v_unpriced or v_price is null;
    v_subtotal := v_subtotal + coalesce(v_price, 0) * v_quantity;
    select name into v_brand from public.brands where id = v_product.brand_id;
    insert into public.order_items(order_request_id, product_id, product_variant_id, product_name, brand_name, sku, variant_name, size, color, quantity, unit_price, line_total, currency)
    values(v_order.id, v_product.id, v_variant.id, v_product.name, coalesce(v_brand, 'Fieldio'), v_variant.sku, v_variant.name, v_variant.size, v_variant.color, v_quantity, v_price, v_price * v_quantity, v_currency);
    v_result := v_result || jsonb_build_array(jsonb_build_object('key', v_variant.id, 'productId', v_product.id, 'variantId', v_variant.id, 'productName', v_product.name, 'brand', coalesce(v_brand, 'Fieldio'), 'sku', v_variant.sku, 'selectedVariant', v_variant.name, 'selectedSize', v_variant.size, 'quantity', v_quantity, 'unitPrice', v_price, 'currency', v_currency, 'image', ''));
  end loop;
  update public.order_requests set currency = v_currency, subtotal = case when v_unpriced then null else v_subtotal end, total = null where id = v_order.id;
  return jsonb_build_object('reference', v_order.public_reference, 'items', v_result);
end;
$$;

revoke all on function public.create_order_request(jsonb,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_order_request(jsonb,jsonb,uuid,uuid) to service_role;

drop policy "approved sellers read own fulfillment items" on public.order_items;
alter table public.order_items drop column fulfillment_id;
drop table public.order_fulfillments;
drop type public.fulfillment_status;

commit;
