//----------- REPORTING A PLAYER ---------------
// "Report" on the opponent's card in an online game: a reason from a short list, kept in Supabase's reports
// table (supabase/reports.sql) for the owner to read. Stores and the players expect a way to say that
// someone behaved badly; blocking exists for friends, this is for anyone met in a game. Nothing happens
// to the reported player by itself: a person looks.

import { SUPABASE_URL } from "../public/shared/accounts.js";
import { sendPlainMail, emailOf } from "./feedback.js";
import { experience } from "./results.js";
import { levelOf } from "../public/shared/level.js";

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
      headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        reporter: report.reporter || null, reporter_player: report.reporterPlayer || null,
        reported_user: report.reportedUser || null, reported_player: report.reportedPlayer || null,
        reported_name: String(report.reportedName || "").slice(0, 24) || null,
        room_id: report.roomId || null, reason: report.reason,
      }),
    });
    if (!res.ok) { console.error("report not saved: Supabase answered", res.status); return false; }
    const rows = typeof res.json === "function" ? await res.json().catch(() => null) : null;
    return (Array.isArray(rows) && rows[0]?.id) || true; // the row's id (for the mail), or just true
  } catch (err) {
    console.error("report not saved:", err.message);
    return false;
  }
}

//----------- THE NAME TAKEN AWAY BY ITSELF ---------------
// A name reported as offensive by 3 different signed-in players within 24 hours is taken away (the player then
// plays as a random animal name and is asked for a new one, with the once-a-day limit still in force). Only
// accounts count: guests are made in seconds, so a few of them could not be allowed to silence anyone. The
// reports that counted are marked as dealt with, so the next name starts from zero, and the owner is told in the
// mail, with the way to put the name back. Nothing else is done to the player.
export const AUTO_REMOVE_REPORTS = 3;
export const AUTO_REMOVE_WINDOW_MS = 24 * 3600_000;

// Never throws. { removed: true, previousName, reporters } when the name was taken away, else { removed: false }.
export async function autoRemoveName(userId, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch, now = Date.now, needed = AUTO_REMOVE_REPORTS } = {}) {
  const none = { removed: false };
  if (!userId || !key || !url) return none;
  const headers = { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" };
  try {
    const since = new Date(now() - AUTO_REMOVE_WINDOW_MS).toISOString();
    const res = await fetchImpl(`${url}/rest/v1/reports?reported_user=eq.${encodeURIComponent(userId)}&reason=eq.name&handled=eq.false&reporter=not.is.null&created_at=gte.${encodeURIComponent(since)}&select=id,reporter`, { headers });
    if (!res.ok) return none;
    const rows = await res.json();
    const reporters = new Set(rows.map((r) => r.reporter));
    if (reporters.size < needed) return none;
    const profileRes = await fetchImpl(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=name&limit=1`, { headers });
    const previousName = profileRes.ok ? (await profileRes.json())[0]?.name || "" : "";
    if (!previousName) return none; // already without a name: nothing to take away
    const stamp = new Date(now()).toISOString();
    const clear = (fields) => fetchImpl(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", headers, body: JSON.stringify({ name: null, updated_at: stamp, ...fields }) });
    let cleared = await clear({ name_removed_at: stamp }); // tells the app why the name is gone
    if (!cleared.ok) cleared = await clear({}); // supabase/profiles_name_limit.sql not run again yet: the column isn't there
    if (!cleared.ok) { console.error("name not taken away: Supabase answered", cleared.status); return none; }
    await fetchImpl(`${url}/rest/v1/reports?id=in.(${rows.map((r) => encodeURIComponent(r.id)).join(",")})`, { method: "PATCH", headers, body: JSON.stringify({ handled: true }) });
    return { removed: true, previousName, reporters: reporters.size };
  } catch (err) {
    console.error("automatic name removal failed:", err.message);
    return none;
  }
}

//----------- THE MAIL FOR EACH REPORT ---------------
// Every report that is kept is also mailed to the project's address (the same one and the same sender as the
// problem reports, see feedback.js), with everything known about both players and what to do about it: a link
// that opens Supabase's SQL editor with the query already written (press Run), the same query to copy, and the
// terminal command (scripts/moderate.mjs). Nothing happens to the reported player by itself.
const REASON_TEXT = { name: "OFFENSIVE NAME", emoji: "ANNOYING REACTIONS", other: "SOMETHING ELSE" };
const projectRef = (url) => { try { return new URL(url).hostname.split(".")[0]; } catch { return ""; } };
const quote = (v) => String(v).replace(/'/g, "''");

export function buildReportMail({ id = "", reason, when = new Date().toISOString(), roomId = "", reporter = {}, reported = {}, auto = null }, { url = SUPABASE_URL } = {}) {
  const ref = projectRef(url);
  const who = (p) => (p.userId ? `account ${p.userId}` : `guest (device ${p.playerId || "?"})`);
  const lines = [];
  if (auto?.removed) {
    lines.push(`AUTOMATIC: the name "${auto.previousName}" was taken away, after ${auto.reporters} different players reported it as offensive within 24 hours.`);
    lines.push("The player plays as a random animal name until they choose a new one (once a day at most). If it was a mistake, put the name back:");
    lines.push(`   update public.profiles set name = '${quote(auto.previousName)}' where id = '${quote(reported.userId)}';`);
    lines.push("");
  }
  lines.push(`Reason: ${REASON_TEXT[reason] || reason}`);
  lines.push(`When: ${when}`);
  lines.push(`Game room: ${roomId || "?"}`);
  lines.push("");
  lines.push("----- Reported player -----");
  lines.push(`Shown as: ${reported.shownName || "?"}`);
  lines.push(`Who: ${who(reported)}`);
  if (reported.userId) {
    lines.push(`Name stored in the profile: ${reported.rawName ? `"${reported.rawName}"` : "(none)"}${reported.rawName && reported.rawName !== reported.shownName ? "   <- what the game shows instead is the shown name above" : ""}`);
    if (reported.email) lines.push(`E-mail: ${reported.email}`);
    if (reported.country) lines.push(`Country: ${reported.country}`);
    if (reported.level !== undefined) lines.push(`Level: ${reported.level} (${reported.xp} points)`);
  }
  lines.push("");
  lines.push("----- Reported by -----");
  lines.push(`Shown as: ${reporter.shownName || "?"}`);
  lines.push(`Who: ${who(reporter)}`);
  if (reporter.email) lines.push(`E-mail: ${reporter.email}`);
  lines.push("");
  let link = "";
  if (reported.userId) {
    const rename = `update public.profiles set name = null where id = '${quote(reported.userId)}';`;
    const history = `select created_at, reason, reported_name, reporter, handled from public.reports where reported_user = '${quote(reported.userId)}' order by created_at desc;`;
    const handled = id ? `update public.reports set handled = true where id = '${quote(id)}';` : "";
    link = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new?content=${encodeURIComponent(`${rename}\n${handled}`.trim())}` : "";
    lines.push("----- To take the name away (the player then plays as a random animal name) -----");
    if (link) lines.push(`1. Open this link (Supabase's SQL editor, the query is already there) and press Run:\n   ${link}`);
    lines.push(`${link ? "2" : "1"}. Or paste this in the SQL editor:\n   ${rename}`);
    if (handled) lines.push(`   ${handled}   (marks this report as dealt with)`);
    lines.push(`${link ? "3" : "2"}. Or from a terminal (with SUPABASE_SECRET_KEY set):\n   node scripts/moderate.mjs rename ${reported.userId} --handled ${id || "<report id>"}`);
    lines.push("");
    lines.push("To give them a name of your choice instead, replace null with 'NewName' (3 to 12 characters).");
    lines.push("Their other reports:");
    lines.push(`   ${history}`);
  } else {
    lines.push("The reported player is a guest: there is no profile to change, and the name shown was the random animal name.");
    if (id) lines.push(`Mark this report as dealt with:\n   update public.reports set handled = true where id = '${quote(id)}';`);
  }
  const subject = auto?.removed
    ? `[Linotte report] NAME REMOVED automatically · ${auto.previousName}`
    : `[Linotte report] ${REASON_TEXT[reason] || reason} · ${reported.shownName || "?"}`;
  return { subject, text: lines.join("\n") + "\n", link };
}

// Reads what the mail needs about the two players (never throws) and sends it. Fire and forget.
export async function notifyReport(info, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch, send = sendPlainMail } = {}) {
  try {
    const options = { key, url, fetch: fetchImpl };
    const rawName = async (userId) => {
      if (!userId || !key || !url) return null;
      try {
        const res = await fetchImpl(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=name,country&limit=1`, { headers: { apikey: key } });
        return res.ok ? (await res.json())[0] || null : null;
      } catch { return null; }
    };
    const { reported = {}, reporter = {} } = info;
    // First the action, then the mail that tells about it.
    const auto = info.reason === "name" && reported.userId ? await autoRemoveName(reported.userId, options) : { removed: false };
    const [profile, reportedEmail, reporterEmail, xp] = await Promise.all([
      rawName(reported.userId), emailOf(reported.userId, options), emailOf(reporter.userId, options),
      reported.userId ? experience(reported.userId, options).catch(() => undefined) : undefined,
    ]);
    const mail = buildReportMail({
      ...info,
      reported: { ...reported, rawName: profile?.name || "", country: profile?.country || "", email: reportedEmail, xp, level: xp === undefined ? undefined : levelOf(xp) },
      reporter: { ...reporter, email: reporterEmail },
      auto,
    }, { url });
    return await send(mail.subject, mail.text);
  } catch (err) {
    console.error("report mail failed:", err.message);
    return false;
  }
}
