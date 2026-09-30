begin;

-- RLS filters these reads; explicit grants make a clean Supabase install usable.
grant select on public.order_requests, public.order_items to authenticated;
grant select on public.products, public.product_variants, public.inventory to anon, authenticated;

alter table public.order_requests
  add column payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed')),
  add column payment_amount bigint check (payment_amount is null or payment_amount > 0),
  add column payment_method text check (payment_method is null or payment_method in ('bank_transfer', 'card', 'crypto', 'cash', 'other')),
  add column payment_reference text check (payment_reference is null or char_length(btrim(payment_reference)) between 2 and 160),
  add column payment_confirmed_at timestamptz,
  add constraint order_payment_confirmation_complete check (
    (payment_status = 'pending' and payment_amount is null and payment_method is null and payment_reference is null and payment_confirmed_at is null)
    or
    (payment_status = 'confirmed' and payment_amount is not null and payment_method is not null and payment_reference is not null and payment_confirmed_at is not null)
  );

create index order_requests_pending_payment_idx
on public.order_requests(status, created_at desc)
where payment_status = 'pending' and status in ('confirmed', 'processing', 'shipped', 'delivered');

create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_amount bigint,
  p_shipping_total bigint,
  p_method text,
  p_reference text
)
returns public.order_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.order_requests;
begin
  if not public.has_admin_role(array['owner','admin']) then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;
  if p_amount <= 0 or p_amount > 2147483647 then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_AMOUNT';
  end if;
  if p_shipping_total < 0 or p_shipping_total > p_amount or p_shipping_total > 2147483647 then
    raise exception using errcode = '22023', message = 'INVALID_SHIPPING_AMOUNT';
  end if;
  if p_method not in ('bank_transfer', 'card', 'crypto', 'cash', 'other') then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_METHOD';
  end if;
  if char_length(btrim(coalesce(p_reference, ''))) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'PAYMENT_REFERENCE_REQUIRED';
  end if;

  select * into current_order
  from public.order_requests
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_REQUEST_NOT_FOUND';
  end if;
  if current_order.status not in ('confirmed', 'processing', 'shipped', 'delivered') then
    raise exception using errcode = '23514', message = 'ORDER_NOT_CONFIRMED';
  end if;
  if current_order.payment_status = 'confirmed' then
    if current_order.payment_amount = p_amount
      and current_order.shipping_total = p_shipping_total
      and current_order.payment_method = p_method
      and current_order.payment_reference = btrim(p_reference)
    then
      return current_order;
    end if;
    raise exception using errcode = '23514', message = 'PAYMENT_ALREADY_CONFIRMED';
  end if;

  update public.order_requests
  set payment_status = 'confirmed',
      payment_amount = p_amount,
      payment_method = p_method,
      payment_reference = btrim(p_reference),
      payment_confirmed_at = now(),
      shipping_total = p_shipping_total,
      total = p_amount
  where id = p_order_id
  returning * into current_order;

  update public.order_fulfillments
  set payout_status = 'eligible'
  where order_request_id = p_order_id
    and status = 'delivered'
    and seller_owner_id is not null
    and payout_status = 'pending';

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'PAYMENT_CONFIRMED',
    'order_requests',
    p_order_id::text,
    jsonb_build_object('amount', p_amount, 'currency', current_order.currency, 'method', p_method, 'reference', btrim(p_reference))
  );

  return current_order;
end;
$$;

revoke all on function public.confirm_order_payment(uuid, bigint, bigint, text, text) from public, anon;
grant execute on function public.confirm_order_payment(uuid, bigint, bigint, text, text) to authenticated;

create or replace function public.require_confirmed_payment_for_fulfillment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('processing', 'shipped', 'delivered')
    and old.status is distinct from new.status
    and new.payment_status <> 'confirmed'
  then
    raise exception using errcode = '23514', message = 'PAYMENT_NOT_CONFIRMED';
  end if;
  return new;
end;
$$;

create trigger require_confirmed_payment_for_fulfillment
before update of status on public.order_requests
for each row execute function public.require_confirmed_payment_for_fulfillment();

create or replace function public.mark_fulfillment_payout_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' and new.seller_owner_id is not null then
    new.payout_status = case
      when exists (
        select 1 from public.order_requests orders
        where orders.id = new.order_request_id and orders.payment_status = 'confirmed'
      ) then 'eligible'
      else 'pending'
    end;
  end if;
  if new.status = 'cancelled' then new.payout_status = 'held'; end if;
  return new;
end;
$$;

update public.order_fulfillments fulfillments
set payout_status = 'pending'
from public.order_requests orders
where orders.id = fulfillments.order_request_id
  and orders.payment_status <> 'confirmed'
  and fulfillments.payout_status = 'eligible';

create or replace function public.require_confirmed_payment_for_payout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_TABLE_NAME = 'seller_payout_items' then
    if exists (
      select 1
      from public.order_fulfillments fulfillments
      join public.order_requests orders on orders.id = fulfillments.order_request_id
      where fulfillments.id = new.fulfillment_id and orders.payment_status <> 'confirmed'
    ) then
      raise exception using errcode = '23514', message = 'ORDER_PAYMENT_NOT_CONFIRMED';
    end if;
  elsif new.status in ('approved', 'paid') and old.status is distinct from new.status then
    if exists (
      select 1
      from public.seller_payout_items items
      join public.order_fulfillments fulfillments on fulfillments.id = items.fulfillment_id
      join public.order_requests orders on orders.id = fulfillments.order_request_id
      where items.payout_id = new.id and orders.payment_status <> 'confirmed'
    ) then
      raise exception using errcode = '23514', message = 'ORDER_PAYMENT_NOT_CONFIRMED';
    end if;
  end if;
  return new;
end;
$$;

create trigger require_payment_before_payout_item
before insert on public.seller_payout_items
for each row execute function public.require_confirmed_payment_for_payout();

create trigger require_payment_before_payout_status
before update of status on public.seller_payouts
for each row execute function public.require_confirmed_payment_for_payout();

revoke insert, update, delete on public.seller_payouts, public.seller_payout_items from authenticated;
grant select on public.seller_payouts, public.seller_payout_items to authenticated;

commit;
