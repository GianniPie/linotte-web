-- Points mode against the bot, and the bonus counted in one place (2.29).
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor -- BEFORE
-- deploying the app and server that use it. (game_results_bonus.sql comes first.)
--
-- A win against the bot pays 1 point and, on top of it, bonus_xp: the speed bonus in speed
-- mode (0 to 4), or in points mode the rest of the winning margin (the pure difference in
-- points, minus the 1), which can be larger. So bonus_xp may go up to 40 now (it was 3).
-- strategy: the mode the game was played in, kept to compare the two from real games.
-- bot_bonus_xp(uid): the account's bonus points from its wins against the bot, summed in
-- one place for the server (server/results.js), instead of one count per value.

alter table public.game_results drop constraint if exists game_results_bonus_xp_check;
alter table public.game_results add constraint game_results_bonus_xp_check check (bonus_xp between 0 and 40);

alter table public.game_results add column if not exists strategy text check (strategy is null or strategy in ('speed', 'points'));
grant insert (strategy) on public.game_results to authenticated;

create or replace function public.bot_bonus_xp(uid uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(g.bonus_xp), 0)::bigint
  from public.game_results g
  where g.user_id = uid and g.source = 'app' and g.mode = 'bot' and g.won
    and not g.from_guest and g.earns_xp;
$$;

revoke all on function public.bot_bonus_xp(uuid) from public, anon, authenticated;
grant execute on function public.bot_bonus_xp(uuid) to service_role;
