//----------- HUMAN-LIKE PACING AND MISTAKES ---------------
// What turns botAI's perfect-but-instant decisions into something that plays
// like a person: uneven think times, a persona per game (fast/slow, careful/
// sloppy), and small plausible slips. All of it is tuning data in one place.

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Log-normal: mostly near the median, occasionally much longer, never
// negative -- the shape human reaction times actually have.
function logNormal(median, sigma = 0.32, lo = 0.45, hi = 3) {
  const f = Math.exp(sigma * gauss());
  return median * Math.min(hi, Math.max(lo, f));
}

const uniform = (a, b) => a + Math.random() * (b - a);

export function makePersona() {
  return {
    speed: Math.min(1.7, Math.max(0.7, logNormal(1, 0.25, 0.7, 1.7))), // >1 = slower
    skill: uniform(0.72, 0.95), // 1 = never slips
    impulsive: uniform(0, 1), // how often it changes its mind about a placement
    chatty: uniform(0.1, 0.6),
    patience: uniform(0.45, 1.1), // how long it waits on the opponent before nudging (>1 = more patient)
    emojiSlip: uniform(0.02, 0.1), // how often it taps the wrong reaction first
    strategy: Math.random() < 0.6 ? "points" : "speed",
  };
}

// Median think time (ms) per kind of pause.
// (Slowed down once: a turn took about 15 s at the median, quicker than a person; the thinking
// pauses grew most, the taps between two dice hardly.)
const MEDIAN = {
  turnStart: 2600, // after the opponent's turn ends / the game starts
  rollResult: 2100, // looking at the dice just rolled
  lockGap: 520, // between two dice taps
  afterLock: 800,
  call: 1100,
  placeThink: 1550,
  tentativeRedo: 1500,
  afterPlace: 1100,
  beforeRoll: 700,
  rematch: 2200, // asked for a rematch: a moment to decide
};

// `tempo` scales the pause for what the bot is looking at: under 1 when it is
// close to making a combination (it moves quickly), over 1 when it is unsure
// (two placements about as good as each other: it takes its time).
export function think(kind, persona, { timeLeftMs = 60000, extra = 0, tempo = 1 } = {}) {
  let ms = logNormal(MEDIAN[kind] ?? 800) * persona.speed * tempo;
  if (Math.random() < 0.05) ms *= uniform(2, 3.5); // distracted for a moment
  if (timeLeftMs < 15000) ms *= 0.5; // hurries when the clock is low
  ms = Math.min(ms, Math.max(400, timeLeftMs * 0.18)); // never burns the whole turn on one pause
  return ms + extra;
}

// --- slips: each returns true when this decision should go wrong ---
const sloppy = (persona) => 1 - persona.skill; // 0.05 .. 0.28

// How inaccurate the bot is for a player of this level: 1 for a beginner (level 0 or below, the bot's own slips as they are),
// falling with the level (0.5 at level 10, 0.3 at 20) to a floor of 0.15, so that a strong player meets a bot that is nearly
// perfect and a beginner one that errs. An unknown level (a guest, whose points the server does not see) is taken as 0.8.
export const MIN_INACCURACY = 0.15;
export function inaccuracy(level) {
  if (!Number.isFinite(level)) return 0.8;
  return Math.min(1, Math.max(MIN_INACCURACY, MIN_INACCURACY + (1 - MIN_INACCURACY) * Math.exp(-Math.max(0, level) / 12)));
}
const care = (persona) => persona.inaccuracy ?? 1; // a bot saved before the index existed slips as it did
// A chance of going wrong: the bot's own sloppiness x how inaccurate it is for this player, never above `cap`.
const slip = (p, weight, cap = 0.3) => Math.random() < Math.min(cap, sloppy(p) * weight * care(p));

// Asked for a rematch by the person it just played: whether it wants one and
// after how long, like a person would. More likely when it lost (a revenge),
// and when chatty; now and then it is simply done for the day.
export function rematchAnswer(persona, { botWon }) {
  const p = Math.min(0.97, Math.max(0.6, 0.82 + (botWon ? 0 : 0.07) + (persona.chatty - 0.35) * 0.25));
  return { accept: Math.random() < p, waitMs: think("rematch", persona) };
}

export const slips = {
  // Takes the 2nd/3rd best placement instead of the best.
  placement: (p) => slip(p, 0.8),
  // Stops rolling although the AI wanted another throw.
  stopEarly: (p) => slip(p, 0.3),
  // Rolls again although the AI was happy with what it had (a throw that is no use).
  rollOn: (p) => slip(p, 0.2),
  // Forgets to make the call the AI would have made.
  skipCall: (p) => slip(p, 0.6),
  // Makes a call that is no use (its tile is taken): it harms no one, so it can be the most frequent of the bigger slips.
  badCall: (p) => slip(p, 0.7, 0.2),
  // Loses sight of a block it should be going for (rolls for something else), and of the sec tile.
  loseBlockFocus: (p) => slip(p, 0.4, 0.12),
  loseSecFocus: (p) => slip(p, 0.4, 0.12),
  // Puts the piece elsewhere when it should block: less often when the opponent would win with the cell.
  missBlock: (p, { critical = false } = {}) => slip(p, critical ? 0.2 : 0.4, critical ? 0.08 : 0.12),
  // Taps one die the wrong way.
  lock: (p) => slip(p, 0.35),
  // Puts the piece on another tile first, then moves it.
  indecision: (p) => Math.random() < 0.06 + 0.12 * p.impulsive,
  // ...and, having changed its mind once, changes it again (a second time 25-45% of the time, a third half as often: rare overall).
  changesAgain: (p, times) => Math.random() < (0.25 + 0.2 * p.impulsive) * 0.5 ** Math.max(0, times - 1),
};

// Reactions the humanized bot sends back, keyed by what the opponent sent
// (the ids are those of public/shared/chat.js).
const REPLY = {
  "👋": ["👋"],
  "👍": ["👍", "🙏🏻"],
  "❤️": ["❤️", "🙏🏻"],
  "🤣": ["🤣", "🤣", "😮"],
  "😮": ["🤣", "😮"],
  "😡": ["🫤", "😮", "🙏🏻"],
  "🥺": ["🙏🏻", "❤️"],
  "🫤": ["🥺", "🫤"],
  "🎲": ["🎲", "🤣"],
  "🙏🏻": ["❤️", "🙏🏻"],
  "⏳": ["🫤", "👍"],
  "🔔": ["🫤", "🤣"],
};

export function replyTo(id) {
  const options = REPLY[id] || ["🎲"];
  return options[Math.floor(Math.random() * options.length)];
}

export const rand = { uniform, pick: (arr) => arr[Math.floor(Math.random() * arr.length)] };
