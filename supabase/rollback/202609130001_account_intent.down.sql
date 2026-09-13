begin;

alter table public.profiles drop column if exists account_intent;

commit;
