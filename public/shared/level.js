//----------- EXPERIENCE AND LEVEL ---------------
// The number on a player's badge is a level, from their experience points.
// Online (random or friend, games recorded by the server): +2 for a win, +1
// for a loss or draw played to the end, -2 for a game abandoned before its
// end (left, gone for good after a disconnection, or 3 idle turns). Against
// the bot (recorded by the app, so worth less): +1 for every 5 wins. Points
// and level can go below zero. Counted by the server for an account
// (results.js); a guest's level lives on its phone only and is never moved
// to an account.
//
// Finishing a game is worth something even when it's lost: every game
// played to the end moves the player on, and staying beats leaving.
export const ONLINE_WIN_POINTS = 2;
export const ONLINE_FINISHED_POINTS = 1;
export const BOT_WINS_PER_POINT = 5;
export const ABANDON_PENALTY = 2;
// Bonuses (server/bonuses.js, the xp_bonuses table): the first online game of
// the day played to the end (won or lost), and watching a whole ad, a few
// times a day.
export const DAILY_BONUS_POINTS = 2;
export const AD_REWARD_POINTS = 1;
export const AD_REWARDS_PER_DAY = 5;

// Rewards for reaching a level (see LEVEL_UNLOCKS and badgeTier in linotte.js):
// the badge's colour changes at these levels.
export const BADGE_TIERS = [
    { from: 50, tier: "diamond" },
    { from: 30, tier: "ruby" },
    { from: 20, tier: "gold" },
    { from: 10, tier: "silver" },
    { from: 5, tier: "bronze" },
];
export function badgeTier(level) {
    return BADGE_TIERS.find((b) => level >= b.from)?.tier || "plain";
}

// Looks unlocked by reaching a level: option index -> level. Only the FLAT
// dice (3) and Linotte's own green background (Sun Tornado, 4) are free;
// every other one is earned, about one a level at first. The options list
// them in this order (see sortLooksByLevel in linotte.js).
export const FREE_LOOKS = { dice: 3, background: 4 };
export const LEVEL_UNLOCKS = {
    dice: { 1: 2, 2: 4, 0: 6, 4: 10, 5: 15 },
    background: { 0: 1, 1: 3, 2: 5, 3: 7, 5: 9, 6: 12, 7: 16, 8: 20 },
};
export const unlockLevel = (kind, index) => LEVEL_UNLOCKS[kind][index] ?? 0;

// What a level brings: [{ kind: "badge", tier } | { kind: "dice" | "background", index }]
export function rewardsAt(level) {
    const out = [];
    const tier = BADGE_TIERS.find((b) => b.from === level);
    if (tier) out.push({ kind: "badge", tier: tier.tier });
    for (const kind of ["dice", "background"]) {
        for (const [index, at] of Object.entries(LEVEL_UNLOCKS[kind])) if (at === level) out.push({ kind, index: Number(index) });
    }
    return out;
}

// The next level (above `level`) that brings something, and what.
export function nextReward(level) {
    for (let l = Math.max(1, level + 1); l <= 50; l++) {
        const r = rewardsAt(l);
        if (r.length) return { level: l, rewards: r };
    }
    return null;
}

// Each level takes 5 points more than the one before up to level 10, then
// 50 points each: a level-up after the first session or two, then a steady
// pace (a regular player earns about 10 points a day: wins, games played to
// the end, the daily bonus, an ad). Level 0 at 0 points, 1 at 5, 2 at 15,
// 3 at 30, 5 at 75, 10 at 275, 11 at 325, 20 at 775, 30 at 1275. Below zero,
// the same steps downwards: -1 at -5 (three abandoned games), -2 at -15.
export const LEVEL_STEP_CAP = 10;
const STEP = 5;
const CAP_POINTS = STEP * LEVEL_STEP_CAP; // 50 a level from level 10 on
const CAP_START = (STEP * LEVEL_STEP_CAP * (LEVEL_STEP_CAP + 1)) / 2; // 275

// The points where a level starts, counting upwards from zero.
function startOf(l) {
    return l <= LEVEL_STEP_CAP ? (STEP * l * (l + 1)) / 2 : CAP_START + CAP_POINTS * (l - LEVEL_STEP_CAP);
}

export function levelOf(xp) {
    const n = Math.trunc(Number(xp) || 0);
    if (n < 0) return -levelOf(-n) || 0; // never -0
    if (n >= CAP_START) return LEVEL_STEP_CAP + Math.floor((n - CAP_START) / CAP_POINTS);
    // the largest l with STEP * l * (l + 1) / 2 <= n
    let l = Math.floor((Math.sqrt(1 + (8 * n) / STEP) - 1) / 2);
    while (startOf(l + 1) <= n) l++;
    while (l > 0 && startOf(l) > n) l--;
    return l;
}

// The lowest points of a level: where it starts, counting upwards. Level 0
// runs from -4 to 4 (the steps go both ways from zero).
export function levelStart(level) {
    const l = Math.trunc(level);
    return l > 0 ? startOf(l) : -(startOf(-l + 1) - 1);
}

//--------- online: whose table ---------
// Each player always rolls their own dice. The background ("the table") is
// one for both: a bought background wins over any level (two bought: each
// sees their own); otherwise the player with more points shows theirs -- the
// exact points, so the one nearer the next level wins a tie of levels -- and
// with equal points each sees their own. Returns the seat whose background
// both see, or 0 for "each their own". `p1`/`p2`: { xp, background, bought }.
export function tableSeat(p1, p2) {
    if (p1.bought && p2.bought) return 0;
    if (p1.bought) return 1;
    if (p2.bought) return 2;
    if ((p1.xp || 0) === (p2.xp || 0)) return 0;
    return (p1.xp || 0) > (p2.xp || 0) ? 1 : 2;
}

// A background this account may show: unlocked at its level (or bought).
export const ownsBackground = (index, xp) => Number.isInteger(index) && levelOf(xp) >= unlockLevel("background", index);

//--------- matching ---------
// Random opponents: a player below zero (who leaves games) only meets others
// below zero, or the server's bot; the others meet within a wide range of
// levels, so everyone's looks are seen by many.
export const MATCH_LEVEL_RANGE = 10;
export function canMeet(levelA, levelB) {
    if (levelA < 0 || levelB < 0) return levelA < 0 && levelB < 0;
    return Math.abs(levelA - levelB) <= MATCH_LEVEL_RANGE;
}
