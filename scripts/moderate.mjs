// Moderation from a terminal: read the player reports, find a player and take their name away or change it.
//
//   SUPABASE_SECRET_KEY=sb_secret_... node scripts/moderate.mjs reports
//   SUPABASE_SECRET_KEY=... node scripts/moderate.mjs find BruttoDio
//   SUPABASE_SECRET_KEY=... node scripts/moderate.mjs rename <user id>              (takes the name away: the player
//                                                                                  plays as a random animal name)
//   SUPABASE_SECRET_KEY=... node scripts/moderate.mjs rename <user id> NewName      (sets a name of your choice)
//   SUPABASE_SECRET_KEY=... node scripts/moderate.mjs rename <user id> --handled <report id>   (and closes the report)
//   SUPABASE_SECRET_KEY=... node scripts/moderate.mjs handled <report id>
//   RESEND_API_KEY=re_...   node scripts/moderate.mjs test-mail        (sends a sample of the report mail)
//
// The secret key is in Supabase: Project Settings > API Keys > "secret" (the same one that is on Render as
// SUPABASE_SECRET_KEY). It can read and change everything: keep it out of the repository and out of
// shell history (export it once in the terminal session instead of writing it in each command).
// A name set from here skips the once-a-day limit (that only applies to a player's own edits) but still has to
// pass the game's name check.

import { SUPABASE_URL } from "../public/shared/accounts.js";
import { nameProblem } from "../public/shared/playerNames.js";
import { buildReportMail } from "../server/reports.js";
import { sendPlainMail } from "../server/feedback.js";

// A sample of the mail every player report sends, to see how it looks and that Resend delivers it (to the
// project's address, FEEDBACK_TO). Needs only RESEND_API_KEY; the ids in it are made up.
if (process.argv[2] === "test-mail") {
  if (!process.env.RESEND_API_KEY) {
    console.error("Set RESEND_API_KEY first (the same one that is on Render).");
    process.exit(1);
  }
  const mail = buildReportMail({
    id: "00000000-0000-4000-8000-000000000002", reason: "name", roomId: "test-room",
    reporter: { userId: null, playerId: "test-device-1", shownName: "Fox12" },
    reported: { userId: "00000000-0000-4000-8000-000000000001", playerId: "test-device-2", shownName: "Wolf7", rawName: "BruttoDio", email: "someone@example.com", country: "IT", level: 3, xp: 40 },
  });
  const sent = await sendPlainMail(`[TEST] ${mail.subject}`, `THIS IS A TEST: the ids below are made up, the query would change nobody.\n\n${mail.text}`);
  console.log(sent ? "Sent: look in the inbox of the project's address." : "Not sent: see the message above (Resend's answer).");
  process.exit(sent ? 0 : 1);
}

const key = process.env.SUPABASE_SECRET_KEY;
if (!key) {
  console.error("Set SUPABASE_SECRET_KEY first (Supabase > Project Settings > API Keys > secret).");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, ...options });
  if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const [command, ...args] = process.argv.slice(2);

if (command === "reports") {
  const rows = await rest("reports?handled=eq.false&order=created_at.desc&limit=50&select=id,created_at,reason,reported_name,reported_user,reported_player,reporter");
  if (!rows.length) console.log("No open reports.");
  for (const r of rows) {
    console.log(`${r.created_at}  ${r.reason.padEnd(5)}  ${String(r.reported_name || "?").padEnd(14)}  ${r.reported_user ? `account ${r.reported_user}` : `guest ${r.reported_player || "?"}`}\n    report ${r.id}`);
  }
} else if (command === "find") {
  const needle = args.join(" ").trim();
  if (needle.length < 2) { console.error("Give part of a name: find BruttoDio"); process.exit(1); }
  const rows = await rest(`profiles?name=ilike.*${encodeURIComponent(needle)}*&select=id,name,country&limit=20`);
  if (!rows.length) console.log("No profile has that name.");
  for (const r of rows) console.log(`${r.id}  "${r.name}"  ${r.country || ""}`);
} else if (command === "rename") {
  const [id, ...rest_] = args;
  if (!UUID.test(id || "")) { console.error("The first thing after rename is the player's id (a long code with dashes)."); process.exit(1); }
  const handledAt = rest_.indexOf("--handled");
  const reportId = handledAt >= 0 ? rest_[handledAt + 1] : "";
  const words = handledAt >= 0 ? rest_.slice(0, handledAt) : rest_;
  const name = words.join(" ").trim() || null;
  if (name && nameProblem(name)) { console.error(`That name can't be used: ${nameProblem(name)}`); process.exit(1); }
  const before = await rest(`profiles?id=eq.${id}&select=name`);
  if (!before.length) { console.error("No profile with that id (a guest has none: there is nothing to change)."); process.exit(1); }
  await rest(`profiles?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ name, updated_at: new Date().toISOString() }), headers: { ...headers, Prefer: "return=minimal" } });
  console.log(`"${before[0].name || ""}" -> ${name ? `"${name}"` : "no name (random animal name)"}`);
  if (reportId) {
    await rest(`reports?id=eq.${reportId}`, { method: "PATCH", body: JSON.stringify({ handled: true }), headers: { ...headers, Prefer: "return=minimal" } });
    console.log(`Report ${reportId} marked as dealt with.`);
  }
} else if (command === "handled") {
  if (!UUID.test(args[0] || "")) { console.error("Give the report's id: handled <report id>"); process.exit(1); }
  await rest(`reports?id=eq.${args[0]}`, { method: "PATCH", body: JSON.stringify({ handled: true }), headers: { ...headers, Prefer: "return=minimal" } });
  console.log("Marked as dealt with.");
} else {
  console.log("Commands: test-mail | reports | find <part of a name> | rename <user id> [new name] [--handled <report id>] | handled <report id>");
}
