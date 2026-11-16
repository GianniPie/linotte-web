-- The leaderboard of every registered player, by their points (their level).
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor. It replaces the
-- weekly_leaderboard function of xp_bonuses.sql (same name, same arguments: the game
-- server needs no change).
--
-- Before: only accounts with a positive total from ONLINE games and bonuses were listed,
-- so a registered player who had played the bot, or had not played online yet, or this
-- week, wasn't there. Now:
--   * everyone who has an account is listed, even with 0 points (at the bottom, tied);
--   * the points are the account's level points, counted as the game server counts them
--     (server/results.js, accountStats): online games (+2 a win, +1 a game played to the
--     end, only when the points video was watched or the player is Pro: earns_xp; -2 an
--     abandon), wins against the bot (+1 and the bonus the game paid on top, from the app,
--     not a guest's games moved in at sign-in) and the bonuses (the daily one, the ads);
--   * the week's list counts the same, from `since` (Monday 00:00 UTC); "all time" is
--     since 1970. The top `max_rows`, and `me` wherever it is.

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
                 when g.source = 'server' and g.abandoned then -2
                 when g.source = 'server' and g.earns_xp and g.won then 2
                 when g.source = 'server' and g.earns_xp then 1
                 when g.source = 'app' and g.mode = 'bot' and g.won and not g.from_guest and g.earns_xp
                   then 1 + coalesce(g.bonus_xp, 0)
                 else 0
               end) as pts
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
