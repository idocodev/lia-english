-- Lia English: cloud save of the player's progress.
-- Run once in the Supabase SQL editor of the project. Safe to re-run.
--
-- There is no sign-in (it is a kid's app). Each player has a player_key: a long random
-- string baked into the build (VITE_PLAYER_KEY). The app sends it as the x-player-key
-- header on every request, and row level security only shows and accepts rows of that key,
-- so knowing the public (publishable) key alone reads nothing.
--
-- The device keeps its own save (localStorage) and is the offline source of truth; it pushes
-- an append-only log of events here and merges it back on another device. Everything in the
-- game (stars, XP, levels, streak, badges, stickers, the adaptive boxes) is derived from it.

-- Players ------------------------------------------------------------------

create table if not exists public.players (
  player_key  text primary key check (length(player_key) >= 20),
  name        text,
  created_at  timestamptz not null default now()
);

-- Events -------------------------------------------------------------------
-- kind 'answer':      a first-try answer in a game (letter = the target, chosen, correct, round_id)
-- kind 'letter_seen': a letter card opened for the first time (letter)
-- kind 'sticker':     a sticker earned at the end of a round (sticker)
-- id is made on the device, so a re-sent event is a no-op (primary key with player_key).

create table if not exists public.play_events (
  player_key   text not null references public.players (player_key) on delete cascade,
  id           text not null check (length(id) between 1 and 200),
  kind         text not null check (kind in ('answer', 'letter_seen', 'sticker')),
  at           timestamptz not null,
  game         text,
  letter       text,
  chosen       text,
  correct      boolean,
  round_id     text,
  sticker      text,
  received_at  timestamptz not null default now(),
  primary key (player_key, id)
);

create index if not exists play_events_player_at_idx on public.play_events (player_key, at);

-- Row level security -------------------------------------------------------

-- The x-player-key request header (PostgREST exposes request headers as a JSON setting).
create or replace function public.request_player_key()
returns text language plpgsql stable as $$
declare
  v text;
begin
  begin
    v := nullif(current_setting('request.headers', true)::json ->> 'x-player-key', '');
  exception when others then
    v := null;
  end;
  return v;
end $$;

alter table public.players enable row level security;
alter table public.play_events enable row level security;

drop policy if exists players_select on public.players;
drop policy if exists players_insert on public.players;
create policy players_select on public.players for select to anon, authenticated
  using (player_key = public.request_player_key());
create policy players_insert on public.players for insert to anon, authenticated
  with check (player_key = public.request_player_key());

-- Append-only: no update or delete from the app.
drop policy if exists play_events_select on public.play_events;
drop policy if exists play_events_insert on public.play_events;
create policy play_events_select on public.play_events for select to anon, authenticated
  using (player_key = public.request_player_key());
create policy play_events_insert on public.play_events for insert to anon, authenticated
  with check (player_key = public.request_player_key());

revoke update, delete, truncate on public.players, public.play_events from anon, authenticated;
grant select, insert on public.players, public.play_events to anon, authenticated;
grant execute on function public.request_player_key() to anon, authenticated;

-- For a parent dashboard (later) --------------------------------------------
-- security_invoker: the views run with the caller's rights, so the same policies apply.

create or replace view public.letter_stats with (security_invoker = on) as
select
  player_key,
  letter,
  count(*) filter (where correct)       as right_answers,
  count(*) filter (where not correct)   as wrong_answers,
  min(at)                               as first_at,
  max(at)                               as last_at
from public.play_events
where kind = 'answer'
group by player_key, letter;

create or replace view public.rounds with (security_invoker = on) as
select
  player_key,
  round_id,
  min(game)                             as game,
  min(at)                               as started_at,
  max(at)                               as ended_at,
  count(*)                              as answers,
  count(*) filter (where correct)       as right_answers
from public.play_events
where kind = 'answer' and round_id is not null
group by player_key, round_id;

grant select on public.letter_stats, public.rounds to anon, authenticated;
