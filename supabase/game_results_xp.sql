-- A game's points count once the video before the winner card has been
-- watched (2.23.1). Run once in the Linotte Supabase project: Dashboard > SQL
-- Editor -- BEFORE deploying the server that writes the column.
--
-- earns_xp: true when the game's points count for the level. The game server
-- writes a finished online game of a non-Pro player with false, then sets it
-- to true when the app says the video was watched (server/lobby.js, claimPoints);
-- the app writes its bot games with false when it closed the video early.
-- Every game from before is true: nothing changes for them.

alter table public.game_results add column if not exists earns_xp boolean not null default true;

-- The app writes its own games against the bot (and the guest games moved in
-- at sign-in) with it; it can only ever lower its own points.
grant insert (earns_xp) on public.game_results to authenticated;

-- The weekly leaderboard counts only games that earn points (same function as
-- in xp_bonuses.sql, with that one condition added).
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
    where g.source = 'server' and g.earns_xp and g.played_at >= since
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
