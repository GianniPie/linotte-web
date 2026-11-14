//----------- GAME RESULTS (STATS) ---------------
// When an online game ends, each signed-in player in it gets a row in
// Supabase's game_results table (supabase/game_results.sql), marked as
// written by the server. That takes the project's secret key, which only the
// server has: set SUPABASE_SECRET_KEY on Render (Supabase > Project Settings >
// API Keys > Secret keys). Without it nothing is recorded (a local run).

import { SUPABASE_URL } from "../public/shared/accounts.js";
import { bonusPoints } from "./bonuses.js";
import { ONLINE_WIN_POINTS, ONLINE_FINISHED_POINTS, BOT_WINS_PER_POINT, ABANDON_PENALTY } from "../public/shared/level.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

// The rows for one finished room: one per signed-in human seat. `held` are
// the seats whose game's points wait for the video the app plays first (see
// Lobby#claimPoints): the game is recorded, the points are counted once the
// video has been watched (earns_xp).
export function resultRows(room, held = new Set()) {
  const rows = [];
  const mode = room.kind === "private" ? "friend" : "random";
  for (const seat of [1, 2]) {
    const me = room.seats[seat];
    const other = room.seats[seat === 1 ? 2 : 1];
    if (me?.kind !== "human" || !me.userId || !room.state) continue;
    rows.push({
      user_id: me.userId,
      mode,
      won: room.winner === seat,
      points: clampPoints(room.state.players[seat]?.points),
      opponent_points: clampPoints(room.state.players[seat === 1 ? 2 : 1]?.points),
      opponent: String(other?.name || "").slice(0, 24) || null,
      // Left or gone for good before the end: costs level points.
      abandoned: room.forfeitedBy === seat,
      earns_xp: !held.has(seat),
      source: "server",
    });
  }
  return rows;
}

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
    const res = await fetchImpl(`${url}/rest/v1/game_results`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
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
// tampering with the app) -- 2 per win, 1 per loss or draw played to the end
// (once the video that pays them has been watched: earns_xp), minus 2 per
// game abandoned -- one for every 5 wins against the bot played
// while signed in (not the guest games moved in at sign-in), and its bonuses
// (bonuses.js). With it, the online record that goes on the player card:
// games played (abandoned ones count, as losses) and won. Zeros without the
// secret key; when Supabase can't be read, "unknown" (xp null), so the app
// keeps the level it had instead of showing level 0.
const NONE = { xp: 0, record: { played: 0, won: 0 } };
const UNKNOWN = { xp: null, record: null };
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
    const [wins, finished, winsXp, finishedXp, bot, abandoned, bonus] = await Promise.all([
      count("source=eq.server&won=is.true"),
      count("source=eq.server&won=is.false&abandoned=is.false"),
      count("source=eq.server&won=is.true&earns_xp=is.true"),
      count("source=eq.server&won=is.false&abandoned=is.false&earns_xp=is.true"),
      count("source=eq.app&mode=eq.bot&won=is.true&from_guest=is.false&earns_xp=is.true"),
      count("source=eq.server&abandoned=is.true"),
      bonusPoints(userId, { key, url, fetch: fetchImpl }),
    ]);
    return {
      xp: ONLINE_WIN_POINTS * winsXp + ONLINE_FINISHED_POINTS * finishedXp
        + Math.floor(bot / BOT_WINS_PER_POINT) - ABANDON_PENALTY * abandoned + bonus,
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
