create table public.api_rate_limits (
  key text primary key,
  request_count integer not null,
  expires_at timestamptz not null
);
alter table public.api_rate_limits enable row level security;
create index api_rate_limits_expiry_idx on public.api_rate_limits(expires_at);

create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  delete from public.api_rate_limits where expires_at < now() - interval '1 hour';
  insert into public.api_rate_limits(key, request_count, expires_at)
  values(p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict(key) do update set
    request_count = case when api_rate_limits.expires_at <= now() then 1 else api_rate_limits.request_count + 1 end,
    expires_at = case when api_rate_limits.expires_at <= now() then now() + make_interval(secs => p_window_seconds) else api_rate_limits.expires_at end
  returning request_count into v_count;
  return v_count <= p_limit;
end $$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
