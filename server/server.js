//npm install     //installs express + socket.io
//npm start        //from the repo root, then http://localhost:3000

//----------- SERVER SETTINGS ---------------
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import { PORT, CONSENT_VERSION, EMOTES, ROOMS_NEED_PRO, isOriginAllowed } from "./config.js";
import { Lobby, normalizeCode } from "./lobby.js";
import { nameFromId } from "./names.js";
import { isPro, forgetPro } from "./entitlements.js";
import { experience } from "./results.js";
import { levelOf } from "../public/shared/level.js";
import { userIdFromToken, profileOf } from "./accounts.js";
import { createStore } from "./store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Native apps (Capacitor) and any separately hosted web client connect
  // cross-origin; see isOriginAllowed.
  cors: { origin: (origin, cb) => cb(null, isOriginAllowed(origin)) },
  maxHttpBufferSize: 10 * 1024, // actions are tiny; anything bigger is abuse
});

// Static client (html/css/js, and shared/ so /shared/utils.js resolves both
// here and on a static deploy).
// "no-cache" = the browser may keep a copy but must check it's current
// before using it, so a phone testing over Wi-Fi never shows stale CSS/JS.
app.use(express.static(path.join(here, "..", "public"), {
  setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
}));

app.get("/healthz", (req, res) => res.json({ ok: true }));

// Is the signed-in player Pro? The home screen asks this without opening a
// game connection. Send the Supabase access token as "Authorization: Bearer"
// (and, while developing, the ?devpro=1 token as "X-Linotte-Dev");
// ?fresh=1 (right after a purchase) skips the 5-minute cache.
app.get("/api/me", async (req, res) => {
  const origin = req.get("Origin");
  if (origin && isOriginAllowed(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Cache-Control", "no-store");
  const token = (req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const userId = await userIdFromToken(token);
  if (userId && req.query.fresh === "1") forgetPro(userId);
  const devToken = req.get("X-Linotte-Dev") || ""; // ?devpro=1, see online.js
  const [pro, xp] = await Promise.all([isPro({ userId, devToken }), experience(userId)]);
  res.json({ signedIn: Boolean(userId), pro, xp, level: levelOf(xp) });
});
app.options("/api/me", (req, res) => {
  const origin = req.get("Origin");
  if (origin && isOriginAllowed(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Headers", "Authorization, X-Linotte-Dev");
    res.set("Vary", "Origin");
  }
  res.sendStatus(204);
});

// Invite links: https://host/j/K7QF opens the app already trying to join.
app.get("/j/:code", (req, res) => {
  const code = normalizeCode(req.params.code);
  res.redirect(code ? `/?join=${code}` : "/");
});

const store = await createStore();
const lobby = new Lobby(io, store);
let stopping = false;

//----------- CONNECTIONS ---------------
const PLAYER_ID = /^[A-Za-z0-9_-]{8,64}$/;

// Per-socket token bucket: a real client sends a handful of events a second.
function allow(socket) {
  const now = Date.now();
  const b = socket.data.bucket || (socket.data.bucket = { tokens: 40, at: now });
  b.tokens = Math.min(40, b.tokens + ((now - b.at) / 1000) * 20);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// Who this connection is: a signed-in player shows the name and country of
// their profile (the random animal name if they chose none); a guest gets the
// animal name of their device. Same on every phone for the same account.
async function setAccount(socket, token) {
  const d = socket.data;
  d.userId = await userIdFromToken(token);
  const profile = d.userId ? await profileOf(token) : { name: "", country: "" };
  d.name = profile.name || nameFromId(d.userId || d.playerId);
  d.country = profile.country;
  d.level = levelOf(await experience(d.userId)); // the number on the badge
}

io.on("connection", (socket) => {
  // Every handler goes through this: rate limit, hello required, and the
  // consent version checked wherever it matters.
  const on = (event, { needsHello = true, needsConsent = false } = {}, handler) => {
    socket.on(event, async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (!allow(socket)) return reply({ ok: false, error: "rate_limited" });
        if (needsHello && !socket.data.playerId) return reply({ ok: false, error: "no_hello" });
        if (needsConsent && socket.data.consentVersion < CONSENT_VERSION) return reply({ ok: false, error: "consent_required" });
        reply(await handler(payload || {}));
      } catch (err) {
        console.error(`${event} failed:`, err);
        reply({ ok: false, error: "server_error" });
      }
    });
  };

  on("hello", { needsHello: false }, async (p) => {
    if (!PLAYER_ID.test(String(p.playerId || ""))) return { ok: false, error: "bad_player_id" };
    socket.data.playerId = p.playerId;
    // Signed in: the account (not the device) gives the name, so it's the
    // same on every phone. Guests: the device's own id.
    await setAccount(socket, p.accessToken);
    socket.data.consentVersion = Number(p.consentVersion) || 0;
    socket.data.devToken = typeof p.entitlement?.devToken === "string" ? p.entitlement.devToken : "";
    socket.data.piece = Number.isInteger(p.piece) ? p.piece : -1; // favorite piece, see shared/pieces.js
    socket.data.pro = await isPro(socket.data);
    return {
      ok: true,
      name: socket.data.name,
      consentVersion: CONSENT_VERSION,
      consentOk: socket.data.consentVersion >= CONSENT_VERSION,
      emotes: EMOTES,
      signedIn: Boolean(socket.data.userId),
      pro: socket.data.pro,
      level: socket.data.level,
    };
  });

  // Signing in or out without reloading the page (the email code): the
  // account changes, and so does the name -- but not in the middle of a game.
  on("auth", {}, async (p) => {
    // Not in the middle of a game: the opponent already has the old name.
    const keep = lobby.roomOfSocket(socket) ? { name: socket.data.name, country: socket.data.country, level: socket.data.level } : null;
    await setAccount(socket, p.accessToken);
    if (keep) Object.assign(socket.data, keep);
    socket.data.pro = await isPro(socket.data);
    return { ok: true, signedIn: Boolean(socket.data.userId), name: socket.data.name, pro: socket.data.pro, level: socket.data.level };
  });

  // The favorite piece changed in the options (used from the next game).
  on("piece", {}, (p) => {
    socket.data.piece = Number.isInteger(p.piece) ? p.piece : -1;
    return { ok: true };
  });

  // Same screen can re-send consent (after accepting a newer version).
  on("consent", {}, (p) => {
    socket.data.consentVersion = Number(p.consentVersion) || 0;
    return { ok: socket.data.consentVersion >= CONSENT_VERSION };
  });

  on("rejoin", {}, () => lobby.rejoin(socket));

  on("queue_join", { needsConsent: true }, () => lobby.joinQueue(socket));
  on("queue_leave", {}, () => ({ ok: lobby.leaveQueue(socket.data.playerId) }));

  // Creating a friend room is meant to be the paid feature (joining is
  // always free); free for everyone until ROOMS_NEED_PRO is switched on.
  on("room_create", { needsConsent: true }, async () => {
    if (ROOMS_NEED_PRO && !(socket.data.pro = await isPro(socket.data))) return { ok: false, error: "pro_required" };
    return lobby.createPrivate(socket);
  });
  on("room_join", { needsConsent: true }, (p) => lobby.joinByCode(socket, p.code));
  on("room_leave", {}, () => { lobby.leaveRoom(socket); return { ok: true }; });
  on("rematch", { needsConsent: true }, () => lobby.requestRematch(socket));

  on("action", {}, (action) => {
    // While stopping (see shutdown) the games are being saved: no new moves.
    if (stopping) return { ok: false, reason: "server_restarting" };
    const room = lobby.roomOfSocket(socket);
    if (!room) return { ok: false, reason: "no_room" };
    const res = room.handleAction(socket.data.seat, action);
    // A rejected action means this client's screen has drifted from the
    // server's truth: hand it the authoritative state to redraw from.
    if (!res.ok && res.snapshot) res.snapshot = { ...res.snapshot, seat: socket.data.seat };
    return res;
  });

  on("emote", {}, (p) => {
    const room = lobby.roomOfSocket(socket);
    return room ? room.emote(socket.data.seat, p.id) : { ok: false };
  });

  socket.on("disconnect", () => {
    if (socket.data.playerId) lobby.handleDisconnect(socket);
  });
});

server.listen(PORT, () => {
  console.log(`server running on port ${PORT} (game store: ${store.label})`);
});

//----------- STOPPING ---------------
// Render stops the old server after a deploy (SIGTERM, then up to 30s). Save
// every game, then close the connections: the apps reconnect by themselves
// to the new server, which picks their games up from the store.
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: saving games and closing connections`);
  setTimeout(() => process.exit(0), 20000).unref(); // never hang past Render's limit
  try {
    await lobby.saveAll();
    io.disconnectSockets(true);
    await store.close();
  } catch (err) {
    console.error("shutdown:", err);
  }
  server.close();
  setTimeout(() => process.exit(0), 300).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
