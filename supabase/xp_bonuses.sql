-- Level points that don't come from a game, and the weekly leaderboard.
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor.
--
-- xp_bonuses: one row per bonus, written by the game server only (with the
-- secret key; server/bonuses.js):
--   daily  the first online win of the day (UTC), +2 -- one per account a day
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

-- The weekly leaderboard: each account's points since `since` (Monday 00:00
-- UTC, given by the server) from online games (+2 a win, +1 a game played to
-- the end, -2 an abandon; games against the bot don't count, the app writes
-- those) and bonuses. The top `max_rows`, and `me` wherever it is.
create or replace function public.weekly_leaderboard(since timestamptz, max_rows int default 50, me uuid default null)
returns table (user_id uuid, name text, country text, points bigint, rank bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with games as (
    select g.user_id, sum(case when g.abandoned then -2 when g.won then 2 else 1 end) as pts
    from public.game_results g
    where g.source = 'server' and g.played_at >= since
    group by g.user_id
  ), bonuses as (
    select b.user_id, sum(b.points) as pts
    from public.xp_bonuses b
    where b.created_at >= since
    group by b.user_id
  ), totals as (
    select coalesce(g.user_id, b.user_id) as user_id, coalesce(g.pts, 0) + coalesce(b.pts, 0) as points
    from games g full join bonuses b on b.user_id = g.user_id
  ), ranked as (
    select t.user_id, p.name, p.country, t.points::bigint as points,
           rank() over (order by t.points desc) as rank
    from totals t left join public.profiles p on p.id = t.user_id
    where t.points > 0
  )
  select r.user_id, r.name, r.country, r.points, r.rank
  from ranked r
  where r.rank <= max_rows or r.user_id = me
  order by r.rank;
$$;

revoke all on function public.weekly_leaderboard(timestamptz, int, uuid) from public, anon, authenticated;
grant execute on function public.weekly_leaderboard(timestamptz, int, uuid) to service_role;
