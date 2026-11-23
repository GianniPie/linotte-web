-- The ledger: what each game paid, written once (2.35.10).
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor -- BEFORE deploying the server that writes it.
-- Safe to run again. Until it is run the server still records games and bonuses, without these columns
-- (it retries a refused insert without them), so nothing is lost by deploying early, only the ledger.
--
-- Until now a game's row said won / points / abandoned and an account's level was recomputed from COUNTS of
-- rows (server/results.js accountStats), so nothing in the database said what a game paid. Now:
--
--   game_results.xp_delta    the points the game pays when it counts (+4 / +2 / -3, the Ruthless margin, +1 and the
--                            speed / margin bonus for a win against the bot). Written with the row by the server (online
--                            games) or by a trigger (the app's own rows), and never changed afterwards. A game whose
--                            video wasn't watched yet (earns_xp false) already has it: it counts once earns_xp is true.
--                            null = recorded before the ledger (see xp_ledger_backfill.sql).
--   game_results.xp_detail   how it was made: { reason, flat, margin } (jsonb)
--   game_results.exit        how this player's game ended: played, abandoned (left, gone or idle: costs points),
--                            excused (left a game whose opponent was gone or idle: costs nothing), opponent_gone
--                            (stayed, the opponent left or went idle: a win by it, even at 0 - 0)
--   game_results.exit_reason left | idle | disconnect
--   game_results.game_ref    one id per game, the same on both players' rows
--   xp_bonuses.game_ref      the game whose end paid a daily bonus (null for ads and for bonuses before the ledger)
--
-- The level is still counted as before (accountStats): nothing here changes anyone's points. What it adds:
--   view     xp_ledger            every point an account earned or lost, one line each, newest first
--   function xp_ledger_report(uid) the ledger's sum for one account (the server compares it with accountStats: server/ledger-check.js)
--   function xp_ledger_audit()    every account where the ledger and the leaderboard's own count disagree

alter table public.game_results add column if not exists xp_delta smallint;
alter table public.game_results add column if not exists xp_detail jsonb;
alter table public.game_results add column if not exists exit text check (exit is null or exit in ('played', 'abandoned', 'excused', 'opponent_gone'));
alter table public.game_results add column if not exists exit_reason text check (exit_reason is null or exit_reason in ('left', 'idle', 'disconnect'));
alter table public.game_results add column if not exists game_ref text;
alter table public.xp_bonuses add column if not exists game_ref text;

create index if not exists game_results_game_ref on public.game_results (game_ref) where game_ref is not null;

-- The app writes its own games against the bot (the player's own numbers, see game_results.sql): what they pay is
-- decided here, when they go in -- never by the app, which has no grant on xp_delta. +1 and the bonus for a win
-- against the bot while signed in; the games a guest played before signing in pay nothing.
create or replace function public.game_results_set_xp_delta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source = 'app' then
    new.xp_delta := case when new.mode = 'bot' and new.won and not new.from_guest then 1 + coalesce(new.bonus_xp, 0) else 0 end;
    new.exit := null;
    new.exit_reason := null;
    new.game_ref := null;
  end if;
  return new;
end;
$$;

drop trigger if exists game_results_xp_delta on public.game_results;
create trigger game_results_xp_delta before insert on public.game_results
  for each row execute function public.game_results_set_xp_delta();

-- Written once: a paid game's points are never rewritten (a null one may be filled in: xp_ledger_backfill.sql).
create or replace function public.game_results_keep_xp_delta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.xp_delta is not null and new.xp_delta is distinct from old.xp_delta then
    raise exception 'game_results.xp_delta is written once (game %)', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists game_results_xp_delta_once on public.game_results;
create trigger game_results_xp_delta_once before update on public.game_results
  for each row execute function public.game_results_keep_xp_delta();

-- Every point an account earned or lost, one line each. A game counts (counted) as accountStats counts it: its
-- video was watched (earns_xp), or it was abandoned (always). A game with no points (null) was recorded before the ledger.
-- Only for the server and for whoever reads the database: players have no access to it.
create or replace view public.xp_ledger with (security_invoker = true) as
  select g.user_id,
         g.played_at as at,
         case when g.source = 'app' then 'bot' else 'online' end as kind,
         g.id as game_id,
         g.game_ref,
         g.xp_delta as points,
         (g.earns_xp or g.abandoned) as counted,
         g.exit,
         g.exit_reason,
         coalesce(g.xp_detail, '{}'::jsonb) || jsonb_build_object('mode', g.mode, 'won', g.won, 'score', g.points, 'opponent_score', g.opponent_points,
                                           'ruthless', g.ruthless, 'earns_xp', g.earns_xp) as detail
  from public.game_results g
  where g.source = 'server' or (g.source = 'app' and g.mode = 'bot')
  union all
  select b.user_id,
         b.created_at,
         b.kind,
         null,
         b.game_ref,
         b.points,
         true,
         null,
         null,
         jsonb_build_object('day', b.day)
  from public.xp_bonuses b;

revoke all on public.xp_ledger from public, anon, authenticated;
grant select on public.xp_ledger to service_role;

-- One account: what its games and bonuses add up to, and how many of its games have no points written (recorded
-- before the ledger and not backfilled: the sum is short by what they paid).
create or replace function public.xp_ledger_report(uid uuid)
returns table (game_xp bigint, bonus_xp bigint, ledger_xp bigint, legacy_games bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with g as (
    select coalesce(sum(x.xp_delta) filter (where x.earns_xp or x.abandoned), 0)::bigint as pts,
           count(*) filter (where x.xp_delta is null and (x.source = 'server' or (x.mode = 'bot' and x.won and not x.from_guest)))::bigint as legacy
    from public.game_results x
    where x.user_id = uid and (x.source = 'server' or (x.source = 'app' and x.mode = 'bot'))
  ), b as (
    select coalesce(sum(y.points), 0)::bigint as pts from public.xp_bonuses y where y.user_id = uid
  )
  select g.pts, b.pts, g.pts + b.pts, g.legacy from g, b;
$$;

revoke all on function public.xp_ledger_report(uuid) from public, anon, authenticated;
grant execute on function public.xp_ledger_report(uuid) to service_role;

-- Every account where the ledger's sum is not what the leaderboard counts for all time (weekly_leaderboard, which
-- counts the same rows by the same rates as accountStats): after the backfill, none. diff = recomputed - ledger.
create or replace function public.xp_ledger_audit()
returns table (user_id uuid, recomputed bigint, ledger bigint, diff bigint, legacy_games bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with l as (
    select u.id as user_id,
           coalesce(sum(g.xp_delta) filter (where g.earns_xp or g.abandoned), 0) + coalesce((select sum(b.points) from public.xp_bonuses b where b.user_id = u.id), 0) as ledger_xp,
           count(g.id) filter (where g.xp_delta is null and (g.source = 'server' or (g.mode = 'bot' and g.won and not g.from_guest))) as legacy_games
    from auth.users u
    left join public.game_results g on g.user_id = u.id and (g.source = 'server' or (g.source = 'app' and g.mode = 'bot'))
    group by u.id
  ), w as (
    select * from public.weekly_leaderboard(to_timestamp(0), 2147483647, null)
  )
  select l.user_id, w.points, l.ledger_xp, w.points - l.ledger_xp, l.legacy_games
  from l join w on w.user_id = l.user_id
  where w.points is distinct from l.ledger_xp
  order by abs(w.points - l.ledger_xp) desc;
$$;

revoke all on function public.xp_ledger_audit() from public, anon, authenticated;
grant execute on function public.xp_ledger_audit() to service_role;
