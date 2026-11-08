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

const LOCAL_KEY = "linotte-results";
const LOCAL_MAX = 500;

function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
}
function writeLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, LOCAL_MAX))); } catch { /* storage off: nothing kept */ }
}

// A game just ended on this screen.
export async function recordGame({ mode, won, points, opponentPoints, opponent }) {
    const entry = {
        mode, won: Boolean(won), points: points | 0, opponent_points: opponentPoints | 0,
        opponent: String(opponent || "").slice(0, 24) || null, played_at: new Date().toISOString(),
    };
    if (!currentUser()) { writeLocal([entry, ...readLocal()]); return; }
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
        await addGameResults(local);
        writeLocal([]);
    } catch (err) {
        console.error("guest games not moved:", err.message);
    }
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
