//----------- STATS ---------------
// One entry per finished game: { mode, won, points, opponent_points,
// opponent, played_at }, mode being "random" / "friend" (online) or "bot".
//
// Signed in: the games live in Supabase (supabase/game_results.sql). The
// game server records the online ones itself; this module adds the games
// against the bot. A guest's games stay on this device and move to the
// account at the first sign-in. "Same table" games are not counted: there's
// no telling which of the two players is the owner of the phone.

import { currentUser, addGameResults, loadGameResults } from "./auth.js";
import { ONLINE_WIN_POINTS, ONLINE_FINISHED_POINTS, BOT_WINS_PER_POINT, ABANDON_PENALTY, DAILY_BONUS_POINTS, AD_REWARD_POINTS, AD_REWARDS_PER_DAY } from "./shared/level.js";

const LOCAL_KEY = "linotte-results";
const LOCAL_MAX = 500;

function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
}
function writeLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, LOCAL_MAX))); } catch { /* storage off: nothing kept */ }
}

// A game just ended on this screen.
export async function recordGame({ mode, won, points, opponentPoints, opponent, abandoned = false }) {
    const entry = {
        mode, won: Boolean(won), points: points | 0, opponent_points: opponentPoints | 0,
        opponent: String(opponent || "").slice(0, 24) || null, played_at: new Date().toISOString(),
    };
    if (!currentUser()) {
        writeLocal([entry, ...readLocal()]);
        // The guest's level: a bot win, or an online game played to the end
        // (the first online game of the day played to the end brings its bonus: told back).
        if (mode === "bot") { if (won) noteGuest("bot"); }
        else if (!abandoned) noteGuest(won ? "online" : "finished");
        if (mode !== "bot" && !abandoned && !guestToday().dailyDone) {
            const g = readGuest();
            writeGuest({ ...g, daily: (Number(g.daily) || 0) + 1, dailyDay: utcDay() });
            return { daily: true };
        }
        return {};
    }
    if (mode !== "bot") return; // the game server records online games
    try {
        await addGameResults([entry]);
    } catch (err) {
        console.error("game not recorded:", err.message);
        writeLocal([entry, ...readLocal()]); // tried again at the next sign-in
    }
}

// Signed in: the guest games of this device become the account's.
export async function moveLocalGamesToAccount() {
    const local = readLocal();
    if (!local.length || !currentUser()) return;
    try {
        // Into the account's stats, but not its level: the guest's games were
        // never checked by anyone (see guestXp).
        await addGameResults(local.map((g) => ({ ...g, from_guest: true })));
        writeLocal([]);
    } catch (err) {
        console.error("guest games not moved:", err.message);
    }
}

//--------- a guest's level ---------
// A guest has a level too (see shared/level.js), kept on this phone only:
// nobody can check it, so it never moves to an account. Signing in starts the
// account's own level; signing out goes back to the guest's, where it was.
const GUEST_KEY = "linotte-guest-level";
function readGuest() {
    try { return JSON.parse(localStorage.getItem(GUEST_KEY) || "{}") || {}; } catch { return {}; }
}
function writeGuest(g) {
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch { /* storage off: not kept */ }
}
function noteGuest(what) {
    const g = readGuest();
    g[what] = (Number(g[what]) || 0) + 1;
    writeGuest(g);
}
// The day is the device's own: it changes at its midnight.
const utcDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// Today's bonuses for the guest: first online game of the day played to the end, ads left.
export function guestToday() {
    const g = readGuest();
    const adsToday = g.adDay === utcDay() ? Number(g.adToday) || 0 : 0;
    return { dailyDone: g.dailyDay === utcDay(), adsLeft: Math.max(0, AD_REWARDS_PER_DAY - adsToday) };
}
// A rewarded ad watched to the end, as a guest: +1 while today's ads last.
export function guestAdReward() {
    const { adsLeft } = guestToday();
    if (adsLeft <= 0) return { ok: false, adsLeft: 0 };
    const g = readGuest();
    const adsToday = g.adDay === utcDay() ? Number(g.adToday) || 0 : 0;
    writeGuest({ ...g, ad: (Number(g.ad) || 0) + 1, adDay: utcDay(), adToday: adsToday + 1 });
    return { ok: true, adsLeft: adsLeft - 1 };
}
export function guestXp() {
    const g = readGuest();
    const n = (k) => Number(g[k]) || 0;
    return ONLINE_WIN_POINTS * n("online") + ONLINE_FINISHED_POINTS * n("finished")
        + Math.floor(n("bot") / BOT_WINS_PER_POINT) - ABANDON_PENALTY * n("abandoned")
        + DAILY_BONUS_POINTS * n("daily") + AD_REWARD_POINTS * n("ad");
}
// A guest left an online game before its end (signed in, the server counts it).
export function noteGuestAbandon() {
    if (!currentUser()) noteGuest("abandoned");
}

// Everything the Stats screen shows.
export async function loadStats() {
    const games = currentUser() ? await loadGameResults() : readLocal(); // newest first
    const byMode = (m) => summary(games.filter((g) => g.mode === m));
    return {
        all: summary(games),
        random: byMode("random"),
        friend: byMode("friend"),
        bot: byMode("bot"),
        recent: games.slice(0, 10),
        ...streaks(games),
        signedIn: Boolean(currentUser()),
    };
}

function summary(games) {
    const played = games.length;
    const won = games.filter((g) => g.won).length;
    const points = games.map((g) => g.points);
    return {
        played,
        won,
        rate: played ? Math.round((won / played) * 100) : 0,
        average: played ? Math.round(points.reduce((a, b) => a + b, 0) / played) : 0,
        best: played ? Math.max(...points) : 0,
    };
}

function streaks(games) {
    let current = 0;
    for (const g of games) { if (!g.won) break; current++; }
    let best = 0, run = 0;
    for (const g of [...games].reverse()) { run = g.won ? run + 1 : 0; best = Math.max(best, run); }
    return { streak: current, bestStreak: best };
}
