-- The speed bonus of a win against the bot, and the turns of each game (2.28).
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor -- BEFORE
-- deploying the app and server that write and read these columns.
--
-- bonus_xp: the bonus points a win against the bot in speed mode earned for being
--   quick (0 to 3, see speedBonus in public/shared/level.js). The app writes it with
--   its own bot games (the same trust as the bot wins themselves); the server adds it
--   up in the level (server/results.js).
-- turns: the player's own turns in a game against the bot, kept so the bonus's steps
--   can be set again from real games.
-- Every game from before has 0 and no turns: nothing changes for them.

alter table public.game_results add column if not exists bonus_xp smallint not null default 0 check (bonus_xp between 0 and 3);
alter table public.game_results add column if not exists turns smallint check (turns is null or turns between 0 and 999);

grant insert (bonus_xp, turns) on public.game_results to authenticated;
