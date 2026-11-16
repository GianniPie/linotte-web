-- Level points that don't come from a game, and the weekly leaderboard.
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor.
--
-- xp_bonuses: one row per bonus, written by the game server only (with the
-- secret key; server/bonuses.js):
--   daily  the first online game of the day played to the end, win or lose, +2 -- one per account a day
--   ad     a rewarded ad watched to the end, +1 -- the server allows 5 a day

create table if not exists public.xp_bonuses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('daily', 'ad')),
  points smallint not null,
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

create index if not exists xp_bonuses_user_day on public.xp_bonuses (user_id, day);
-- One daily bonus per account and day, even if two wins end at once.
create unique index if not exists xp_bonuses_one_daily on public.xp_bonuses (user_id, day) where kind = 'daily';

alter table public.xp_bonuses enable row level security;
revoke all on public.xp_bonuses from anon, authenticated;
grant all on public.xp_bonuses to service_role;

-- The leaderboard function (weekly_leaderboard) is in leaderboard_everyone.sql: every
-- registered player, by all their level points, not only online ones.
