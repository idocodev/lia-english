-- Lia English: cloud save of the player's progress.
-- Run once in the Supabase SQL editor of the project. Safe to re-run.
--
-- Each child has an account (players): a login name (player_names, several per child, e.g.
-- "lia" and "ליה") and a password (bcrypt hash) the child picks the first time (register).
-- The app calls login(name, password), which
-- answers the child's player_key: a long random string the device keeps and sends as the
-- x-player-key header on every request. Row level security only shows and accepts rows of
-- that key, so the public (publishable) key alone reads nothing, and the app can't be used
-- without logging in. Accounts are made by hand (see "Adding a child" at the end).
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

-- A player's key can be changed (rotated) with an update on players; the events follow it.
alter table public.play_events drop constraint if exists play_events_player_key_fkey;
alter table public.play_events add constraint play_events_player_key_fkey
  foreign key (player_key) references public.players (player_key) on update cascade on delete cascade;

-- Accounts -----------------------------------------------------------------

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.players add column if not exists display_name text;  -- shown in the app ("ליה")
alter table public.players add column if not exists password_hash text; -- extensions.crypt(pw, gen_salt('bf'))

-- Login names, lower case and trimmed, unique across children.
create table if not exists public.player_names (
  name_lc     text primary key check (name_lc = lower(btrim(name_lc)) and length(name_lc) between 1 and 40),
  player_key  text not null references public.players (player_key) on update cascade on delete cascade
);

-- Failed logins, to slow down guessing (a kid's password is short).
create table if not exists public.login_failures (
  name_lc  text not null,
  at       timestamptz not null default now()
);
create index if not exists login_failures_name_at_idx on public.login_failures (name_lc, at);

-- Failed tries for a name in the last 10 minutes; from 10 on, login and register refuse.
create or replace function public.login_check_attempts(p_name_lc text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select count(*) from public.login_failures f
      where f.name_lc = p_name_lc and f.at > now() - interval '10 minutes') >= 10 then
    raise exception 'too_many_attempts';
  end if;
end $$;

create or replace function public.login_failed(p_name_lc text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.login_failures (name_lc) values (p_name_lc);
  delete from public.login_failures f where f.at < now() - interval '1 day';
end $$;

-- The only way in: {player_key, name} for a right name and password, null otherwise, and
-- {needs_password: true} for a child whose account has no password yet (see register).
create or replace function public.login(p_name text, p_password text)
returns json language plpgsql volatile security definer set search_path = '' as $$
declare
  v_name text := left(lower(btrim(coalesce(p_name, ''))), 40);
  v_key  text;
  v_show text;
  v_hash text;
begin
  perform public.login_check_attempts(v_name);

  select p.player_key, coalesce(p.display_name, p.name), p.password_hash into v_key, v_show, v_hash
  from public.player_names n join public.players p on p.player_key = n.player_key
  where n.name_lc = v_name;

  if v_key is not null and v_hash is null then
    return json_build_object('needs_password', true);
  end if;
  if v_hash = extensions.crypt(coalesce(p_password, ''), v_hash) then
    delete from public.login_failures f where f.name_lc = v_name;
    return json_build_object('player_key', v_key, 'name', v_show);
  end if;

  perform public.login_failed(v_name);
  return null;
end $$;

-- First time: the child picks a password, only for an account made for them (by the owner)
-- that has none yet; strangers can't make accounts. Then it's login only.
-- Answers {player_key, name}; raises 'already_registered' or 'weak_password'; null for an unknown name.
create or replace function public.register(p_name text, p_password text)
returns json language plpgsql volatile security definer set search_path = '' as $$
declare
  v_name text := left(lower(btrim(coalesce(p_name, ''))), 40);
  v_key  text;
  v_show text;
  v_hash text;
begin
  perform public.login_check_attempts(v_name);
  if length(coalesce(p_password, '')) < 4 or length(p_password) > 100 then
    raise exception 'weak_password';
  end if;

  select p.player_key, coalesce(p.display_name, p.name), p.password_hash into v_key, v_show, v_hash
  from public.player_names n join public.players p on p.player_key = n.player_key
  where n.name_lc = v_name
  for update of p;

  if v_key is null then
    perform public.login_failed(v_name);
    return null;
  end if;
  if v_hash is not null then
    raise exception 'already_registered';
  end if;

  update public.players p set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
  where p.player_key = v_key;
  return json_build_object('player_key', v_key, 'name', v_show);
end $$;

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
alter table public.player_names enable row level security;
alter table public.login_failures enable row level security;

-- Accounts are not readable or writable from the app at all (no policies, no grants):
-- login() is the only door, and the password hash never leaves the database.
drop policy if exists players_select on public.players;
drop policy if exists players_insert on public.players;
revoke all on public.players, public.player_names, public.login_failures from anon, authenticated;

-- Append-only: no update or delete from the app.
drop policy if exists play_events_select on public.play_events;
drop policy if exists play_events_insert on public.play_events;
create policy play_events_select on public.play_events for select to anon, authenticated
  using (player_key = public.request_player_key());
create policy play_events_insert on public.play_events for insert to anon, authenticated
  with check (player_key = public.request_player_key());

revoke update, delete, truncate on public.play_events from anon, authenticated;
grant select, insert on public.play_events to anon, authenticated;
grant execute on function public.request_player_key() to anon, authenticated;
revoke all on function public.login_check_attempts(text), public.login_failed(text) from public, anon, authenticated;
revoke all on function public.login(text, text), public.register(text, text) from public;
grant execute on function public.login(text, text), public.register(text, text) to anon, authenticated;

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

-- Adding a child -----------------------------------------------------------
-- Run as the project owner (SQL editor). Make the key with `openssl rand -hex 24`. With no
-- password, the child picks one in the app the first time ("first time here?").
--
--   insert into public.players (player_key, name, display_name) values ('<key>', 'Noam', 'נועם');
--   insert into public.player_names (name_lc, player_key) values ('noam', '<key>'), ('נועם', '<key>');
--
-- Forgotten password: update public.players set password_hash = null where name = 'Noam';
-- (the child picks a new one in the app; do it when they're about to, as anyone could).
-- Log every device out of a child: update public.players set player_key = '<new key>' where name = 'Noam';
