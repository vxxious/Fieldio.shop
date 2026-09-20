begin;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null check (char_length(event_key) between 3 and 240),
  recipient_email text not null check (char_length(recipient_email) between 3 and 254),
  template text not null check (char_length(template) between 2 and 80),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (event_key, recipient_email)
);

create index notification_deliveries_status_idx
on public.notification_deliveries(status, created_at desc);

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from public, anon, authenticated;

commit;
