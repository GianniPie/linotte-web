//----------- EXPERIENCE AND LEVEL ---------------
// The number on a player's badge is a level, from their experience points:
// +1 per online win (random or friend: games recorded by the server), +1
// for every 5 wins against the bot (recorded by the app, so worth less), and
// -2 for every online game abandoned before its end (left, or gone for good
// after a disconnection). Draws and losses don't count. Points and level can
// go below zero. Counted by the server for an account (results.js); a
// guest's level lives on its phone only and is never moved to an account.
export const BOT_WINS_PER_POINT = 5;
export const ABANDON_PENALTY = 2;

// Each level takes one point more than the one before: level 0 at 0 points,
// 1 at 1, 2 at 3, 3 at 6, 4 at 10, 10 at 55. Below zero, the same steps
// downwards: -1 at -1, -2 at -3, -3 at -6.
export function levelOf(xp) {
    const n = Math.trunc(Number(xp) || 0);
    if (n < 0) return -levelOf(-n);
    return Math.floor((Math.sqrt(1 + 8 * n) - 1) / 2);
}

const triangle = (l) => (l * (l + 1)) / 2;

// The lowest points of a level: where it starts, counting upwards.
export function levelStart(level) {
    const l = Math.trunc(level);
    return l >= 0 ? triangle(l) : -(triangle(-l + 1) - 1);
}
