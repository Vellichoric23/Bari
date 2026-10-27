-- BARI games: live wishlists between players (people open the game link without an account).
-- Run once in Supabase → SQL Editor → New query → Run.
create table if not exists public.play_wish (
  game text not null,
  person text not null,
  data jsonb not null default '{}'::jsonb,
  token text,
  updated_at timestamptz not null default now(),
  primary key (game, person)
);
alter table public.play_wish enable row level security;   -- no policies: nobody reads the table directly

-- read one person's wishlist in one game (you need to know both the secret game key and the name)
create or replace function public.get_wish(p_game text, p_person text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('data', data, 'at', updated_at) from play_wish where game = p_game and person = p_person;
$$;

-- save my wishlist: the first device that writes becomes its owner, nobody else can overwrite it
create or replace function public.set_wish(p_game text, p_person text, p_token text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if length(p_game) > 80 or length(p_person) > 80 or length(p_token) < 16 or length(p_data::text) > 20000 then return false; end if;
  insert into play_wish (game, person, data, token) values (p_game, p_person, p_data, p_token)
  on conflict (game, person) do update set data = excluded.data, updated_at = now()
    where play_wish.token = excluded.token;
  return found;
end $$;

revoke all on public.play_wish from anon, authenticated;
grant execute on function public.get_wish(text, text) to anon, authenticated;
grant execute on function public.set_wish(text, text, text, jsonb) to anon, authenticated;
