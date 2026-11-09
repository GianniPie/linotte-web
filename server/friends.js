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

//--------- the friends table ---------
async function rpc(name, args, { key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
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
