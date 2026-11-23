-- OPTIONAL, after xp_ledger.sql: writes the points of the games recorded BEFORE the ledger (2.35.10).
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor. Safe to run again (it only fills xp_delta where it is null).
--
-- These games were never given an xp_delta, so the ledger of an account that played before it is short by what they
-- paid. This works it out once from the rates in force when each was played -- the same ones accountStats and the
-- leaderboard count them by (public/shared/level.js; +4 / +2 / -3 since 2026-11-17T04:33:00Z, +2 / +1 / -2 before;
-- Ruthless: the margin alone; the app's bot wins: 1 + bonus_xp) -- and marks the row xp_detail.backfilled = true, so
-- a written-at-the-time value and a reconstructed one can be told apart. It changes nobody's level: the points it
-- writes are the ones already counted. After it, `select * from xp_ledger_audit()` should return no rows.

update public.game_results g
set xp_delta = case
      when g.source = 'app' then case when g.mode = 'bot' and g.won and not g.from_guest then 1 + coalesce(g.bonus_xp, 0) else 0 end
      when g.ruthless then case
        when g.abandoned then -(6 + greatest(0, g.opponent_points - g.points))
        when g.won then greatest(1, g.points - g.opponent_points)
        else -greatest(0, g.opponent_points - g.points)
      end
      when g.played_at >= timestamptz '2026-11-17T04:33:00Z' then case when g.abandoned then -3 when g.won then 4 else 2 end
      else case when g.abandoned then -2 when g.won then 2 else 1 end
    end,
    xp_detail = jsonb_build_object('backfilled', true)
where g.xp_delta is null;
