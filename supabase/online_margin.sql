-- The Ruthless way of playing online (2.35): the points a game is won or lost by count.
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor -- BEFORE deploying the server that uses it.
-- Safe to run again. Until it is run, the server leaves the margin out (the flat +4 / +2 / -3 still count).
--
-- A game is marked `ruthless` by the server when its room was opened (or accepted) as Ruthless. In those games:
--   * only the points the game was won or lost by count: a win pays the margin (at least 1), a loss costs it,
--     a draw pays 0. The flat +4 / +2 are taken off (this file adds the difference);
--   * a game abandoned costs 3 more than the flat -3, and the points the opponent was ahead by at that moment
--     (-6 and the lead in all: more than any loss from the same position, so staying beats leaving).
-- Normal games are as they were. Only games recorded by the server (source = 'server'), and the ones whose
-- points count (earns_xp: the video was watched, or the player is Pro); an abandoned game always counts.

alter table public.game_results add column if not exists ruthless boolean not null default false;

-- (A first version of this file took a date; those functions are dropped.)
drop function if exists public.online_margin_xp(uuid, timestamptz);
drop function if exists public.weekly_leaderboard(timestamptz, int, uuid, timestamptz);

create or replace function public.online_margin_xp(uid uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case
           when g.abandoned then -(3 + greatest(0, g.opponent_points - g.points))
           when not g.earns_xp then 0
           when g.won then greatest(1, g.points - g.opponent_points) - 4
           else -greatest(0, g.opponent_points - g.points) - 2
         end), 0)::bigint
  from public.game_results g
  where g.user_id = uid and g.source = 'server' and g.ruthless;
$$;

revoke all on function public.online_margin_xp(uuid) from public, anon, authenticated;
grant execute on function public.online_margin_xp(uuid) to service_role;

-- The leaderboard counts it the same way (same name and arguments as before: the game server needs no change).
create or replace function public.weekly_leaderboard(since timestamptz, max_rows int default 50, me uuid default null)
returns table (user_id uuid, name text, country text, points bigint, rank bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with games as (
    select g.user_id,
           sum(case
                 when g.source = 'server' and g.abandoned then case when g.played_at >= timestamptz '2026-11-17T04:33:00Z' then -3 else -2 end
                 when g.source = 'server' and g.earns_xp and g.won then case when g.played_at >= timestamptz '2026-11-17T04:33:00Z' then 4 else 2 end
                 when g.source = 'server' and g.earns_xp then case when g.played_at >= timestamptz '2026-11-17T04:33:00Z' then 2 else 1 end
                 when g.source = 'app' and g.mode = 'bot' and g.won and not g.from_guest and g.earns_xp
                   then 1 + coalesce(g.bonus_xp, 0)
                 else 0
               end
               + case when g.source = 'server' and g.ruthless then
                   case
                     when g.abandoned then -(3 + greatest(0, g.opponent_points - g.points))
                     when not g.earns_xp then 0
                     when g.won then greatest(1, g.points - g.opponent_points) - 4
                     else -greatest(0, g.opponent_points - g.points) - 2
                   end
                 else 0 end) as pts
    from public.game_results g
    where g.played_at >= since
    group by g.user_id
  ), bonuses as (
    select b.user_id, sum(b.points) as pts
    from public.xp_bonuses b
    where b.created_at >= since
    group by b.user_id
  ), totals as (
    select u.id as user_id, coalesce(g.pts, 0) + coalesce(b.pts, 0) as points
    from auth.users u
    left join games g on g.user_id = u.id
    left join bonuses b on b.user_id = u.id
  ), ranked as (
    select t.user_id, p.name, p.country, t.points::bigint as points,
           rank() over (order by t.points desc) as rank
    from totals t left join public.profiles p on p.id = t.user_id
  )
  select r.user_id, r.name, r.country, r.points, r.rank
  from ranked r
  where r.rank <= max_rows or r.user_id = me
  order by r.rank;
$$;

revoke all on function public.weekly_leaderboard(timestamptz, int, uuid) from public, anon, authenticated;
grant execute on function public.weekly_leaderboard(timestamptz, int, uuid) to service_role;
