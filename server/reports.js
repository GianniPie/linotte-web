//----------- REPORTING A PLAYER ---------------
// "Report" on the opponent's card in an online game: a reason from a short list, kept in Supabase's reports
// table (supabase/reports.sql) for the owner to read. Stores and the players expect a way to say that
// someone behaved badly; blocking exists for friends, this is for anyone met in a game. Nothing happens
// to the reported player by itself: a person looks.

import { SUPABASE_URL } from "../public/shared/accounts.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
// What a player can really do to another here: the name is the only free text, and the reactions can annoy.
// (The server plays the rules, so there is no cheating to report, and leaving costs points by itself.)
export const REPORT_REASONS = ["name", "emoji", "other"];

// One report per reporter per game and player, and a few an hour: a report that costs the reader time can't be spammed.
export function createReportBook({ perHour = 6, now = Date.now } = {}) {
  const sent = new Map(); // reporter -> [timestamps]
  const pairs = new Set(); // reporter|room|reported
  return {
    take(reporter, room, reported) {
      const key = `${reporter}|${room}|${reported}`;
      if (pairs.has(key)) return "again";
      const t = now(), recent = (sent.get(reporter) || []).filter((x) => t - x < 3600_000);
      if (recent.length >= perHour) { sent.set(reporter, recent); return "slow_down"; }
      recent.push(t);
      sent.set(reporter, recent);
      pairs.add(key);
      return "ok";
    },
  };
}

// Never throws (a lost report must not hurt the game); true when it was kept.
export async function saveReport(report, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  if (!REPORT_REASONS.includes(report.reason)) return false;
  if (!key || !url) {
    console.log("report (no database):", JSON.stringify(report));
    return true;
  }
  try {
    const res = await fetchImpl(`${url}/rest/v1/reports`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        reporter: report.reporter || null, reporter_player: report.reporterPlayer || null,
        reported_user: report.reportedUser || null, reported_player: report.reportedPlayer || null,
        reported_name: String(report.reportedName || "").slice(0, 24) || null,
        room_id: report.roomId || null, reason: report.reason,
      }),
    });
    if (!res.ok) console.error("report not saved: Supabase answered", res.status);
    return res.ok;
  } catch (err) {
    console.error("report not saved:", err.message);
    return false;
  }
}
