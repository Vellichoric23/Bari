-- BARI games, update 2: a wishlist can be edited from ANY browser that opens the same personal link
-- (WhatsApp's built-in browser, Safari, Chrome…). Run once in Supabase → SQL Editor → New query → Run.
create or replace function public.set_wish(p_game text, p_person text, p_token text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if length(p_game) > 80 or length(p_person) > 80 or length(p_token) < 16 or length(p_data::text) > 20000 then return false; end if;
  insert into play_wish (game, person, data, token) values (p_game, p_person, p_data, p_token)
  on conflict (game, person) do update set data = excluded.data, token = excluded.token, updated_at = now()
    where play_wish.token = excluded.token
       -- a list started by an old one-browser key moves over to the personal-link key
       or (left(excluded.token, 2) in ('k:', 'n:') and left(coalesce(play_wish.token, ''), 2) not in ('k:', 'n:'));
  return found;
end $$;
grant execute on function public.set_wish(text, text, text, jsonb) to anon, authenticated;
