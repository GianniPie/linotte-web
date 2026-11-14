-- One row per finished game of a signed-in player: what the Stats screen
-- is built from. Run once in the Supabase SQL editor (project "Linotte").
--
-- source = 'server': an online game, written by the game server (with the
--   project's secret key): these can be trusted, e.g. for leaderboards.
-- source = 'app': written by the app itself (games against the bot, and the
--   games a guest played before signing in). Only the player's own numbers.

create table if not exists public.game_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  played_at timestamptz not null default now(),
  mode text not null check (mode in ('random', 'friend', 'bot')),
  won boolean not null,
  points smallint not null check (points between 0 and 999),
  opponent_points smallint not null check (opponent_points between 0 and 999),
  opponent text check (opponent is null or char_length(opponent) <= 24),
  source text not null check (source in ('server', 'app')),
  -- an online game this player left before its end (costs level points)
  abandoned boolean not null default false,
  -- a guest game moved in at sign-in: in the stats, not in the level
  from_guest boolean not null default false,
  -- the game's points count for the level (false while the video that pays them waits: game_results_xp.sql)
  earns_xp boolean not null default true
);

-- Added in 2.16 (a table created before needs them):
alter table public.game_results add column if not exists abandoned boolean not null default false;
alter table public.game_results add column if not exists from_guest boolean not null default false;
alter table public.game_results add column if not exists earns_xp boolean not null default true; -- 2.23.1

create index if not exists game_results_user_played on public.game_results (user_id, played_at desc);

alter table public.game_results enable row level security;

drop policy if exists "read own results" on public.game_results;
create policy "read own results" on public.game_results
  for select to authenticated using (user_id = (select auth.uid()));

-- The app may only add its own games, marked as written by the app.
drop policy if exists "add own app results" on public.game_results;
create policy "add own app results" on public.game_results
  for insert to authenticated with check (user_id = (select auth.uid()) and source = 'app');

revoke all on public.game_results from anon, authenticated;
grant select on public.game_results to authenticated;
grant insert (user_id, played_at, mode, won, points, opponent_points, opponent, source, from_guest, earns_xp) on public.game_results to authenticated;
grant all on public.game_results to service_role;
