//----------- GAME RESULTS (STATS) ---------------
// When an online game ends, each signed-in player in it gets a row in
// Supabase's game_results table (supabase/game_results.sql), marked as
// written by the server. That takes the project's secret key, which only the
// server has: set SUPABASE_SECRET_KEY on Render (Supabase > Project Settings >
// API Keys > Secret keys). Without it nothing is recorded (a local run).

import { SUPABASE_URL } from "../public/shared/accounts.js";
import { bonusPoints } from "./bonuses.js";
import { ONLINE_WIN_POINTS, ONLINE_FINISHED_POINTS, BOT_WIN_POINTS, ABANDON_PENALTY, ONLINE_RATES_FROM, MODE_RUTHLESS, LEGACY_ONLINE, onlinePayout, onlineMarginExtra } from "../public/shared/level.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

// The rows for one finished room: one per signed-in human seat. `held` are
// the seats whose game's points wait for the video the app plays first (see
// Lobby#claimPoints): the game is recorded, the points are counted once the
// video has been watched (earns_xp).
export function resultRows(room, held = new Set()) {
  const rows = [];
  const mode = room.kind === "private" ? "friend" : "random";
  const ruthless = room.mode === MODE_RUTHLESS;
  for (const seat of [1, 2]) {
    const me = room.seats[seat];
    const other = room.seats[seat === 1 ? 2 : 1];
    if (me?.kind !== "human" || !me.userId || !room.state) continue;
    const won = room.winner === seat;
    const points = clampPoints(room.state.players[seat]?.points);
    const opponentPoints = clampPoints(room.state.players[seat === 1 ? 2 : 1]?.points);
    // Left or gone for good before the end: costs level points.
    const abandoned = room.forfeitedBy === seat;
    rows.push({
      user_id: me.userId,
      mode,
      won,
      points,
      opponent_points: opponentPoints,
      opponent: String(other?.name || "").slice(0, 24) || null,
      abandoned,
      earns_xp: !held.has(seat),
      ruthless, // only the points the game was won or lost by count (supabase/online_margin.sql)
      source: "server",
      ...ledgerFields(room, seat, { won, abandoned, points, opponentPoints, ruthless }),
    });
  }
  return rows;
}

//--------- THE LEDGER (what a game paid) ---------
// Written once with the game's row (supabase/xp_ledger.sql), from the same rules the level is
// counted by (shared/level.js), and never recomputed: if the rates change, old games keep what they paid.
//   xp_delta   the points the game pays when it counts (earns_xp, or abandoned): +4 / +2 / -3, or the
//              Ruthless margin. It is paid whole here: the held ones (earns_xp false) count it once the video is watched.
//   xp_detail  how it was made: { reason: win | finished | abandoned, flat, margin } (margin: what Ruthless adds to the flat rate)
//   exit       how this player's game ended: played (to the end), abandoned (they left, were gone or idle: costs points),
//              excused (they left a game whose opponent was gone or idle already: costs nothing), opponent_gone (they
//              stayed and the opponent left, was gone or idled out: a win by it, whoever was to blame)
//   exit_reason  left | idle | disconnect, for any exit but played
//   game_ref   the room's id for the database: the daily bonus it paid (xp_bonuses.game_ref) carries it too
// The daily bonus is not here: it is written on its own, when it is given (bonuses.js).
function ledgerFields(room, seat, { won, abandoned, points, opponentPoints, ruthless }) {
  const leaver = room.leaver || null;
  const exit = !leaver ? "played" : leaver.seat === seat ? (abandoned ? "abandoned" : "excused") : "opponent_gone";
  const flat = abandoned ? -ABANDON_PENALTY : won ? ONLINE_WIN_POINTS : ONLINE_FINISHED_POINTS;
  return {
    xp_delta: onlinePayout({ won, abandoned, points, opponentPoints, ruthless }),
    xp_detail: { reason: abandoned ? "abandoned" : won ? "win" : "finished", flat, margin: onlineMarginExtra({ won, abandoned, points, opponentPoints, ruthless }) },
    exit,
    exit_reason: leaver?.reason || null,
    game_ref: room.gameRef || null,
  };
}
const LEDGER_COLUMNS = ["xp_delta", "xp_detail", "exit", "exit_reason", "game_ref"];

const clampPoints = (n) => Math.max(0, Math.min(999, Math.round(Number(n) || 0)));

let warned = false;

// Sends the rows; never throws (a lost stat must not hurt the game).
export async function recordResults(rows, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  if (!rows.length) return false;
  if (!key || !url) {
    if (!warned) console.log("stats: SUPABASE_SECRET_KEY not set, online results are not recorded");
    warned = true;
    return false;
  }
  try {
    const post = (body) => fetchImpl(`${url}/rest/v1/game_results`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    let res = await post(rows);
    // Before supabase/xp_ledger.sql is run the ledger's columns don't exist (400): the game must still be recorded, without them.
    if (res.status === 400 && rows.some((r) => r.xp_delta !== undefined)) {
      console.error("stats: the ledger columns are missing (xp_ledger.sql run?), recording the games without them:", await res.text().catch(() => ""));
      res = await post(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !LEDGER_COLUMNS.includes(k)))));
    }
    if (!res.ok) console.error("stats: Supabase answered", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("stats not recorded:", err.message);
    return false;
  }
}

// The video was watched: the account's games recorded since `since` that were
// waiting for it now count for its points. Never throws.
export async function claimGameXp(userId, since, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  if (!userId || !key || !url) return false;
  try {
    const query = `user_id=eq.${encodeURIComponent(userId)}&source=eq.server&earns_xp=is.false&played_at=gte.${encodeURIComponent(new Date(since).toISOString())}`;
    const res = await fetchImpl(`${url}/rest/v1/game_results?${query}`, {
      method: "PATCH",
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ earns_xp: true }),
    });
    if (!res.ok) console.error("points not claimed: Supabase answered", res.status);
    return res.ok;
  } catch (err) {
    console.error("points not claimed:", err.message);
    return false;
  }
}

// The account's experience points (see public/shared/level.js): its online
// games (only those recorded by the server, so they can't be raised by
// tampering with the app) -- 4 per win, 2 per loss or draw played to the end
// (once the video that pays them has been watched: earns_xp), minus 3 per
// game abandoned (games played before ONLINE_RATES_FROM keep the old 2 / 1 / -2) -- one for every 5 wins against the bot played
// while signed in (not the guest games moved in at sign-in), and its bonuses
// (bonuses.js). With it, the online record that goes on the player card:
// games played (abandoned ones count, as losses) and won. Zeros without the
// secret key; when Supabase can't be read, "unknown" (xp null), so the app
// keeps the level it had instead of showing level 0.
const NONE = { xp: 0, record: { played: 0, won: 0 } };
const UNKNOWN = { xp: null, record: null };
// The sum of bonus_xp over the account's recorded wins against the bot.
async function botBonusXp(userId, { key, url, fetch: fetchImpl }) {
  const res = await fetchImpl(`${url}/rest/v1/rpc/bot_bonus_xp`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ uid: userId }),
  });
  if (res.ok === false) throw new Error(`Supabase answered ${res.status}`);
  const total = Number(await res.json());
  return Number.isFinite(total) ? total : 0;
}

// What the Ruthless online games were won or lost by, summed by the database (online_margin_xp in
// supabase/online_margin.sql): what turns the flat +4 / +2 / -3 counted below into the Ruthless rule (the margin alone).
async function onlineMarginXp(userId, { key, url, fetch: fetchImpl }) {
  const res = await fetchImpl(`${url}/rest/v1/rpc/online_margin_xp`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ uid: userId }),
  });
  if (res.ok === false) throw new Error(`Supabase answered ${res.status}`);
  const total = Number(await res.json());
  return Number.isFinite(total) ? total : 0;
}

export async function accountStats(userId, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  if (!userId || !key || !url) return NONE;
  const count = async (filter) => {
    const query = `user_id=eq.${encodeURIComponent(userId)}&${filter}&select=id`;
    const res = await fetchImpl(`${url}/rest/v1/game_results?${query}`, {
      method: "HEAD",
      headers: { apikey: key, Prefer: "count=exact", Range: "0-0" },
    });
    if (res.ok === false) throw new Error(`Supabase answered ${res.status}`);
    // "0-0/42", or "*/0" when there are none
    const total = Number((res.headers.get("content-range") || "").split("/")[1]);
    return Number.isFinite(total) ? total : 0;
  };
  try {
    const since = encodeURIComponent(ONLINE_RATES_FROM);
    const old = `played_at=lt.${since}`, now = `played_at=gte.${since}`; // before / since the rates went up
    const [wins, finished, winsOld, finishedOld, abandonedOld, winsNew, finishedNew, abandonedNew, bot, bonus, botBonus, margin] = await Promise.all([
      count("source=eq.server&won=is.true"),
      count("source=eq.server&won=is.false&abandoned=is.false"),
      count(`source=eq.server&won=is.true&earns_xp=is.true&${old}`),
      count(`source=eq.server&won=is.false&abandoned=is.false&earns_xp=is.true&${old}`),
      count(`source=eq.server&abandoned=is.true&${old}`),
      count(`source=eq.server&won=is.true&earns_xp=is.true&${now}`),
      count(`source=eq.server&won=is.false&abandoned=is.false&earns_xp=is.true&${now}`),
      count(`source=eq.server&abandoned=is.true&${now}`),
      count("source=eq.app&mode=eq.bot&won=is.true&from_guest=is.false&earns_xp=is.true"),
      bonusPoints(userId, { key, url, fetch: fetchImpl }),
      // What the wins against the bot paid on top of their 1 point: the speed bonus, or the rest
      // of the winning margin in points mode (summed by the database, see game_results_points.sql).
      botBonusXp(userId, { key, url, fetch: fetchImpl }),
      // Without the function (supabase/online_margin.sql not run yet) the margin is left out, not the whole level.
      onlineMarginXp(userId, { key, url, fetch: fetchImpl }).catch((err) => { console.error("online margin not counted (online_margin.sql run?):", err.message); return 0; }),
    ]);
    const abandoned = abandonedOld + abandonedNew;
    return {
      xp: LEGACY_ONLINE.win * winsOld + LEGACY_ONLINE.finished * finishedOld - LEGACY_ONLINE.abandon * abandonedOld
        + ONLINE_WIN_POINTS * winsNew + ONLINE_FINISHED_POINTS * finishedNew - ABANDON_PENALTY * abandonedNew
        + margin + BOT_WIN_POINTS * bot + botBonus + bonus,
      record: { played: wins + finished + abandoned, won: wins },
    };
  } catch (err) {
    console.error("experience not counted:", err.message);
    return UNKNOWN;
  }
}

export async function experience(userId, options) {
  return (await accountStats(userId, options)).xp ?? 0;
}

// The ledger against the level: what the account's recorded points add up to (supabase/xp_ledger.sql,
// xp_ledger_report) next to the experience accountStats counts from the same rows. They are two ways to the
// same number, so the difference should be 0. `legacyGames` are games recorded before the ledger existed
// (no xp_delta: run xp_ledger_backfill.sql); until then the difference is theirs. Never throws:
// { error } when it can't be read, { xp: null } when the experience can't be.
export async function ledgerReport(userId, options = {}) {
  const { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = options;
  if (!userId || !key || !url) return { error: "no secret key" };
  try {
    const [stats, res] = await Promise.all([
      accountStats(userId, options),
      fetchImpl(`${url}/rest/v1/rpc/xp_ledger_report`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ uid: userId }),
      }),
    ]);
    if (res.ok === false) throw new Error(`Supabase answered ${res.status} (xp_ledger.sql run?)`);
    const body = await res.json();
    const row = Array.isArray(body) ? body[0] : body;
    const ledger = { games: Number(row?.game_xp) || 0, bonuses: Number(row?.bonus_xp) || 0, total: Number(row?.ledger_xp) || 0 };
    const legacyGames = Number(row?.legacy_games) || 0;
    const diff = stats.xp === null ? null : stats.xp - ledger.total;
    return { userId, xp: stats.xp, ledger, legacyGames, diff, match: diff === 0 };
  } catch (err) {
    return { error: err.message };
  }
}
