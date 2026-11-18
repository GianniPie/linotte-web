//----------- FRIENDS YOU CHOOSE ---------------
// The friends list is made by the players: someone asks, the other says yes (supabase/friendships.sql).
// Two ways to find each other:
//   1. the personal friend code, shared as a link or typed in: the person who gave it has
//      already said yes, so using it makes friends at once;
//   2. "add friend" on an opponent met in an online game (a request they can accept or not).
// No search by email, ever (it would tell anyone who has an account), and none by nickname
// (nicknames aren't unique).
// Design and open questions: docs/FRIENDS.md.

import { SUPABASE_URL } from "../public/shared/accounts.js";
import { weekStart } from "./bonuses.js";
import { nameFromId } from "./names.js";
import { rpc } from "./friends.js";

const isId = (v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
export const FRIEND_CODE = /^[2-9A-HJ-NP-Z]{6}$/;
export const normalizeFriendCode = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/[01IO]/g, "");

//--------- the table, through the database's own functions ---------
// Every call returns the database's word, or null when there is no database (a local run).

// The account's own code, made the first time it is asked.
export async function friendCodeOf(userId, options) {
  if (!isId(userId)) return null;
  const code = await rpc("friend_code_of", { uid: userId }, options);
  return typeof code === "string" && FRIEND_CODE.test(code) ? code : null;
}

// Whose code it is, before using it: { friendId, name, country } or null.
export async function peekCode(rawCode, options) {
  const code = normalizeFriendCode(rawCode);
  if (!FRIEND_CODE.test(code)) return null;
  const row = ((await rpc("friend_code_owner", { c: code }, options)) || [])[0];
  return row ? { friendId: row.user_id, name: row.name || nameFromId(row.user_id), country: row.country || "" } : null;
}

// Someone gave this account their code: friends at once, or why not.
// -> { result: "accepted" | "already" | "blocked" | "full" | "self" | "no_code", friend? }
export async function addByCode(userId, rawCode, options) {
  const code = normalizeFriendCode(rawCode);
  if (!FRIEND_CODE.test(code)) return { result: "no_code" };
  const otherId = await rpc("user_by_friend_code", { c: code }, options);
  if (!isId(otherId)) return { result: "no_code" };
  const result = await rpc("friend_request", { a: userId, b: otherId, auto: true }, options);
  return { result, friendId: otherId };
}

// -> "sent" | "accepted" | "already" | "waiting" | "blocked" | "full" | "self"
export const requestFriend = (userId, otherId, options) =>
  isId(otherId) ? rpc("friend_request", { a: userId, b: otherId, auto: false }, options) : Promise.resolve("none");

// -> "accepted" | "declined" | "none"
export const respondToRequest = (userId, otherId, accept, options) =>
  isId(otherId) ? rpc("friend_respond", { me: userId, other: otherId, accept: Boolean(accept) }, options) : Promise.resolve("none");

export async function removeFriend(userId, otherId, options) {
  if (isId(otherId)) await rpc("friend_remove", { me: userId, other: otherId }, options);
}
export async function blockUser(userId, otherId, options) {
  if (isId(otherId)) await rpc("friend_block", { me: userId, other: otherId }, options);
}
export async function unblockUser(userId, otherId, options) {
  if (isId(otherId)) await rpc("friend_unblock", { me: userId, other: otherId }, options);
}

// The friends screen: accepted friends (with this week's points), the requests waiting for the
// account's answer (incoming) and the ones it sent (outgoing).
export async function friendList(userId, options) {
  const rows = (await rpc("friend_list", { me: userId, since: weekStart().toISOString() }, options)) || [];
  const person = (r) => ({
    id: r.friend_id,
    name: r.name || nameFromId(r.friend_id),
    country: r.country || "",
    games: Number(r.games) || 0,
    weekPoints: Number(r.week_points) || 0,
  });
  return {
    friends: rows.filter((r) => r.status === "accepted").map(person),
    incoming: rows.filter((r) => r.status === "pending" && r.requested_by !== userId).map(person),
    outgoing: rows.filter((r) => r.status === "pending" && r.requested_by === userId).map(person),
  };
}

//--------- asking too much ---------
// A request costs the other person a notification: so many an hour per account, in memory (a restart
// forgets, which is fine for a brake).
export function createBudget({ perHour = 20, now = Date.now } = {}) {
  const used = new Map(); // userId -> [timestamps]
  return {
    take(userId) {
      const t = now(), recent = (used.get(userId) || []).filter((x) => t - x < 3600_000);
      if (recent.length >= perHour) { used.set(userId, recent); return false; }
      recent.push(t);
      used.set(userId, recent);
      return true;
    },
  };
}

//--------- invitations to play ---------
// "Come and play": the inviter's private room is open, the friend's app is told, and a minute later
// it is all undone if nobody came. What the friend sees depends on what they are doing:
//   online  (home screen)        a window: Anna invites you to play. Accept / not now;
//   busy    (bot or same table)  a quiet banner over their game: accepting puts that game on hold
//                                (the app saves it, as when you leave it), declining costs nothing;
//   playing (an online game)     no invitation at all: the inviter is told "is playing" and nothing
//                                is sent, so nobody is interrupted in a game that counts;
//   offline                      no invitation (a push notification will come with the native apps).
export const INVITE_TTL_MS = 60_000;

export function createInviteBook({ ttlMs = INVITE_TTL_MS, onExpire = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const invites = new Map(); // id -> { id, fromId, toId, code, timer }
  let counter = 0;
  const finish = (id) => {
    const inv = invites.get(id);
    if (!inv) return null;
    clearTimer(inv.timer);
    invites.delete(id);
    return inv;
  };
  return {
    // One open invitation per inviter: a new one replaces the old one (whose room the caller closes).
    create({ fromId, toId, code }) {
      const replaced = [...invites.values()].filter((i) => i.fromId === fromId).map((i) => finish(i.id));
      const id = `inv${++counter}-${Math.random().toString(36).slice(2, 8)}`;
      const inv = { id, fromId, toId, code, expiresAt: Date.now() + ttlMs, timer: null };
      inv.timer = setTimer(() => { if (finish(id)) onExpire(inv); }, ttlMs);
      inv.timer.unref?.();
      invites.set(id, inv);
      return { invite: inv, replaced };
    },
    // The friend answered (or joined the room): the invitation is over. Only the friend it was for.
    answer(id, toId) {
      const inv = invites.get(id);
      return inv && inv.toId === toId ? finish(id) : null;
    },
    // The inviter took it back (left the room, cancelled).
    cancelFrom(fromId) {
      return [...invites.values()].filter((i) => i.fromId === fromId).map((i) => finish(i.id));
    },
    get: (id) => invites.get(id) || null,
    size: () => invites.size,
  };
}

// What may be said to the inviter and what is sent to the friend, from the friend's state.
// -> { send: boolean, soft: boolean, error?: string }
export function inviteRule(state) {
  if (state === "offline") return { send: false, error: "friend_offline" };
  if (state === "playing") return { send: false, error: "friend_playing" };
  return { send: true, soft: state === "busy" };
}
