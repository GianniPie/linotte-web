//----------- CHAT REACTIONS ---------------
// The icons a player can send during an online game (the fan opened by the
// chat button, see linotte.js). Each has a short unique label that only the
// SENDER reads in the fan ("wow", "hahah"...): the receiver sees just the
// icon. The ids are what travels between the apps and the server (the server
// only accepts these, server/config.js); the drawings are in
// resources/images/chat/. Listed from the nearest to the farthest from the
// button, the nudge (the bell) last.
export const CHAT = [
    { id: "👋", file: "hey", label: "hey!" },
    { id: "👍", file: "ok", label: "ok!" },
    { id: "❤️", file: "heart", label: "mwah" },
    // scale: its drawing has the tears outside the face, so the face came out smaller than the others'
    { id: "🤣", file: "hahah", label: "hahah", scale: 1.1 },
    { id: "😮", file: "wow", label: "wow" },
    { id: "🫤", file: "mhhh", label: "mhhh" },
    { id: "🥺", file: "pls", label: "nooo" },
    { id: "😡", file: "grrr", label: "grrr" },
    { id: "🙏🏻", file: "thx", label: "thanks" },
    { id: "🎲", file: "roll", label: "roll" },
    { id: "⏳", file: "tick", label: "wait" },
    // special: only for the close circle and up (SPECIAL_CHAT_ROLES): the fan shows them to those roles and the server relays them from those roles only
    { id: "🐷", file: "pig", label: "porrc", special: true },
    { id: "🍑", file: "peach", label: "checü", special: true },
    { id: "🔔", file: "ding", label: "ding!" },
];

export const CHAT_IDS = CHAT.map((c) => c.id);
// Who may send the special ones (the roles of server/entitlements.js from `special` up).
export const SPECIAL_CHAT_ROLES = ["special", "collaborator", "admin"];
export const chatAllowed = (c, role) => !c.special || SPECIAL_CHAT_ROLES.includes(role);
export const chatFor = (role) => CHAT.filter((c) => chatAllowed(c, role));
export const chatScale = (id) => CHAT.find((c) => c.id === id)?.scale ?? 1;
export const chatImage = (id) => `resources/images/chat/${CHAT.find((c) => c.id === id)?.file ?? "wow"}.svg`;

// The bell is a nudge, like MSN's: the board shakes and rings for both
// players. Limited, or it becomes a nuisance: one every 10 seconds, 5 a game.
export const NUDGE = "🔔";
export const NUDGE_COOLDOWN_MS = 10 * 1000;
export const NUDGE_MAX_PER_GAME = 5;

// Reactions in general, or someone can fill the other's screen: two in a row are fine (the second may
// correct the first), then a wait. In any EMOTE_WINDOW_MS, at most EMOTE_BURST per player, the bell
// included. The server decides (Room#emote); the app counts the same, to say so before sending.
export const EMOTE_BURST = 2;
export const EMOTE_WINDOW_MS = 12 * 1000;
// How long until another may be sent, from the times (ms, oldest first) of the ones sent: 0 = now.
export function emoteWaitMs(times, now = Date.now()) {
    const recent = times.filter((x) => now - x < EMOTE_WINDOW_MS);
    return recent.length >= EMOTE_BURST ? Math.max(0, EMOTE_WINDOW_MS - (now - recent[recent.length - EMOTE_BURST])) : 0;
}
