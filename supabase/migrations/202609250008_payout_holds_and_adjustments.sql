begin;

alter table public.order_fulfillments
  drop constraint if exists order_fulfillments_payout_status_check;

alter table public.order_fulfillments
  add constraint order_fulfillments_payout_status_check
    check (payout_status in ('pending', 'eligible', 'held', 'paid', 'adjusted')),
  add column payout_hold_status text not null default 'clear'
    check (payout_hold_status in ('clear', 'held')),
  add column payout_adjustment_amount bigint not null default 0
    check (payout_adjustment_amount >= 0),
  add column payout_held_at timestamptz,
  add column payout_released_at timestamptz;

alter table public.seller_payouts
  drop constraint if exists seller_payouts_status_check;

alter table public.seller_payouts
  add constraint seller_payouts_status_check
    check (status in ('pending', 'held', 'approved', 'paid', 'failed', 'cancelled'));

alter table public.seller_payout_items
  drop constraint if exists seller_payout_items_fulfillment_id_key;

alter table public.seller_payout_items
  add column status text not null default 'included'
    check (status in ('included', 'held', 'paid', 'released', 'adjusted'));

update public.seller_payout_items items
set status = case payouts.status
  when 'paid' then 'paid'
  when 'failed' then 'released'
  when 'cancelled' then 'released'
  else 'included'
end
from public.seller_payouts payouts
where payouts.id = items.payout_id;

create unique index seller_payout_items_active_fulfillment_idx
on public.seller_payout_items(fulfillment_id)
where status in ('included', 'held', 'paid');

alter table public.marketplace_returns
  add column payout_resolution text
    check (payout_resolution is null or payout_resolution in ('release', 'refund', 'keep_held')),
  add column payout_hold_amount bigint not null default 0 check (payout_hold_amount >= 0);

alter table public.marketplace_disputes
  add column order_item_id uuid references public.order_items(id) on delete restrict,
  add column payout_resolution text
    check (payout_resolution is null or payout_resolution in ('release', 'refund', 'keep_held')),
  add column payout_hold_amount bigint not null default 0 check (payout_hold_amount >= 0);

update public.marketplace_disputes disputes
set order_item_id = single_item.id
from (
  select fulfillment_id, min(id::text)::uuid as id
  from public.order_items
  group by fulfillment_id
  having count(*) = 1
) single_item
where single_item.fulfillment_id = disputes.fulfillment_id
  and disputes.order_item_id is null;

create table public.payout_adjustments (
  id bigint generated always as identity primary key,
  payout_id uuid references public.seller_payouts(id) on delete restrict,
  fulfillment_id uuid not null references public.order_fulfillments(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  case_type text not null check (case_type in ('return', 'dispute')),
  case_id uuid not null,
  kind text not null check (kind in ('recovery_pending', 'refund', 'release')),
  amount bigint not null check (amount >= 0),
  currency char(3) not null,
  reason text not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (case_type, case_id, kind)
);

create index payout_adjustments_fulfillment_idx
on public.payout_adjustments(fulfillment_id, created_at desc);

alter table public.payout_adjustments enable row level security;
revoke all on public.payout_adjustments from public, anon, authenticated;
grant select on public.payout_adjustments to authenticated;

create policy "finance staff read payout adjustments" on public.payout_adjustments for select to authenticated
using (public.has_admin_role(array['owner','admin']));

create policy "sellers read own payout adjustments" on public.payout_adjustments for select to authenticated using (
  exists (
    select 1 from public.order_fulfillments fulfillment
    where fulfillment.id = fulfillment_id
      and fulfillment.seller_owner_id = (select auth.uid())
  )
);

create function public.prevent_payout_adjustment_mutation()
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
  raise exception using errcode = '55000', message = 'PAYOUT_ADJUSTMENTS_ARE_IMMUTABLE';
end;
$$;

create trigger prevent_payout_adjustment_mutation
before update or delete on public.payout_adjustments
for each row execute function public.prevent_payout_adjustment_mutation();

alter table public.order_events
  drop constraint if exists order_events_event_type_check;

alter table public.order_events
  add constraint order_events_event_type_check check (event_type in (
    'order_created', 'confirmation_started', 'order_confirmed', 'payment_confirmed',
    'fulfillment_status_changed', 'order_cancelled', 'payout_hold', 'payout_release',
    'payout_adjustment', 'refund_recorded'
  ));

create function public.case_payout_amount(p_order_item_id uuid, p_quantity integer default null)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce(item.line_total, 0)::numeric
    * least(coalesce(p_quantity, item.quantity), item.quantity)::numeric / item.quantity
    * (10000 - fulfillment.commission_rate_bps)::numeric / 10000
  )::bigint
  from public.order_items item
  join public.order_fulfillments fulfillment on fulfillment.id = item.fulfillment_id
  where item.id = p_order_item_id;
$$;

create function public.refresh_open_payout_total(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining bigint;
  current_status text;
begin
  select status into current_status from public.seller_payouts where id = p_payout_id for update;
  if not found or current_status in ('paid', 'failed', 'cancelled') then return; end if;

  select coalesce(sum(amount), 0) into remaining
  from public.seller_payout_items
  where payout_id = p_payout_id and status = 'included';

  update public.seller_payouts
  set amount = case when remaining > 0 then remaining else amount end,
      status = case when remaining > 0 then 'pending' else 'held' end,
      approved_by = null
  where id = p_payout_id;
end;
$$;

create function public.fulfillment_has_other_payout_hold(
  p_fulfillment_id uuid,
  p_case_type text,
  p_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketplace_returns return_case
    join public.order_items item on item.id = return_case.order_item_id
    where item.fulfillment_id = p_fulfillment_id
      and not (p_case_type = 'return' and return_case.id = p_case_id)
      and (
        return_case.status in ('requested', 'approved', 'in_transit', 'received')
        or return_case.payout_resolution = 'keep_held'
      )
    union all
    select 1
    from public.marketplace_disputes dispute
    where dispute.fulfillment_id = p_fulfillment_id
      and not (p_case_type = 'dispute' and dispute.id = p_case_id)
      and (
        dispute.status in ('open', 'reviewing')
        or dispute.payout_resolution = 'keep_held'
      )
  );
$$;

create function public.apply_payout_case_hold(
  p_fulfillment_id uuid,
  p_order_item_id uuid,
  p_case_type text,
  p_case_id uuid,
  p_amount bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fulfillment public.order_fulfillments;
  payout_item public.seller_payout_items;
  payout public.seller_payouts;
  order_currency text;
begin
  select * into fulfillment
  from public.order_fulfillments
  where id = p_fulfillment_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'FULFILLMENT_NOT_FOUND'; end if;

  select currency into order_currency
  from public.order_requests
  where id = fulfillment.order_request_id;

  update public.order_fulfillments
  set payout_hold_status = 'held',
      payout_held_at = coalesce(payout_held_at, now()),
      payout_released_at = null,
      payout_status = case when payout_status = 'paid' then 'paid' else 'held' end
  where id = fulfillment.id;

  select * into payout_item
  from public.seller_payout_items
  where fulfillment_id = fulfillment.id
    and status in ('included', 'held', 'paid')
  order by payout_id desc
  limit 1
  for update;

  if found then
    select * into payout from public.seller_payouts where id = payout_item.payout_id for update;
    if payout_item.status = 'included' and payout.status in ('pending', 'approved', 'held') then
      update public.seller_payout_items
      set status = 'held'
      where payout_id = payout_item.payout_id and fulfillment_id = fulfillment.id;
      perform public.refresh_open_payout_total(payout_item.payout_id);
    elsif payout_item.status = 'paid' then
      insert into public.payout_adjustments(
        payout_id, fulfillment_id, order_item_id, case_type, case_id, kind,
        amount, currency, reason, actor_id
      ) values (
        payout.id, fulfillment.id, p_order_item_id, p_case_type, p_case_id,
        'recovery_pending', p_amount, order_currency, p_reason, (select auth.uid())
      ) on conflict (case_type, case_id, kind) do nothing;

      insert into public.order_events(
        order_request_id, fulfillment_id, actor_id, event_type, store_name,
        from_status, to_status, note
      ) values (
        fulfillment.order_request_id, fulfillment.id, (select auth.uid()),
        'payout_adjustment', fulfillment.store_name, 'paid', 'recovery_pending', p_reason
      );

      insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
      values (
        (select auth.uid()), 'PAYOUT_ADJUSTMENT', p_case_type, p_case_id::text,
        jsonb_build_object('fulfillment_id', fulfillment.id, 'order_item_id', p_order_item_id, 'amount', p_amount, 'payout_id', payout.id)
      );
    end if;
  end if;

  insert into public.order_events(
    order_request_id, fulfillment_id, actor_id, event_type, store_name,
    from_status, to_status, note
  ) values (
    fulfillment.order_request_id, fulfillment.id, (select auth.uid()),
    'payout_hold', fulfillment.store_name, 'clear', 'held', p_reason
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()), 'PAYOUT_HOLD', p_case_type, p_case_id::text,
    jsonb_build_object('fulfillment_id', fulfillment.id, 'order_item_id', p_order_item_id, 'amount', p_amount)
  );
end;
$$;

create function public.resolve_payout_case_hold(
  p_fulfillment_id uuid,
  p_order_item_id uuid,
  p_case_type text,
  p_case_id uuid,
  p_decision text,
  p_amount bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fulfillment public.order_fulfillments;
  payout_item public.seller_payout_items;
  payout public.seller_payouts;
  other_hold boolean;
  previous_adjustment bigint;
  effective_amount bigint;
  remaining bigint;
  order_currency text;
begin
  select * into fulfillment
  from public.order_fulfillments
  where id = p_fulfillment_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'FULFILLMENT_NOT_FOUND'; end if;

  select currency into order_currency from public.order_requests where id = fulfillment.order_request_id;
  other_hold := public.fulfillment_has_other_payout_hold(fulfillment.id, p_case_type, p_case_id);

  if p_decision = 'keep_held' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'PAYOUT_HOLD_RETAINED', p_case_type, p_case_id::text, jsonb_build_object('fulfillment_id', fulfillment.id));
    return;
  end if;

  select * into payout_item
  from public.seller_payout_items
  where fulfillment_id = fulfillment.id
    and status in ('included', 'held', 'paid')
  order by payout_id desc
  limit 1
  for update;

  if found then
    select * into payout from public.seller_payouts where id = payout_item.payout_id for update;
  end if;

  if p_decision = 'refund' then
    previous_adjustment := fulfillment.payout_adjustment_amount;
    update public.order_fulfillments
    set payout_adjustment_amount = least(vendor_net_amount, payout_adjustment_amount + p_amount)
    where id = fulfillment.id
    returning greatest(vendor_net_amount - payout_adjustment_amount, 0),
      payout_adjustment_amount - previous_adjustment
    into remaining, effective_amount;

    insert into public.payout_adjustments(
      payout_id, fulfillment_id, order_item_id, case_type, case_id, kind,
      amount, currency, reason, actor_id
    ) values (
      payout_item.payout_id, fulfillment.id, p_order_item_id, p_case_type, p_case_id,
      'refund', effective_amount, order_currency, p_reason, (select auth.uid())
    ) on conflict (case_type, case_id, kind) do nothing;

    if payout_item.status = 'held' then
      update public.seller_payout_items
      set amount = case when remaining > 0 then remaining else amount end,
          status = case when payout.status in ('paid', 'failed', 'cancelled') and remaining > 0 then 'released'
                        when payout.status in ('paid', 'failed', 'cancelled') then 'adjusted'
                        when remaining > 0 and not other_hold then 'included'
                        when remaining > 0 then 'held'
                        else 'adjusted' end
      where payout_id = payout_item.payout_id and fulfillment_id = fulfillment.id;
      perform public.refresh_open_payout_total(payout_item.payout_id);
    end if;

    update public.order_fulfillments
    set payout_hold_status = case when other_hold then 'held' else 'clear' end,
        payout_released_at = case when other_hold then payout_released_at else now() end,
        payout_status = case
          when payout_status = 'paid' then 'paid'
          when remaining = 0 then 'adjusted'
          when other_hold then 'held'
          when payout_item.status = 'held' and payout.status not in ('paid', 'failed', 'cancelled') then 'held'
          else 'eligible'
        end
    where id = fulfillment.id;

    insert into public.order_events(
      order_request_id, fulfillment_id, actor_id, event_type, store_name,
      from_status, to_status, note
    ) values (
      fulfillment.order_request_id, fulfillment.id, (select auth.uid()),
      'refund_recorded', fulfillment.store_name, 'held', 'adjusted', p_reason
    );
  elsif p_decision = 'release' then
    insert into public.payout_adjustments(
      payout_id, fulfillment_id, order_item_id, case_type, case_id, kind,
      amount, currency, reason, actor_id
    ) values (
      payout_item.payout_id, fulfillment.id, p_order_item_id, p_case_type, p_case_id,
      'release', p_amount, order_currency, p_reason, (select auth.uid())
    ) on conflict (case_type, case_id, kind) do nothing;

    if not other_hold then
      remaining := greatest(fulfillment.vendor_net_amount - fulfillment.payout_adjustment_amount, 0);
      if payout_item.status = 'held' then
        if payout.status in ('pending', 'held') and remaining > 0 then
          update public.seller_payout_items
          set amount = remaining, status = 'included'
          where payout_id = payout_item.payout_id and fulfillment_id = fulfillment.id;
          perform public.refresh_open_payout_total(payout_item.payout_id);
        else
          update public.seller_payout_items
          set status = 'released'
          where payout_id = payout_item.payout_id and fulfillment_id = fulfillment.id;
        end if;
      end if;

      update public.order_fulfillments
      set payout_hold_status = 'clear',
          payout_released_at = now(),
          payout_status = case
            when payout_status = 'paid' then 'paid'
            when remaining = 0 then 'adjusted'
            when payout_item.status = 'held' and payout.status in ('pending', 'held') then 'held'
            else 'eligible'
          end
      where id = fulfillment.id;
    end if;

    insert into public.order_events(
      order_request_id, fulfillment_id, actor_id, event_type, store_name,
      from_status, to_status, note
    ) values (
      fulfillment.order_request_id, fulfillment.id, (select auth.uid()),
      'payout_release', fulfillment.store_name, 'held',
      case when other_hold then 'held' else 'clear' end, p_reason
    );
  else
    raise exception using errcode = '22023', message = 'INVALID_PAYOUT_DECISION';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()), upper('PAYOUT_' || p_decision), p_case_type, p_case_id::text,
    jsonb_build_object(
      'fulfillment_id', fulfillment.id,
      'order_item_id', p_order_item_id,
      'amount', case when p_decision = 'refund' then effective_amount else p_amount end,
      'other_hold', other_hold
    )
  );
end;
$$;

create function public.open_marketplace_return(
  p_order_id uuid,
  p_order_item_id uuid,
  p_quantity integer,
  p_reason text,
  p_details text
)
returns public.marketplace_returns
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_order public.order_requests;
  requested_item public.order_items;
  fulfillment public.order_fulfillments;
  created_case public.marketplace_returns;
  hold_amount bigint;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if p_quantity not between 1 and 10 then raise exception using errcode = '22023', message = 'INVALID_RETURN_QUANTITY'; end if;
  if p_reason not in ('wrong_item', 'damaged', 'not_as_described', 'fit', 'changed_mind', 'other') then raise exception using errcode = '22023', message = 'INVALID_RETURN_REASON'; end if;
  if char_length(btrim(coalesce(p_details, ''))) not between 10 and 2000 then raise exception using errcode = '22023', message = 'INVALID_CASE_DETAILS'; end if;

  select * into requested_order from public.order_requests where id = p_order_id;
  if not found or requested_order.user_id <> (select auth.uid()) then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;

  select * into requested_item
  from public.order_items
  where id = p_order_item_id and order_request_id = requested_order.id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_ITEM_NOT_FOUND'; end if;
  if p_quantity > requested_item.quantity then raise exception using errcode = '22023', message = 'INVALID_RETURN_QUANTITY'; end if;
  if coalesce((
    select sum(existing.quantity)
    from public.marketplace_returns existing
    where existing.order_item_id = requested_item.id
      and existing.payout_resolution is distinct from 'release'
      and existing.status <> 'rejected'
  ), 0) + p_quantity > requested_item.quantity then
    raise exception using errcode = '23514', message = 'RETURN_QUANTITY_ALREADY_CLAIMED';
  end if;

  select * into fulfillment from public.order_fulfillments where id = requested_item.fulfillment_id for update;
  if fulfillment.status <> 'delivered' then raise exception using errcode = '23514', message = 'FULFILLMENT_NOT_DELIVERED'; end if;

  hold_amount := coalesce(public.case_payout_amount(requested_item.id, p_quantity), 0);
  insert into public.marketplace_returns(
    order_request_id, order_item_id, buyer_id, quantity, reason, details, payout_hold_amount
  ) values (
    requested_order.id, requested_item.id, (select auth.uid()), p_quantity, p_reason, btrim(p_details), hold_amount
  ) returning * into created_case;

  perform public.apply_payout_case_hold(
    fulfillment.id, requested_item.id, 'return', created_case.id, hold_amount,
    'Return requested: ' || replace(p_reason, '_', ' ')
  );
  return created_case;
end;
$$;

create function public.open_marketplace_dispute(
  p_order_id uuid,
  p_order_item_id uuid,
  p_reason text,
  p_details text
)
returns public.marketplace_disputes
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_order public.order_requests;
  requested_item public.order_items;
  fulfillment public.order_fulfillments;
  created_case public.marketplace_disputes;
  hold_amount bigint;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if p_reason not in ('delivery', 'item', 'refund', 'seller', 'other') then raise exception using errcode = '22023', message = 'INVALID_DISPUTE_REASON'; end if;
  if char_length(btrim(coalesce(p_details, ''))) not between 10 and 2000 then raise exception using errcode = '22023', message = 'INVALID_CASE_DETAILS'; end if;

  select * into requested_order from public.order_requests where id = p_order_id;
  if not found or requested_order.user_id <> (select auth.uid()) then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;

  select * into requested_item
  from public.order_items
  where id = p_order_item_id and order_request_id = requested_order.id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_ITEM_NOT_FOUND'; end if;

  select * into fulfillment from public.order_fulfillments where id = requested_item.fulfillment_id for update;
  if fulfillment.status in ('pending', 'confirmed', 'rejected', 'cancelled') then
    raise exception using errcode = '23514', message = 'FULFILLMENT_NOT_DISPUTABLE';
  end if;

  hold_amount := coalesce(public.case_payout_amount(requested_item.id, requested_item.quantity), 0);
  insert into public.marketplace_disputes(
    order_request_id, fulfillment_id, order_item_id, opened_by, reason, details, payout_hold_amount
  ) values (
    requested_order.id, fulfillment.id, requested_item.id, (select auth.uid()), p_reason, btrim(p_details), hold_amount
  ) returning * into created_case;

  perform public.apply_payout_case_hold(
    fulfillment.id, requested_item.id, 'dispute', created_case.id, hold_amount,
    'Dispute opened: ' || replace(p_reason, '_', ' ')
  );
  return created_case;
end;
$$;

create function public.update_marketplace_case(
  p_case_type text,
  p_case_id uuid,
  p_status text,
  p_resolution text default null,
  p_payout_resolution text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_payout_resolution text;
  item_id uuid;
  fulfillment_id uuid;
  hold_amount bigint;
  result jsonb;
begin
  if not public.has_admin_role(array['owner','admin','fulfilment']) then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;
  if p_case_type not in ('return', 'dispute') then raise exception using errcode = '22023', message = 'INVALID_CASE_TYPE'; end if;
  if p_payout_resolution is not null and not public.has_admin_role(array['owner','admin']) then
    raise exception using errcode = '42501', message = 'PAYOUT_DECISION_ACCESS_REQUIRED';
  end if;

  if p_case_type = 'return' then
    select return_case.order_item_id, item.fulfillment_id
    into item_id, fulfillment_id
    from public.marketplace_returns return_case
    join public.order_items item on item.id = return_case.order_item_id
    where return_case.id = p_case_id;
  else
    select disputes.order_item_id, disputes.fulfillment_id
    into item_id, fulfillment_id
    from public.marketplace_disputes disputes
    where disputes.id = p_case_id;
  end if;
  if not found then raise exception using errcode = 'P0002', message = 'CASE_NOT_FOUND'; end if;

  perform id from public.order_fulfillments where id = fulfillment_id for update;

  if p_case_type = 'return' then
    select status, payout_resolution, payout_hold_amount
    into current_status, current_payout_resolution, hold_amount
    from public.marketplace_returns where id = p_case_id for update;
    if not (
      (current_status = 'requested' and p_status in ('approved', 'rejected'))
      or (current_status = 'approved' and p_status in ('in_transit', 'closed'))
      or (current_status = 'in_transit' and p_status = 'received')
      or (current_status = 'received' and p_status in ('refunded', 'closed'))
      or (current_status in ('refunded', 'rejected') and p_status = 'closed')
    ) then raise exception using errcode = '23514', message = 'INVALID_CASE_TRANSITION'; end if;
  else
    select status, payout_resolution, payout_hold_amount
    into current_status, current_payout_resolution, hold_amount
    from public.marketplace_disputes where id = p_case_id for update;
    if not (
      (current_status = 'open' and p_status in ('reviewing', 'rejected'))
      or (current_status = 'reviewing' and p_status in ('resolved', 'rejected', 'closed'))
      or (current_status in ('resolved', 'rejected') and p_status = 'closed')
    ) then raise exception using errcode = '23514', message = 'INVALID_CASE_TRANSITION'; end if;
  end if;

  if p_status in ('rejected', 'resolved', 'refunded', 'closed') and nullif(btrim(coalesce(p_resolution, '')), '') is null then
    raise exception using errcode = '22023', message = 'CASE_RESOLUTION_REQUIRED';
  end if;
  if p_status in ('rejected', 'resolved', 'refunded', 'closed')
    and coalesce(current_payout_resolution, p_payout_resolution) not in ('release', 'refund', 'keep_held')
  then raise exception using errcode = '22023', message = 'PAYOUT_RESOLUTION_REQUIRED'; end if;
  if p_status = 'rejected' and coalesce(current_payout_resolution, p_payout_resolution) <> 'release' then
    raise exception using errcode = '23514', message = 'REJECTED_CASE_MUST_RELEASE_PAYOUT';
  end if;
  if p_case_type = 'return' and p_status = 'refunded'
    and coalesce(current_payout_resolution, p_payout_resolution) <> 'refund'
  then raise exception using errcode = '23514', message = 'REFUNDED_RETURN_MUST_ADJUST_PAYOUT'; end if;
  if p_status not in ('rejected', 'resolved', 'refunded', 'closed') and p_payout_resolution is not null then
    raise exception using errcode = '22023', message = 'PAYOUT_DECISION_NOT_ALLOWED';
  end if;
  if current_payout_resolution is not null and current_payout_resolution is distinct from p_payout_resolution then
    raise exception using errcode = '23514', message = 'PAYOUT_RESOLUTION_IMMUTABLE';
  end if;

  if p_case_type = 'return' then
    update public.marketplace_returns
    set status = p_status,
        resolution = nullif(btrim(coalesce(p_resolution, '')), ''),
        payout_resolution = coalesce(current_payout_resolution, p_payout_resolution)
    where id = p_case_id
    returning to_jsonb(marketplace_returns) into result;
  else
    update public.marketplace_disputes
    set status = p_status,
        resolution = nullif(btrim(coalesce(p_resolution, '')), ''),
        payout_resolution = coalesce(current_payout_resolution, p_payout_resolution)
    where id = p_case_id
    returning to_jsonb(marketplace_disputes) into result;
  end if;

  if current_payout_resolution is null and p_payout_resolution is not null then
    perform public.resolve_payout_case_hold(
      fulfillment_id, item_id, p_case_type, p_case_id, p_payout_resolution,
      hold_amount, coalesce(nullif(btrim(p_resolution), ''), 'Case resolved')
    );
  end if;
  return result;
end;
$$;

create or replace function public.create_seller_payout(p_seller_owner_id uuid, p_currency text)
returns public.seller_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout public.seller_payouts;
  total_amount bigint;
begin
  if not public.has_admin_role(array['owner','admin']) then raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception using errcode = '22023', message = 'INVALID_CURRENCY'; end if;

  perform fulfillments.id
  from public.order_fulfillments fulfillments
  join public.order_requests orders on orders.id = fulfillments.order_request_id
  where fulfillments.seller_owner_id = p_seller_owner_id
    and fulfillments.payout_status = 'eligible'
    and fulfillments.payout_hold_status = 'clear'
    and fulfillments.vendor_net_amount > fulfillments.payout_adjustment_amount
    and orders.currency = p_currency
  order by fulfillments.id
  for update of fulfillments;

  select sum(fulfillments.vendor_net_amount - fulfillments.payout_adjustment_amount)
  into total_amount
  from public.order_fulfillments fulfillments
  join public.order_requests orders on orders.id = fulfillments.order_request_id
  where fulfillments.seller_owner_id = p_seller_owner_id
    and fulfillments.payout_status = 'eligible'
    and fulfillments.payout_hold_status = 'clear'
    and fulfillments.vendor_net_amount > fulfillments.payout_adjustment_amount
    and orders.currency = p_currency;

  if coalesce(total_amount, 0) <= 0 then raise exception using errcode = '22023', message = 'NO_ELIGIBLE_FULFILLMENTS'; end if;
  insert into public.seller_payouts(seller_owner_id, amount, currency)
  values (p_seller_owner_id, total_amount, p_currency)
  returning * into payout;

  insert into public.seller_payout_items(payout_id, fulfillment_id, amount, status)
  select payout.id, fulfillments.id,
    fulfillments.vendor_net_amount - fulfillments.payout_adjustment_amount, 'included'
  from public.order_fulfillments fulfillments
  join public.order_requests orders on orders.id = fulfillments.order_request_id
  where fulfillments.seller_owner_id = p_seller_owner_id
    and fulfillments.payout_status = 'eligible'
    and fulfillments.payout_hold_status = 'clear'
    and fulfillments.vendor_net_amount > fulfillments.payout_adjustment_amount
    and orders.currency = p_currency;

  update public.order_fulfillments
  set payout_status = 'held'
  where id in (
    select fulfillment_id from public.seller_payout_items
    where payout_id = payout.id and status = 'included'
  );
  return payout;
end;
$$;

create or replace function public.update_seller_payout(p_payout_id uuid, p_status text, p_reference text default null)
returns public.seller_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout public.seller_payouts;
begin
  if not public.has_admin_role(array['owner','admin']) then raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED'; end if;

  perform fulfillment.id
  from public.order_fulfillments fulfillment
  join public.seller_payout_items item on item.fulfillment_id = fulfillment.id
  where item.payout_id = p_payout_id and item.status in ('included', 'held')
  order by fulfillment.id
  for update of fulfillment;

  select * into payout from public.seller_payouts where id = p_payout_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYOUT_NOT_FOUND'; end if;
  if not (
    (payout.status = 'pending' and p_status in ('approved', 'cancelled'))
    or (payout.status = 'approved' and p_status in ('paid', 'failed'))
    or (payout.status = 'held' and p_status = 'cancelled')
  ) then raise exception using errcode = '23514', message = 'INVALID_PAYOUT_TRANSITION'; end if;
  if p_status = 'paid' and nullif(btrim(p_reference), '') is null then raise exception using errcode = '22023', message = 'PAYOUT_REFERENCE_REQUIRED'; end if;
  if p_status in ('approved', 'paid') and not exists (
    select 1 from public.seller_payout_items where payout_id = p_payout_id and status = 'included'
  ) then raise exception using errcode = '23514', message = 'PAYOUT_ON_HOLD'; end if;
  if p_status in ('approved', 'paid') and exists (
    select 1
    from public.seller_payout_items item
    join public.order_fulfillments fulfillment on fulfillment.id = item.fulfillment_id
    where item.payout_id = p_payout_id and item.status = 'included'
      and fulfillment.payout_hold_status = 'held'
  ) then raise exception using errcode = '23514', message = 'PAYOUT_ON_HOLD'; end if;

  update public.seller_payouts
  set status = p_status,
      reference = coalesce(nullif(btrim(p_reference), ''), reference),
      approved_by = case when p_status = 'approved' then (select auth.uid()) else approved_by end,
      paid_at = case when p_status = 'paid' then now() else paid_at end
  where id = p_payout_id
  returning * into payout;

  if p_status = 'paid' then
    update public.seller_payout_items set status = 'paid'
    where payout_id = p_payout_id and status = 'included';
    update public.order_fulfillments set payout_status = 'paid'
    where id in (
      select fulfillment_id from public.seller_payout_items
      where payout_id = p_payout_id and status = 'paid'
    );
  elsif p_status in ('failed', 'cancelled') then
    update public.seller_payout_items set status = 'released'
    where payout_id = p_payout_id and status = 'included';
    update public.order_fulfillments fulfillment
    set payout_status = case
      when fulfillment.payout_hold_status = 'held' then 'held'
      when fulfillment.vendor_net_amount <= fulfillment.payout_adjustment_amount then 'adjusted'
      else 'eligible'
    end
    where fulfillment.id in (
      select fulfillment_id from public.seller_payout_items
      where payout_id = p_payout_id and status = 'released'
    );
  end if;
  return payout;
end;
$$;

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
      from public.order_fulfillments fulfillment
      join public.order_requests orders on orders.id = fulfillment.order_request_id
      where fulfillment.id = new.fulfillment_id
        and (orders.payment_status <> 'confirmed' or fulfillment.payout_hold_status = 'held')
    ) then raise exception using errcode = '23514', message = 'PAYOUT_NOT_ELIGIBLE'; end if;
  elsif new.status in ('approved', 'paid') and old.status is distinct from new.status then
    if exists (
      select 1
      from public.seller_payout_items item
      join public.order_fulfillments fulfillment on fulfillment.id = item.fulfillment_id
      join public.order_requests orders on orders.id = fulfillment.order_request_id
      where item.payout_id = new.id and item.status = 'included'
        and (orders.payment_status <> 'confirmed' or fulfillment.payout_hold_status = 'held')
    ) then raise exception using errcode = '23514', message = 'PAYOUT_NOT_ELIGIBLE'; end if;
  end if;
  return new;
end;
$$;

revoke update on public.marketplace_returns, public.marketplace_disputes from authenticated;
drop policy if exists "operations update returns" on public.marketplace_returns;
drop policy if exists "operations update disputes" on public.marketplace_disputes;

revoke all on function public.case_payout_amount(uuid, integer) from public, anon, authenticated;
revoke all on function public.refresh_open_payout_total(uuid) from public, anon, authenticated;
revoke all on function public.fulfillment_has_other_payout_hold(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.apply_payout_case_hold(uuid, uuid, text, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.resolve_payout_case_hold(uuid, uuid, text, uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.prevent_payout_adjustment_mutation() from public, anon, authenticated;
revoke all on function public.open_marketplace_return(uuid, uuid, integer, text, text) from public, anon;
revoke all on function public.open_marketplace_dispute(uuid, uuid, text, text) from public, anon;
revoke all on function public.update_marketplace_case(text, uuid, text, text, text) from public, anon;
grant execute on function public.open_marketplace_return(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.open_marketplace_dispute(uuid, uuid, text, text) to authenticated;
grant execute on function public.update_marketplace_case(text, uuid, text, text, text) to authenticated;

create or replace function public.buyer_order_timeline()
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
    and event.event_type in (
      'order_created', 'confirmation_started', 'order_confirmed', 'payment_confirmed',
      'fulfillment_status_changed', 'order_cancelled'
    )
  order by event.created_at, event.id;
$$;

revoke all on function public.buyer_order_timeline() from public, anon;
grant execute on function public.buyer_order_timeline() to authenticated;

update public.marketplace_returns return_case
set payout_hold_amount = coalesce(public.case_payout_amount(return_case.order_item_id, return_case.quantity), 0);

update public.marketplace_disputes dispute
set payout_hold_amount = coalesce(
  public.case_payout_amount(dispute.order_item_id, null),
  fulfillment.vendor_net_amount
)
from public.order_fulfillments fulfillment
where fulfillment.id = dispute.fulfillment_id;

do $$
declare
  active_case record;
begin
  for active_case in
    select return_case.id, 'return'::text as case_type, item.fulfillment_id,
      return_case.order_item_id, return_case.payout_hold_amount,
      'Existing return: ' || replace(return_case.reason, '_', ' ') as reason
    from public.marketplace_returns return_case
    join public.order_items item on item.id = return_case.order_item_id
    where return_case.status in ('requested', 'approved', 'in_transit', 'received')
    union all
    select dispute.id, 'dispute'::text, dispute.fulfillment_id,
      dispute.order_item_id, dispute.payout_hold_amount,
      'Existing dispute: ' || replace(dispute.reason, '_', ' ')
    from public.marketplace_disputes dispute
    where dispute.status in ('open', 'reviewing') and dispute.fulfillment_id is not null
    order by fulfillment_id, id
  loop
    perform public.apply_payout_case_hold(
      active_case.fulfillment_id, active_case.order_item_id, active_case.case_type,
      active_case.id, active_case.payout_hold_amount, active_case.reason
    );
  end loop;
end;
$$;

commit;
