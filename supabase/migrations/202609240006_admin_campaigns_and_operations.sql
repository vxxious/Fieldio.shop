begin;

alter table public.admin_users add column if not exists email text;
create unique index if not exists admin_users_email_idx on public.admin_users(lower(email)) where email is not null;
update public.admin_users admins set email = users.email from auth.users users where users.id = admins.user_id and admins.email is null;

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin', 'editor', 'fulfilment')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index admin_invitations_pending_idx on public.admin_invitations(lower(email)) where status = 'pending';
create trigger set_admin_invitations_updated_at before update on public.admin_invitations for each row execute procedure public.set_updated_at();

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  subject text not null check (char_length(subject) between 2 and 160),
  preheader text check (preheader is null or char_length(preheader) <= 180),
  heading text not null check (char_length(heading) between 2 and 160),
  body text not null check (char_length(body) between 2 and 10000),
  action_label text check (action_label is null or char_length(action_label) between 2 and 80),
  action_url text check (action_url is null or action_url ~ '^https://'),
  audience text not null check (audience in ('subscribers', 'customers', 'sellers')),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'partial', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  opened_count integer not null default 0 check (opened_count >= 0),
  clicked_count integer not null default 0 check (clicked_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  unsubscribed_count integer not null default 0 check (unsubscribed_count >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_action_complete check ((action_label is null) = (action_url is null))
);
create index email_campaigns_created_idx on public.email_campaigns(created_at desc);
create trigger set_email_campaigns_updated_at before update on public.email_campaigns for each row execute procedure public.set_updated_at();

create table public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'unsubscribed')),
  provider_email_id text unique,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);
create index email_campaign_recipients_campaign_idx on public.email_campaign_recipients(campaign_id, status);
create trigger set_email_campaign_recipients_updated_at before update on public.email_campaign_recipients for each row execute procedure public.set_updated_at();

alter table public.order_fulfillments
  add column commission_rate_bps integer not null default 1500 check (commission_rate_bps between 0 and 10000),
  add column gross_amount bigint not null default 0 check (gross_amount >= 0),
  add column commission_amount bigint generated always as (round(gross_amount::numeric * commission_rate_bps / 10000.0)::bigint) stored,
  add column vendor_net_amount bigint generated always as (gross_amount - round(gross_amount::numeric * commission_rate_bps / 10000.0)::bigint) stored,
  add column payout_status text not null default 'pending' check (payout_status in ('pending', 'eligible', 'held', 'paid'));

create table public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_owner_id uuid not null references auth.users(id) on delete restrict,
  amount bigint not null check (amount > 0),
  currency char(3) not null default 'GBP',
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'failed', 'cancelled')),
  reference text,
  note text,
  approved_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seller_payouts_seller_idx on public.seller_payouts(seller_owner_id, created_at desc);
create trigger set_seller_payouts_updated_at before update on public.seller_payouts for each row execute procedure public.set_updated_at();

create table public.seller_payout_items (
  payout_id uuid not null references public.seller_payouts(id) on delete cascade,
  fulfillment_id uuid not null unique references public.order_fulfillments(id) on delete restrict,
  amount bigint not null check (amount > 0),
  primary key (payout_id, fulfillment_id)
);

create table public.marketplace_returns (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 10),
  reason text not null check (reason in ('wrong_item', 'damaged', 'not_as_described', 'fit', 'changed_mind', 'other')),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'in_transit', 'received', 'refunded', 'closed')),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketplace_returns_buyer_idx on public.marketplace_returns(buyer_id, created_at desc);
create index marketplace_returns_status_idx on public.marketplace_returns(status, created_at desc);
create unique index marketplace_returns_open_item_idx on public.marketplace_returns(order_item_id, buyer_id) where status not in ('rejected', 'closed');
create trigger set_marketplace_returns_updated_at before update on public.marketplace_returns for each row execute procedure public.set_updated_at();

create table public.marketplace_disputes (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete restrict,
  fulfillment_id uuid references public.order_fulfillments(id) on delete restrict,
  opened_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (reason in ('delivery', 'item', 'refund', 'seller', 'other')),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected', 'closed')),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketplace_disputes_user_idx on public.marketplace_disputes(opened_by, created_at desc);
create index marketplace_disputes_status_idx on public.marketplace_disputes(status, created_at desc);
create unique index marketplace_disputes_open_fulfillment_idx on public.marketplace_disputes(order_request_id, fulfillment_id, opened_by) where status in ('open', 'reviewing');
create trigger set_marketplace_disputes_updated_at before update on public.marketplace_disputes for each row execute procedure public.set_updated_at();

create or replace function public.refresh_fulfillment_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  target_id := case when TG_OP = 'DELETE' then old.fulfillment_id else new.fulfillment_id end;
  if target_id is not null then
    update public.order_fulfillments
    set gross_amount = coalesce((select sum(coalesce(line_total, 0)) from public.order_items where fulfillment_id = target_id), 0)
    where id = target_id;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger refresh_fulfillment_financials_after_item after insert or update or delete on public.order_items for each row execute function public.refresh_fulfillment_financials();
update public.order_fulfillments fulfillments
set gross_amount = coalesce((select sum(coalesce(items.line_total, 0)) from public.order_items items where items.fulfillment_id = fulfillments.id), 0);
update public.order_fulfillments set payout_status = 'eligible' where status = 'delivered' and seller_owner_id is not null;

create or replace function public.mark_fulfillment_payout_eligibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' and new.seller_owner_id is not null then new.payout_status = 'eligible'; end if;
  if new.status = 'cancelled' then new.payout_status = 'held'; end if;
  return new;
end;
$$;
create trigger mark_fulfillment_payout_eligibility before update of status on public.order_fulfillments for each row execute function public.mark_fulfillment_payout_eligibility();

alter table public.admin_invitations enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;
alter table public.seller_payouts enable row level security;
alter table public.seller_payout_items enable row level security;
alter table public.marketplace_returns enable row level security;
alter table public.marketplace_disputes enable row level security;

revoke all on public.admin_invitations, public.email_campaigns, public.email_campaign_recipients, public.seller_payouts, public.seller_payout_items, public.marketplace_returns, public.marketplace_disputes from public, anon, authenticated;
grant select on public.admin_invitations to authenticated;
grant select on public.email_campaigns, public.email_campaign_recipients to authenticated;
grant select, insert, update on public.seller_payouts, public.seller_payout_items to authenticated;
grant select, update on public.marketplace_returns, public.marketplace_disputes to authenticated;

create policy "owners read admin invitations" on public.admin_invitations for select to authenticated using (public.is_owner());
create policy "marketing staff read campaigns" on public.email_campaigns for select to authenticated using (public.has_admin_role(array['owner','admin']));
create policy "marketing staff read campaign recipients" on public.email_campaign_recipients for select to authenticated using (public.has_admin_role(array['owner','admin']));
create policy "management manage payouts" on public.seller_payouts for all to authenticated using (public.has_admin_role(array['owner','admin'])) with check (public.has_admin_role(array['owner','admin']));
create policy "management manage payout items" on public.seller_payout_items for all to authenticated using (public.has_admin_role(array['owner','admin'])) with check (public.has_admin_role(array['owner','admin']));
create policy "sellers read own payouts" on public.seller_payouts for select to authenticated using (seller_owner_id = (select auth.uid()));
create policy "sellers read own payout items" on public.seller_payout_items for select to authenticated using (exists (select 1 from public.seller_payouts payouts where payouts.id = payout_id and payouts.seller_owner_id = (select auth.uid())));
create policy "buyers and operations read returns" on public.marketplace_returns for select to authenticated using (buyer_id = (select auth.uid()) or public.has_admin_role(array['owner','admin','fulfilment']) or exists (select 1 from public.order_items items join public.order_fulfillments fulfillments on fulfillments.id = items.fulfillment_id where items.id = order_item_id and fulfillments.seller_owner_id = (select auth.uid())));
create policy "buyers and operations read disputes" on public.marketplace_disputes for select to authenticated using (opened_by = (select auth.uid()) or public.has_admin_role(array['owner','admin','fulfilment']) or exists (select 1 from public.order_fulfillments fulfillments where fulfillments.id = fulfillment_id and fulfillments.seller_owner_id = (select auth.uid())));
create policy "operations update returns" on public.marketplace_returns for update to authenticated using (public.has_admin_role(array['owner','admin','fulfilment'])) with check (public.has_admin_role(array['owner','admin','fulfilment']));
create policy "operations update disputes" on public.marketplace_disputes for update to authenticated using (public.has_admin_role(array['owner','admin','fulfilment'])) with check (public.has_admin_role(array['owner','admin','fulfilment']));

create or replace function public.accept_admin_invitation(p_token_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.admin_invitations;
  user_email text;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  select lower(email) into user_email from auth.users where id = (select auth.uid());
  select * into invitation from public.admin_invitations where token_hash = p_token_hash for update;
  if not found or invitation.status <> 'pending' or invitation.expires_at <= now() then raise exception using errcode = '22023', message = 'INVITATION_INVALID'; end if;
  if lower(invitation.email) <> user_email then raise exception using errcode = '42501', message = 'INVITATION_EMAIL_MISMATCH'; end if;
  insert into public.admin_users(user_id, role, email) values ((select auth.uid()), invitation.role, user_email)
  on conflict (user_id) do update set role = case when public.admin_users.role = 'owner' then 'owner' else excluded.role end, email = excluded.email;
  update public.admin_invitations set status = 'accepted', accepted_by = (select auth.uid()), accepted_at = now() where id = invitation.id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values ((select auth.uid()), 'ACCEPT', 'admin_invitation', invitation.id::text, jsonb_build_object('role', invitation.role));
  return invitation.role;
end;
$$;
revoke all on function public.accept_admin_invitation(text) from public, anon;
grant execute on function public.accept_admin_invitation(text) to authenticated;

create trigger audit_payouts after insert or update or delete on public.seller_payouts for each row execute function public.audit_admin_change();
create trigger audit_returns after update on public.marketplace_returns for each row execute function public.audit_admin_change();
create trigger audit_disputes after update on public.marketplace_disputes for each row execute function public.audit_admin_change();

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
  perform fulfillments.id from public.order_fulfillments fulfillments join public.order_requests orders on orders.id = fulfillments.order_request_id where fulfillments.seller_owner_id = p_seller_owner_id and fulfillments.payout_status = 'eligible' and orders.currency = p_currency order by fulfillments.id for update of fulfillments;
  select sum(fulfillments.vendor_net_amount) into total_amount from public.order_fulfillments fulfillments join public.order_requests orders on orders.id = fulfillments.order_request_id where fulfillments.seller_owner_id = p_seller_owner_id and fulfillments.payout_status = 'eligible' and orders.currency = p_currency;
  if coalesce(total_amount, 0) <= 0 then raise exception using errcode = '22023', message = 'NO_ELIGIBLE_FULFILLMENTS'; end if;
  insert into public.seller_payouts(seller_owner_id, amount, currency) values (p_seller_owner_id, total_amount, p_currency) returning * into payout;
  insert into public.seller_payout_items(payout_id, fulfillment_id, amount) select payout.id, fulfillments.id, fulfillments.vendor_net_amount from public.order_fulfillments fulfillments join public.order_requests orders on orders.id = fulfillments.order_request_id where fulfillments.seller_owner_id = p_seller_owner_id and fulfillments.payout_status = 'eligible' and orders.currency = p_currency;
  update public.order_fulfillments set payout_status = 'held' where id in (select fulfillment_id from public.seller_payout_items where payout_id = payout.id);
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
  select * into payout from public.seller_payouts where id = p_payout_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYOUT_NOT_FOUND'; end if;
  if not ((payout.status = 'pending' and p_status in ('approved','cancelled')) or (payout.status = 'approved' and p_status in ('paid','failed'))) then raise exception using errcode = '23514', message = 'INVALID_PAYOUT_TRANSITION'; end if;
  if p_status = 'paid' and nullif(trim(p_reference), '') is null then raise exception using errcode = '22023', message = 'PAYOUT_REFERENCE_REQUIRED'; end if;
  update public.seller_payouts set status = p_status, reference = coalesce(nullif(trim(p_reference), ''), reference), approved_by = case when p_status = 'approved' then (select auth.uid()) else approved_by end, paid_at = case when p_status = 'paid' then now() else paid_at end where id = p_payout_id returning * into payout;
  update public.order_fulfillments set payout_status = case when p_status = 'paid' then 'paid' else 'eligible' end where id in (select fulfillment_id from public.seller_payout_items where payout_id = p_payout_id) and p_status in ('paid','failed','cancelled');
  return payout;
end;
$$;
revoke all on function public.create_seller_payout(uuid,text) from public, anon;
revoke all on function public.update_seller_payout(uuid,text,text) from public, anon;
grant execute on function public.create_seller_payout(uuid,text) to authenticated;
grant execute on function public.update_seller_payout(uuid,text,text) to authenticated;

commit;
