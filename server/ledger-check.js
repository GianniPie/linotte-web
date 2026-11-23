// Compares an account's ledger (what its games and bonuses paid, supabase/xp_ledger.sql) with the
// experience the server counts for its level (results.js accountStats). Read only.
//   SUPABASE_SECRET_KEY=... node server/ledger-check.js <user-id>   one account, with its games one by one
//   SUPABASE_SECRET_KEY=... node server/ledger-check.js --all       every account where the two disagree
import { SUPABASE_URL } from "../public/shared/accounts.js";
import { ledgerReport } from "./results.js";

const key = process.env.SUPABASE_SECRET_KEY || "";
const arg = process.argv[2];
if (!key || !arg) {
  console.error("usage: SUPABASE_SECRET_KEY=... node server/ledger-check.js <user-id> | --all");
  process.exit(2);
}
const rest = async (path, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path}: Supabase answered ${res.status} ${await res.text()}`);
  return res.json();
};

if (arg === "--all") {
  const rows = await rest("rpc/xp_ledger_audit", {});
  console.table(rows);
  console.log(rows.length ? `${rows.length} account(s) where the ledger and the level disagree` : "every account agrees");
  process.exit(rows.length ? 1 : 0);
}

const report = await ledgerReport(arg);
console.log(report);
if (!report.error) {
  const lines = await rest(`xp_ledger?user_id=eq.${encodeURIComponent(arg)}&order=at.desc&limit=30`);
  console.table(lines.map((l) => ({ at: l.at, kind: l.kind, points: l.points, counted: l.counted, exit: l.exit, detail: JSON.stringify(l.detail) })));
}
process.exit(report.error ? 1 : report.match && !report.legacyGames ? 0 : 1);
