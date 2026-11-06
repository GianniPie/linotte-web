//----------- GAME STORE ---------------
// Keeps a copy of every game outside the server's memory, so a restart (every
// deploy on Render restarts the server) doesn't end the games being played.
// The room is saved after each move; a player who reconnects to the new
// server gets their game back from here (see Lobby.rejoin / restore).
//
// With REDIS_URL (Render Key Value, or any Redis) the copies live there.
// Without it -- local runs, ngrok -- nothing is saved and games live in
// memory only, as before. createMemoryStore() is the same thing in a Map,
// for the smoke test.

import { REDIS_URL } from "./config.js";

const TTL_SECONDS = 2 * 60 * 60; // a game nobody comes back to is forgotten
const roomKey = (id) => `linotte:room:${id}`;
const playerKey = (playerId) => `linotte:player:${playerId}`;
const codeKey = (code) => `linotte:code:${code}`;

// Every method swallows its own errors: a store that's down must never break
// a game in progress, only its ability to survive a restart.
function guarded(name, fn, fallback = null) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(`store.${name} failed:`, err.message);
      return fallback;
    }
  };
}

// The common shape over a minimal key-value API (get / setEx / del).
function makeStore(kv, label) {
  return {
    label,
    saveRoom: guarded("saveRoom", async (room) => {
      const data = room.toJSON();
      const keys = [[roomKey(room.id), JSON.stringify(data)]];
      for (const s of [1, 2]) {
        const seat = data.seats[s];
        if (seat?.kind === "human") keys.push([playerKey(seat.playerId), room.id]);
      }
      if (room.code && room.status === "waiting") keys.push([codeKey(room.code), room.id]);
      await kv.setMany(keys, TTL_SECONDS);
    }),
    deleteRoom: guarded("deleteRoom", async (room) => {
      const keys = [roomKey(room.id)];
      if (room.code) keys.push(codeKey(room.code));
      for (const s of [1, 2]) {
        const seat = room.seats[s];
        // only this room's own pointer: the player may already be in a new game
        if (seat?.kind === "human" && (await kv.get(playerKey(seat.playerId))) === room.id) keys.push(playerKey(seat.playerId));
      }
      await kv.del(keys);
    }),
    roomIdOfPlayer: guarded("roomIdOfPlayer", (playerId) => kv.get(playerKey(playerId))),
    roomIdOfCode: guarded("roomIdOfCode", (code) => kv.get(codeKey(code))),
    loadRoom: guarded("loadRoom", async (id) => {
      const raw = await kv.get(roomKey(id));
      return raw ? JSON.parse(raw) : null;
    }),
    close: guarded("close", () => kv.close()),
  };
}

export function createMemoryStore() {
  const map = new Map();
  return makeStore({
    async get(k) { return map.has(k) ? map.get(k) : null; },
    async setMany(pairs) { for (const [k, v] of pairs) map.set(k, v); },
    async del(keys) { keys.forEach((k) => map.delete(k)); },
    async close() {},
  }, "memory");
}

export const noStore = {
  label: "none",
  saveRoom: async () => {},
  deleteRoom: async () => {},
  roomIdOfPlayer: async () => null,
  roomIdOfCode: async () => null,
  loadRoom: async () => null,
  close: async () => {},
};

export async function createStore() {
  if (!REDIS_URL) return noStore;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: REDIS_URL });
    client.on("error", (err) => console.error("redis:", err.message));
    await client.connect();
    console.log("game store: redis");
    return makeStore({
      get: (k) => client.get(k),
      async setMany(pairs, ttl) {
        const m = client.multi();
        for (const [k, v] of pairs) m.set(k, v, { EX: ttl });
        await m.exec();
      },
      del: (keys) => (keys.length ? client.del(keys) : 0),
      close: () => client.quit(),
    }, "redis");
  } catch (err) {
    // Better a server that runs without saving games than no server at all.
    console.error("game store unavailable, games won't survive a restart:", err.message);
    return noStore;
  }
}
