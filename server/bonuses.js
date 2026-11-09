//----------- BONUS POINTS AND THE WEEKLY LEADERBOARD ---------------
// Level points that don't come from a game (see public/shared/level.js),
// one row each in Supabase's xp_bonuses table (supabase/xp_bonuses.sql),
// written by the server only:
//   daily  the first online win of the day (UTC), +2
//   ad     a rewarded ad watched to the end, +1, up to 5 a day
// And the weekly leaderboard: online points (wins, games played to the end,
// abandons) plus bonuses since Monday 00:00 UTC, from the
// weekly_leaderboard function. Without the secret key (a local run) there
// are no bonuses and no leaderboard.

import { SUPABASE_URL } from "../public/shared/accounts.js";
import { DAILY_BONUS_POINTS, AD_REWARD_POINTS, AD_REWARDS_PER_DAY } from "../public/shared/level.js";
import { nameFromId } from "./names.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

const today = (now = new Date()) => now.toISOString().slice(0, 10); // UTC day

// Monday 00:00 UTC of this week.
export function weekStart(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

function client({ key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  if (!key || !url) return null;
  const headers = { apikey: key, "Content-Type": "application/json" };
  return {
    async count(filter) {
      const res = await fetchImpl(`${url}/rest/v1/xp_bonuses?${filter}&select=id`, {
        method: "HEAD", headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
      });
      if (res.ok === false) throw new Error(`Supabase answered ${res.status}`);
      const total = Number((res.headers.get("content-range") || "").split("/")[1]);
      return Number.isFinite(total) ? total : 0;
    },
    // true if the row went in; false if refused (e.g. today's daily already there)
    async add(row) {
      const res = await fetchImpl(`${url}/rest/v1/xp_bonuses`, {
        method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(row),
      });
      return res.ok;
    },
    async rpc(name, args) {
      const res = await fetchImpl(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(args) });
      if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
      return res.json();
    },
  };
}

// The account's bonus points, for its experience (results.js).
export async function bonusPoints(userId, options) {
  const db = client(options);
  if (!db || !userId) return 0;
  const id = encodeURIComponent(userId);
  const [daily, ads] = await Promise.all([db.count(`user_id=eq.${id}&kind=eq.daily`), db.count(`user_id=eq.${id}&kind=eq.ad`)]);
  return DAILY_BONUS_POINTS * daily + AD_REWARD_POINTS * ads;
}

// What's left today: the daily bonus (not yet won?) and rewarded ads.
export async function todayStatus(userId, options) {
  const db = client(options);
  if (!db || !userId) return { dailyDone: false, adsLeft: 0 };
  const id = encodeURIComponent(userId);
  try {
    const [daily, ads] = await Promise.all([
      db.count(`user_id=eq.${id}&kind=eq.daily&day=eq.${today()}`),
      db.count(`user_id=eq.${id}&kind=eq.ad&day=eq.${today()}`),
    ]);
    return { dailyDone: daily > 0, adsLeft: Math.max(0, AD_REWARDS_PER_DAY - ads) };
  } catch (err) {
    console.error("today's bonuses not read:", err.message);
    return { dailyDone: true, adsLeft: 0 };
  }
}

// After an online win: today's first? (The table allows one daily row per
// account and day, so two wins at once can't both get it.)
export async function grantDailyBonus(userId, options) {
  const db = client(options);
  if (!db || !userId) return false;
  try {
    return await db.add({ user_id: userId, kind: "daily", points: DAILY_BONUS_POINTS, day: today() });
  } catch (err) {
    console.error("daily bonus not given:", err.message);
    return false;
  }
}

// A rewarded ad watched to the end: +1, while today's ads last.
export async function grantAdReward(userId, options) {
  const db = client(options);
  if (!db || !userId) return { ok: false, adsLeft: 0 };
  const { adsLeft } = await todayStatus(userId, options);
  if (adsLeft <= 0) return { ok: false, adsLeft: 0 };
  const ok = await db.add({ user_id: userId, kind: "ad", points: AD_REWARD_POINTS, day: today() });
  return { ok, adsLeft: ok ? adsLeft - 1 : adsLeft };
}

// The top players and the asking player's own place: this week's
// ("week", since Monday) or of all time ("all").
export async function weeklyLeaderboard(userId, { top = 50, range = "week", ...options } = {}) {
  const db = client(options);
  const since = range === "all" ? new Date(0) : weekStart();
  if (!db) return { since: since.toISOString(), rows: [], me: null };
  const rows = await db.rpc("weekly_leaderboard", { since: since.toISOString(), max_rows: top, me: userId || null });
  const list = rows.map((r) => ({
    rank: Number(r.rank),
    name: r.name || nameFromId(r.user_id),
    country: r.country || "",
    points: Number(r.points),
    me: Boolean(userId) && r.user_id === userId,
  }));
  return { since: since.toISOString(), rows: list.filter((r) => r.rank <= top), me: list.find((r) => r.me) || null };
}
