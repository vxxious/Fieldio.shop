begin;

alter table public.profiles
  add column account_intent text
  check (account_intent in ('buy', 'sell'));

commit;
