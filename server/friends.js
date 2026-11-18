//----------- FRIENDS ---------------
// A player's friends are the people they've played in a private room, both
// signed in (an account is the only thing that says it's the same person
// again; a guest is just a device). The server notes each such game in
// Supabase's friends table (supabase/friends.sql).
//
// When both are Pro the friendship does more: each sees whether the other
// is online (the app keeps its connection open on the home screen) and can
// invite them with a tap, no link to send: the server opens a private room
// and asks the friend's app to join it.

import { SUPABASE_URL } from "../public/shared/accounts.js";
import { weekStart } from "./bonuses.js";
import { nameFromId } from "./names.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

//--------- who is online ---------
// Accounts with an app connected right now: userId -> its sockets.
const sockets = new Map();

export function markOnline(socket) {
  const id = socket.data.userId;
  if (!id) return;
  if (!sockets.has(id)) sockets.set(id, new Set());
  sockets.get(id).add(socket);
  socket.data.presenceId = id;
  socket.data.activity = "home"; // until the app says it is somewhere else (setActivity)
}

export function markOffline(socket) {
  const id = socket.data.presenceId;
  if (!id) return;
  const set = sockets.get(id);
  set?.delete(socket);
  if (set && !set.size) sockets.delete(id);
  socket.data.presenceId = null;
}

export const socketsOf = (userId) => [...(sockets.get(userId) || [])];
export const isOnline = (userId) => (sockets.get(userId)?.size || 0) > 0;

// What an online account is doing, for its friends and for invitations:
//   "home"  the app is open on its home screen (or anywhere that isn't a game): free to be asked;
//   "bot"   playing against the bot, "table" playing "Same table": a game that can be put on hold,
//           so an invitation reaches them quietly (a banner, not a window over their game);
//   and, told by the server itself, "playing": in an online game, not to be disturbed.
// The app says which of the first three it is (setActivity); the server knows about "playing".
export const ACTIVITIES = ["home", "bot", "table"];
export function setActivity(socket, state) {
  if (!socket.data.presenceId || !ACTIVITIES.includes(state)) return false;
  socket.data.activity = state;
  return true;
}

// "offline" | "online" | "busy" | "playing" for an account. `playing(socket)` says whether that
// connection is in an online game (the lobby knows). One account on two devices: it is as free as
// its freest connection, except that a game on any of them means "playing".
export function presenceOf(userId, playing = () => false) {
  const list = socketsOf(userId);
  if (!list.length) return "offline";
  if (list.some(playing)) return "playing";
  return list.some((s) => s.data.activity === "home") ? "online" : "busy";
}

//--------- the friends table ---------
export async function rpc(name, args, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  if (!key || !url) return null;
  const res = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// A private game between two accounts: they're friends (or one game more).
export async function noteFriends(a, b, options) {
  if (!a || !b || a === b) return;
  try {
    await rpc("note_friends", { a, b }, options);
  } catch (err) {
    console.error("friends not noted:", err.message);
  }
}

// An account's friends, most recent first, with their points this week.
export async function friendsOf(userId, options) {
  if (!userId) return [];
  const rows = (await rpc("friends_of", { me: userId, since: weekStart().toISOString() }, options)) || [];
  return rows.map((r) => ({
    id: r.friend_id,
    name: r.name || nameFromId(r.friend_id),
    country: r.country || "",
    games: Number(r.games) || 0,
    weekPoints: Number(r.week_points) || 0,
  }));
}

export async function areFriends(a, b, options) {
  if (!a || !b) return false;
  return (await friendsOf(a, options)).some((f) => f.id === b);
}
