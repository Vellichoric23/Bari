-- BARI analytics: anonymous daily counters per user + a stats function only the app owner can call.
-- Run once in Supabase → SQL Editor. Then run the one-line "make me the admin" query from the chat (it is not stored here).
create table if not exists public.app_events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Atyrau')::date,
  name text not null,
  n int not null default 1,
  primary key (user_id, day, name)
);
alter table public.app_events enable row level security;   -- no direct access; only through the functions below

create table if not exists public.app_admin (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.app_admin enable row level security;

-- count one event for the signed-in user (one row per user, day and event name)
create or replace function public.track_event(p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or length(p_name) > 40 then return; end if;
  insert into app_events (user_id, day, name) values (auth.uid(), (now() at time zone 'Asia/Atyrau')::date, p_name)
  on conflict (user_id, day, name) do update set n = app_events.n + 1;
end $$;

-- aggregated numbers for the owner only; never returns who did what
create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Atyrau')::date; r jsonb;
begin
  if not exists (select 1 from app_admin where user_id = auth.uid()) then raise exception 'not allowed'; end if;
  with first_day as (select user_id, min(day) d0 from app_events group by user_id),
  ret as (
    select
      count(*) filter (where f.d0 <= today - 1) c1,
      count(*) filter (where f.d0 <= today - 1 and exists (select 1 from app_events e where e.user_id = f.user_id and e.day = f.d0 + 1)) r1,
      count(*) filter (where f.d0 <= today - 7) c7,
      count(*) filter (where f.d0 <= today - 7 and exists (select 1 from app_events e where e.user_id = f.user_id and e.day between f.d0 + 7 and f.d0 + 13)) r7,
      count(*) filter (where f.d0 <= today - 30) c30,
      count(*) filter (where f.d0 <= today - 30 and exists (select 1 from app_events e where e.user_id = f.user_id and e.day between f.d0 + 30 and f.d0 + 44)) r30
    from first_day f)
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'new7', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new30', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'dau', (select count(distinct user_id) from app_events where day = today),
    'wau', (select count(distinct user_id) from app_events where day > today - 7),
    'mau', (select count(distinct user_id) from app_events where day > today - 30),
    'ret', (select to_jsonb(ret) from ret),
    'daily', (select coalesce(jsonb_agg(x order by x->>'d'), '[]') from (select jsonb_build_object('d', day, 'u', count(distinct user_id)) x from app_events where day > today - 30 group by day) s),
    'features', (select coalesce(jsonb_object_agg(name, c), '{}') from (select name, sum(n) c from app_events where day > today - 7 group by name) s),
    'featureUsers', (select coalesce(jsonb_object_agg(name, c), '{}') from (select name, count(distinct user_id) c from app_events where day > today - 7 group by name) s),
    'niches', (select coalesce(jsonb_object_agg(k, c), '{}') from (select coalesce(data->>'niche','—') k, count(*) c from docs where col = 'config' and id = 'main' group by 1) s)
  ) into r;
  return r;
end $$;

revoke all on public.app_events, public.app_admin from anon, authenticated;
grant execute on function public.track_event(text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
