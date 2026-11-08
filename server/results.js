//----------- GAME RESULTS (STATS) ---------------
// When an online game ends, each signed-in player in it gets a row in
// Supabase's game_results table (supabase/game_results.sql), marked as
// written by the server. That takes the project's secret key, which only the
// server has: set SUPABASE_SECRET_KEY on Render (Supabase > Project Settings >
// API Keys > Secret keys). Without it nothing is recorded (a local run).

import { SUPABASE_URL } from "../public/shared/accounts.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

// The rows for one finished room: one per signed-in human seat.
export function resultRows(room) {
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
