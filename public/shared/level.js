//----------- EXPERIENCE AND LEVEL ---------------
// The number on a player's badge is a level, from their experience points:
// 1 point per online win (random or friend: games recorded by the server)
// and 1 for every 5 wins against the bot (recorded by the app, so worth
// less). Draws and losses don't count. Counted by the server (results.js).
export const BOT_WINS_PER_POINT = 5;

// Each level takes one point more than the one before: level 1 at 0 points,
// 2 at 1, 3 at 3, 4 at 6, 5 at 10, 10 at 45, 20 at 190.
export function levelOf(xp) {
    const n = Math.max(0, Math.floor(Number(xp) || 0));
    return Math.floor((1 + Math.sqrt(1 + 8 * n)) / 2);
}

// The points a level starts at.
export function pointsForLevel(level) {
    const l = Math.max(1, Math.floor(level));
    return (l * (l - 1)) / 2;
}
