-- BARI: one table for all personal data. Run once in Supabase → SQL Editor → New query → Run.
create table if not exists public.docs (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  col text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, col, id)
);
alter table public.docs enable row level security;
drop policy if exists "own rows" on public.docs;
create policy "own rows" on public.docs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
