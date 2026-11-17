//----------- EXPERIENCE AND LEVEL ---------------
// The number on a player's badge is a level, from their experience points.
// Online (random or friend, games recorded by the server): +4 for a win, +2
// for a loss or draw played to the end, -3 for a game abandoned before its
// end (left, gone for good after a disconnection, or 3 idle turns). Online
// pays about twice what the bot does (a game between equals: 3 points online,
// 1.7 against the bot in points mode), as it takes longer and is what keeps the
// game alive. Games played before ONLINE_RATES_FROM keep what they paid then
// (LEGACY_ONLINE, 2 / 1 / -2): nobody's history changes. Against
// the bot (recorded by the app, so worth less): +1 for every win. Points
// and level can go below zero. Counted by the server for an account
// (results.js); a guest's level lives on its phone only and is never moved
// to an account.
//
// Finishing a game is worth something even when it's lost: every game
// played to the end moves the player on, and staying beats leaving.
export const ONLINE_WIN_POINTS = 4;
export const ONLINE_FINISHED_POINTS = 2;
export const BOT_WIN_POINTS = 1; // a win against the bot (it used to be 1 point for 5 wins: no progress to see)

// Speed mode against the bot: the faster the game is won, the more it pays on top of
// BOT_WIN_POINTS. Counted in the winner's own turns. The bot's own games last about 15
// turns a side (median 15, a quarter of wins in 11 or fewer, one in ten in 8 or fewer):
// from there up it pays nothing. (Calibrated on bot-vs-bot games; the app saves each
// game's turns, so these can be set again from real ones: see game_results.turns.)
// Points mode pays the winning margin and nothing for a loss, about 1.65 a game for a
// player as good as the bot against 1.15 here (and 0.5 a game without the bonus): the
// bonus makes up part of the difference, the rest is the risk of the margin.
export const SPEED_BONUS_TIERS = [{ upTo: 8, bonus: 4 }, { upTo: 11, bonus: 3 }, { upTo: 14, bonus: 2 }];
export function speedBonus(turns) {
    if (!(turns > 0)) return 0;
    for (const tier of SPEED_BONUS_TIERS) if (turns <= tier.upTo) return tier.bonus;
    return 0;
}

// What a win against the bot pays: speed, 1 point and the speed bonus; points, the pure
// winning margin (the points you are ahead by: at least 1 for a win). A loss or a draw: 0.
export function botWinPayout({ strategy, turns, margin }) {
    if (strategy === "points") return Math.max(BOT_WIN_POINTS, margin | 0);
    return BOT_WIN_POINTS + speedBonus(turns);
}
export const ABANDON_PENALTY = 3;
// From this moment online games pay the rates above; the ones before it paid the old ones.
// The same moment is in supabase/leaderboard_everyone.sql: change both together.
export const ONLINE_RATES_FROM = "2026-11-17T04:33:00Z";
export const LEGACY_ONLINE = { win: 2, finished: 1, abandon: 2 };
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
