begin;

create table public.order_events (
  id bigint generated always as identity primary key,
  order_request_id uuid not null references public.order_requests(id) on delete restrict,
  fulfillment_id uuid references public.order_fulfillments(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'order_created', 'confirmation_started', 'order_confirmed', 'payment_confirmed',
    'fulfillment_status_changed', 'order_cancelled'
  )),
  store_name text,
  from_status text,
  to_status text,
  carrier text,
  tracking_reference text,
  note text,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events(order_request_id, created_at, id);
create index order_events_fulfillment_idx on public.order_events(fulfillment_id, created_at, id) where fulfillment_id is not null;

alter table public.order_events enable row level security;
revoke all on public.order_events from public, anon, authenticated;
grant select on public.order_events to authenticated;

create policy "operations read order events" on public.order_events for select to authenticated
using (public.has_admin_role(array['owner','admin','fulfilment']));

create policy "approved sellers read own order events" on public.order_events for select to authenticated
using (
  exists (
    select 1
    from public.order_fulfillments fulfillment
    join public.seller_applications application on application.owner_id = fulfillment.seller_owner_id and application.status = 'approved'
    join public.seller_stores store on store.id = fulfillment.seller_store_id and store.owner_id = fulfillment.seller_owner_id and store.status = 'active'
    where fulfillment.id = fulfillment_id and fulfillment.seller_owner_id = (select auth.uid())
  )
);

create function public.prevent_order_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if TG_OP = 'UPDATE'
    and old.actor_id is not null
    and new.actor_id is null
    and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id')
  then
    return new;
  end if;
  raise exception using errcode = '55000', message = 'ORDER_EVENTS_ARE_IMMUTABLE';
end;
$$;

create trigger prevent_order_event_mutation
before update or delete on public.order_events
for each row execute function public.prevent_order_event_mutation();

create function public.record_order_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.order_events(order_request_id, actor_id, event_type, to_status, created_at)
    values (new.id, (select auth.uid()), 'order_created', new.status::text, new.created_at);
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'awaiting_confirmation' then
    insert into public.order_events(order_request_id, actor_id, event_type, from_status, to_status)
    values (new.id, (select auth.uid()), 'confirmation_started', old.status::text, new.status::text);
  end if;
  if old.confirmed_at is null and new.confirmed_at is not null then
    insert into public.order_events(order_request_id, actor_id, event_type, from_status, to_status, created_at)
    values (new.id, (select auth.uid()), 'order_confirmed', old.status::text, 'confirmed', new.confirmed_at);
  end if;
  if old.payment_status is distinct from new.payment_status and new.payment_status = 'confirmed' then
    insert into public.order_events(order_request_id, actor_id, event_type, from_status, to_status, created_at)
    values (new.id, (select auth.uid()), 'payment_confirmed', old.payment_status, new.payment_status, new.payment_confirmed_at);
  end if;
  if old.status is distinct from new.status and new.status = 'cancelled' then
    insert into public.order_events(order_request_id, actor_id, event_type, from_status, to_status)
    values (new.id, (select auth.uid()), 'order_cancelled', old.status::text, new.status::text);
  end if;
  return new;
end;
$$;

create function public.record_order_fulfillment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status then return new; end if;
  insert into public.order_events(
    order_request_id, fulfillment_id, actor_id, event_type, store_name, from_status, to_status,
    carrier, tracking_reference, note
  ) values (
    new.order_request_id, new.id, (select auth.uid()), 'fulfillment_status_changed', new.store_name,
    old.status::text, new.status::text, new.carrier, new.tracking_reference,
    case when new.status = 'rejected' then new.rejection_reason else null end
  );
  return new;
end;
$$;

revoke all on function public.prevent_order_event_mutation(), public.record_order_request_event(), public.record_order_fulfillment_event() from public, anon, authenticated;

create trigger record_order_request_event
after insert or update of status, confirmed_at, payment_status on public.order_requests
for each row execute function public.record_order_request_event();

create trigger record_order_fulfillment_event
after update of status on public.order_fulfillments
for each row execute function public.record_order_fulfillment_event();

insert into public.order_events(order_request_id, event_type, to_status, created_at)
select id, 'order_created', 'order_request', created_at from public.order_requests;

insert into public.order_events(order_request_id, event_type, from_status, to_status, created_at)
select id, 'order_confirmed', 'awaiting_confirmation', 'confirmed', confirmed_at
from public.order_requests where confirmed_at is not null;

insert into public.order_events(order_request_id, event_type, from_status, to_status, created_at)
select id, 'payment_confirmed', 'pending', 'confirmed', payment_confirmed_at
from public.order_requests where payment_confirmed_at is not null;

insert into public.order_events(order_request_id, fulfillment_id, event_type, store_name, from_status, to_status, carrier, tracking_reference, note, created_at)
select order_request_id, id, 'fulfillment_status_changed', store_name, 'confirmed', 'accepted', null, null, null, accepted_at
from public.order_fulfillments where accepted_at is not null;

insert into public.order_events(order_request_id, fulfillment_id, event_type, store_name, from_status, to_status, carrier, tracking_reference, note, created_at)
select order_request_id, id, 'fulfillment_status_changed', store_name, 'accepted', 'processing', null, null, null, preparing_at
from public.order_fulfillments where preparing_at is not null;

insert into public.order_events(order_request_id, fulfillment_id, event_type, store_name, from_status, to_status, carrier, tracking_reference, note, created_at)
select order_request_id, id, 'fulfillment_status_changed', store_name, 'processing', 'shipped', carrier, tracking_reference, null, shipped_at
from public.order_fulfillments where shipped_at is not null;

insert into public.order_events(order_request_id, fulfillment_id, event_type, store_name, from_status, to_status, carrier, tracking_reference, note, created_at)
select order_request_id, id, 'fulfillment_status_changed', store_name, 'shipped', 'delivered', carrier, tracking_reference, null, delivered_at
from public.order_fulfillments where delivered_at is not null;

insert into public.order_events(order_request_id, fulfillment_id, event_type, store_name, from_status, to_status, carrier, tracking_reference, note, created_at)
select order_request_id, id, 'fulfillment_status_changed', store_name, 'confirmed', 'rejected', null, null, rejection_reason, rejected_at
from public.order_fulfillments where rejected_at is not null;

drop function public.buyer_order_fulfillments();

create function public.buyer_order_fulfillments()
returns table (
  order_request_id uuid,
  store_name text,
  status public.fulfillment_status,
  carrier text,
  tracking_reference text,
  accepted_at timestamptz,
  preparing_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  rejected_at timestamptz,
  updated_at timestamptz,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    groups.order_request_id,
    groups.store_name,
    groups.status,
    groups.carrier,
    groups.tracking_reference,
    groups.accepted_at,
    groups.preparing_at,
    groups.shipped_at,
    groups.delivered_at,
    groups.rejected_at,
    groups.updated_at,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', order_items.id,
      'productName', order_items.product_name,
      'quantity', order_items.quantity
    ) order by order_items.product_name, order_items.id) filter (where order_items.id is not null), '[]'::jsonb)
  from public.order_fulfillments groups
  join public.order_requests requests on requests.id = groups.order_request_id
  left join public.order_items on order_items.fulfillment_id = groups.id
  where requests.user_id = (select auth.uid())
  group by groups.id;
$$;

revoke all on function public.buyer_order_fulfillments() from public, anon;
grant execute on function public.buyer_order_fulfillments() to authenticated;

create function public.buyer_order_timeline()
returns table (
  id bigint,
  order_request_id uuid,
  fulfillment_id uuid,
  event_type text,
  store_name text,
  from_status text,
  to_status text,
  carrier text,
  tracking_reference text,
  occurred_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id, event.order_request_id, event.fulfillment_id, event.event_type, event.store_name,
    event.from_status, event.to_status, event.carrier, event.tracking_reference, event.created_at
  from public.order_events event
  join public.order_requests request on request.id = event.order_request_id
  where request.user_id = (select auth.uid())
  order by event.created_at, event.id;
$$;

revoke all on function public.buyer_order_timeline() from public, anon;
grant execute on function public.buyer_order_timeline() to authenticated;

commit;
