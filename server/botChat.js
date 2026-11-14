//----------- WHAT THE BOT SAYS, AND WHEN ---------------
// The twelve reactions of the chat (public/shared/chat.js) and what a person
// would tap each one for. Each situation lists the reactions that fit it, with
// a weight; the bot picks one, now and then taps a wrong one and corrects it,
// and talks more or less depending on how it is being talked to.

// Reaction ids: hey 👋, ok 👍, heart ❤️, hahah 🤣, wow 😮, mhhh 🫤, nooo 🥺,
// grrr 😡, thanks/sorry 🙏🏻, roll 🎲, wait ⏳, ding 🔔.
const BAD = [["😡", 2], ["🥺", 2], ["🫤", 2], ["😮", 1]]; // grrr, nooo, mhhh, wow: "ouch"

export const SITUATIONS = {
  // The game starts: mostly a hello.
  start: [["👋", 6], ["👍", 1]],
  // Something at random, in the middle of the game: a hello by mistake, an ok.
  random: [["👋", 2], ["👍", 3], ["🤣", 1], ["😮", 1]],
  // The bot closed a line of the opponent's, or scored well.
  botBlocked: [["🤣", 3], ["❤️", 3], ["😮", 1]],
  botScored: [["👍", 4], ["🤣", 2], ["❤️", 1]],
  botBigScore: [["😮", 3], ["🤣", 3], ["❤️", 1]], // 2+ points or a Yam
  // The opponent closed the bot's line, or took a cell the bot wanted.
  blockedByOpponent: BAD,
  opponentTookUseful: BAD,
  // The bot made a mistake: annoyed, or sorry.
  botSlip: [["🫤", 3], ["🥺", 2], ["😡", 1], ["😮", 1], ["🙏🏻", 3]],
  // The opponent scored well (2+ points) or made a Yam.
  opponentBigScore: [["😮", 5], ["🫤", 1], ["🥺", 1], ["😡", 1], ["👍", 1]],
  // The opponent could have closed a bot line and didn't.
  opponentLetItBe: [["❤️", 4], ["🙏🏻", 3], ["👍", 2]],
  // The bot is about to step away for a moment.
  away: [["⏳", 1]],
  // The opponent is taking too long to roll / at all.
  nudgeRoll: [["🎲", 1]],
  nudgeAwake: [["🔔", 1]],
};

// Replies, by what the opponent just sent: not always the same thing back.
export const REPLIES = {
  "👋": [["👋", 6], ["👍", 1]],
  "👍": [["👍", 3], ["🙏🏻", 2], ["❤️", 1]],
  "❤️": [["❤️", 4], ["🙏🏻", 2], ["🤣", 1]],
  "🤣": [["🤣", 4], ["😮", 1], ["👍", 1]],
  "😮": [["🤣", 2], ["😮", 2], ["🫤", 1]],
  "😡": [["🫤", 2], ["😮", 1], ["🙏🏻", 3], ["🥺", 1]], // sorry, or a shrug
  "🥺": [["🙏🏻", 2], ["❤️", 2], ["🫤", 1]],
  "🫤": [["🥺", 2], ["🫤", 2], ["🤣", 1]],
  "🎲": [["🎲", 3], ["🤣", 2], ["🙏🏻", 1]],
  "🙏🏻": [["❤️", 3], ["🙏🏻", 2], ["👍", 2]],
  "⏳": [["👍", 4], ["🙏🏻", 1]], // fine, take your time
  "🔔": [["🙏🏻", 3], ["🫤", 2], ["⏳", 2]], // sorry, or a moment please
};

export function pickWeighted(list, rnd = Math.random) {
  const total = list.reduce((sum, [, w]) => sum + w, 0);
  let x = rnd() * total;
  for (const [id, w] of list) { x -= w; if (x <= 0) return id; }
  return list[list.length - 1][0];
}

export const pickFor = (situation, rnd) => pickWeighted(SITUATIONS[situation] || SITUATIONS.random, rnd);
export const replyTo = (id, rnd) => pickWeighted(REPLIES[id] || [["🎲", 1]], rnd);

// A reaction that is plausibly confused with the right one (a person taps the
// neighbour in the fan): another one that isn't the bell.
const CONFUSABLE = ["👋", "👍", "❤️", "🤣", "😮", "🫤", "🥺", "😡", "🙏🏻"];
export function wrongOne(id, rnd = Math.random) {
  const pool = CONFUSABLE.filter((x) => x !== id);
  return pool[Math.floor(rnd() * pool.length)];
}

// How talkative it is right now: its own nature, plus how much it has been
// stimulated (every reaction it receives warms it up; it cools off with time).
export const HEAT_PER_EMOTE = 0.3;
export const HEAT_HALF_LIFE_MS = 60 * 1000;
export function cooledHeat(heat, sinceMs) {
  return heat * Math.pow(0.5, Math.max(0, sinceMs) / HEAT_HALF_LIFE_MS);
}
export function activity(chatty, heat) {
  return Math.min(1.2, Math.max(0.1, 0.12 + chatty * 0.9 + heat * 0.5));
}
