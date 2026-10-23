-- BARI push reminders: run once in Supabase → SQL Editor, AFTER deploying the "push" Edge Function.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.push_keys (id int primary key, public_key text not null, private_key text not null);
alter table public.push_keys enable row level security;   -- no policies: only the server can read it

create table if not exists public.push_sent (k text primary key, at timestamptz not null default now());
alter table public.push_sent enable row level security;

select cron.schedule('bari-push', '* * * * *', $$
  select net.http_post(
    url := 'https://kmmlvlskmlxoijsyemsn.supabase.co/functions/v1/push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
