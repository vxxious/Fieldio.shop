begin;

create table public.vendor_notifications (
  id bigint generated always as identity primary key,
  seller_owner_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null unique,
  kind text not null check (kind in ('payment_confirmed', 'case_opened', 'payout_held', 'case_resolved', 'review_published')),
  title text not null,
  body text not null,
  href text not null,
  created_at timestamptz not null default now()
);

create index vendor_notifications_owner_created_idx on public.vendor_notifications(seller_owner_id, created_at desc);
alter table public.vendor_notifications enable row level security;
revoke all on public.vendor_notifications from public, anon, authenticated;
grant select on public.vendor_notifications to authenticated;
create policy "vendors read own notifications" on public.vendor_notifications for select to authenticated
using (seller_owner_id = (select auth.uid()));
create policy "management read vendor notifications" on public.vendor_notifications for select to authenticated
using (public.has_admin_role(array['owner','admin']));

create function public.add_vendor_notification(p_owner uuid, p_key text, p_kind text, p_title text, p_body text, p_href text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null then return; end if;
  insert into public.vendor_notifications(seller_owner_id,event_key,kind,title,body,href)
  values (p_owner,p_key,p_kind,p_title,p_body,p_href)
  on conflict (event_key) do nothing;
end;
$$;
revoke all on function public.add_vendor_notification(uuid,text,text,text,text,text) from public, anon, authenticated;

create function public.notify_vendor_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare fulfillment record;
begin
  if old.payment_status is distinct from 'confirmed' and new.payment_status = 'confirmed' then
    for fulfillment in select id,seller_owner_id from public.order_fulfillments
      where order_request_id = new.id and status = 'confirmed' and seller_owner_id is not null loop
      perform public.add_vendor_notification(fulfillment.seller_owner_id, 'payment-ready:' || fulfillment.id,
        'payment_confirmed', 'Order ready for your response',
        'Payment is confirmed for order ' || new.public_reference || '. Accept or reject your fulfilment.', '/sell#seller-fulfillments');
    end loop;
  end if;
  return new;
end;
$$;
create trigger notify_vendor_payment after update of payment_status on public.order_requests
for each row execute function public.notify_vendor_payment();
revoke all on function public.notify_vendor_payment() from public, anon, authenticated;

create function public.notify_vendor_fulfillment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare order_row record;
begin
  if new.seller_owner_id is null then return new; end if;
  if old.status is distinct from 'confirmed' and new.status = 'confirmed' then
    select public_reference,payment_status into order_row from public.order_requests where id = new.order_request_id;
    if order_row.payment_status = 'confirmed' then
      perform public.add_vendor_notification(new.seller_owner_id, 'payment-ready:' || new.id,
        'payment_confirmed', 'Order ready for your response',
        'Payment is confirmed for order ' || order_row.public_reference || '. Accept or reject your fulfilment.', '/sell#seller-fulfillments');
    end if;
  end if;
  if old.payout_hold_status is distinct from 'held' and new.payout_hold_status = 'held' then
    select public_reference into order_row from public.order_requests where id = new.order_request_id;
    perform public.add_vendor_notification(new.seller_owner_id, 'payout-hold:' || new.id || ':' || clock_timestamp()::text,
      'payout_held', 'Payout on hold',
      'A case has placed the payout for order ' || order_row.public_reference || ' on hold. Fieldio is reviewing it.', '/sell#seller-operations');
  end if;
  return new;
end;
$$;
create trigger notify_vendor_fulfillment after update of status,payout_hold_status on public.order_fulfillments
for each row execute function public.notify_vendor_fulfillment();
revoke all on function public.notify_vendor_fulfillment() from public, anon, authenticated;

create function public.notify_vendor_case()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; order_ref text; case_kind text; fulfillment_id uuid;
begin
  case_kind := case when tg_table_name = 'marketplace_returns' then 'return' else 'dispute' end;
  if case_kind = 'return' then
    select fulfillment.seller_owner_id, fulfillment.id into owner_id, fulfillment_id
    from public.order_items item join public.order_fulfillments fulfillment on fulfillment.id = item.fulfillment_id
    where item.id = new.order_item_id;
  else
    select seller_owner_id,id into owner_id,fulfillment_id from public.order_fulfillments where id = new.fulfillment_id;
  end if;
  if owner_id is null then return new; end if;
  select public_reference into order_ref from public.order_requests where id = new.order_request_id;
  if tg_op = 'INSERT' then
    perform public.add_vendor_notification(owner_id, 'case-opened:' || case_kind || ':' || new.id,
      'case_opened', 'New ' || case_kind || ' case',
      'Fieldio opened a ' || case_kind || ' case for order ' || order_ref || '. View the case in your dashboard.', '/sell#seller-operations');
  elsif old.status is distinct from new.status and (
    (case_kind = 'return' and new.status in ('rejected','refunded','closed')) or
    (case_kind = 'dispute' and new.status in ('resolved','rejected','closed'))
  ) then
    perform public.add_vendor_notification(owner_id, 'case-resolved:' || case_kind || ':' || new.id || ':' || new.status,
      'case_resolved', 'Case updated',
      'Fieldio updated the ' || case_kind || ' case for order ' || order_ref || ' to ' || replace(new.status, '_', ' ') || '.', '/sell#seller-operations');
  end if;
  return new;
end;
$$;
create trigger notify_vendor_return after insert or update of status on public.marketplace_returns
for each row execute function public.notify_vendor_case();
create trigger notify_vendor_dispute after insert or update of status on public.marketplace_disputes
for each row execute function public.notify_vendor_case();
revoke all on function public.notify_vendor_case() from public, anon, authenticated;

create function public.notify_vendor_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; product_name text;
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'published' then return new; end if;
  end if;
  select listing.owner_id, product.name into owner_id, product_name
  from public.products product join public.seller_listings listing on listing.id = product.seller_listing_id
  where product.id = new.product_id;
  perform public.add_vendor_notification(owner_id, 'review-published:' || new.id,
    'review_published', 'New customer review',
    'A verified review of ' || product_name || ' is now published.', '/sell#seller-reviews');
  return new;
end;
$$;
create trigger notify_vendor_review after insert or update of status on public.product_reviews
for each row execute function public.notify_vendor_review();
revoke all on function public.notify_vendor_review() from public, anon, authenticated;

commit;
