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
import { isPro, forgetPro, accessFor } from "./entitlements.js";
import { accountStats } from "./results.js";
import { todayStatus, grantAdReward, weeklyLeaderboard, clampTz } from "./bonuses.js";
import { markOnline, markOffline, socketsOf, isOnline, friendsOf, areFriends, setActivity, presenceOf } from "./friends.js";
import {
  friendCodeOf, addByCode, peekCode, requestFriend, respondToRequest, removeFriend, blockUser, unblockUser,
  friendList, createBudget, createInviteBook, inviteRule, normalizeFriendCode,
} from "./friendships.js";
import { levelOf, FREE_LOOKS } from "../public/shared/level.js";
import { userIdFromToken, profileOf, profileById } from "./accounts.js";
import { avatarOrDefault } from "../public/shared/assets.js";
import { createStore } from "./store.js";
import { REPORT_REASONS, createReportBook, saveReport, notifyReport } from "./reports.js";
import { createFeedbackBudget, parseScreenshot, buildReport, emailOf, sendFeedback, MAX_MESSAGE } from "./feedback.js";
import { VERSION } from "../public/version.js";
import { createBotLab, BOTLAB_ENABLED } from "./botlab.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Native apps (Capacitor) and any separately hosted web client connect
  // cross-origin; see isOriginAllowed.
  cors: { origin: (origin, cb) => cb(null, isOriginAllowed(origin)) },
  maxHttpBufferSize: 10 * 1024, // actions are tiny; anything bigger is abuse
});

// The bot lab (a developer tool, see botlab.js): its page doesn't exist where it's off.
app.get("/botlab.html", (req, res, next) => (BOTLAB_ENABLED ? next() : res.sendStatus(404)));
const botlab = createBotLab();
botlab.attach(app);

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
// The app (on another origin, e.g. Vercel) calls these with the account's
// token: allowed origins only, never cached.
function apiHeaders(req, res) {
  const origin = req.get("Origin");
  if (origin && isOriginAllowed(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Cache-Control", "no-store");
}
const accountOf = (req) => userIdFromToken((req.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
for (const route of ["/api/me", "/api/ad-reward", "/api/leaderboard", "/api/friends", "/api/player/:id", "/api/feedback"]) {
  app.options(route, (req, res) => {
    apiHeaders(req, res);
    res.set("Access-Control-Allow-Headers", "Authorization, X-Linotte-Dev, Content-Type");
    res.set("Access-Control-Allow-Methods", "GET, POST");
    res.sendStatus(204);
  });
}

app.get("/api/me", async (req, res) => {
  apiHeaders(req, res);
  const userId = await accountOf(req);
  if (userId && req.query.fresh === "1") forgetPro(userId);
  const devToken = req.get("X-Linotte-Dev") || ""; // ?devpro=1, see online.js
  const [access, stats, today] = await Promise.all([accessFor({ userId, devToken }), accountStats(userId), todayStatus(userId, { tz: req.query.tz })]);
  const pro = access.pro;
  // xp null: Supabase couldn't be read just now, the app keeps what it had.
  res.json({ signedIn: Boolean(userId), pro, star: access.star, role: access.role, xp: stats.xp, level: stats.xp === null ? null : levelOf(stats.xp), record: stats.record, ...today });
});

// A rewarded ad watched to the end (see ads.js): +1 level point, a few times
// a day. With the sample ads the app's word is taken; a real network will
// confirm it to the server itself.
app.post("/api/ad-reward", async (req, res) => {
  apiHeaders(req, res);
  const userId = await accountOf(req);
  if (!userId) return res.status(401).json({ ok: false });
  const result = await grantAdReward(userId, { tz: req.query.tz });
  const { xp } = await accountStats(userId);
  res.json({ ...result, xp, level: xp === null ? null : levelOf(xp) });
});

// The account's friends (people played in private rooms), with their points
// this week; between two Pro players, whether each is online too.
app.get("/api/friends", async (req, res) => {
  apiHeaders(req, res);
  const userId = await accountOf(req);
  if (!userId) return res.status(401).json({ friends: [] });
  try {
    const [mePro, list] = await Promise.all([isPro({ userId }), friendsOf(userId)]);
    const friends = await Promise.all(list.map(async (f) => {
      const pro = await isPro({ userId: f.id });
      return { ...f, pro, online: mePro && pro ? isOnline(f.id) : null };
    }));
    res.json({ pro: mePro, friends });
  } catch (err) {
    console.error("friends:", err.message);
    res.status(503).json({ friends: [] });
  }
});

// Anyone's card, from the ranking or the friends: name, country, picture, level and points, the star (Pro) and
// the online record. Only what the game already shows an opponent, so no sign-in is needed; remembered a minute.
const playerCache = new Map(); // id -> { at, card }
app.get("/api/player/:id", async (req, res) => {
  apiHeaders(req, res);
  const id = String(req.params.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ ok: false });
  const hit = playerCache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return res.json(hit.card);
  try {
    const [profile, stats, access] = await Promise.all([profileById(id), accountStats(id), accessFor({ userId: id })]);
    if (!profile) return res.status(404).json({ ok: false });
    const card = {
      ok: true, id, name: profile.name || nameFromId(id), country: profile.country, avatar: avatarOrDefault(profile.avatar, id),
      xp: stats.xp, level: stats.xp === null ? null : levelOf(stats.xp), star: access.star, record: stats.record,
    };
    playerCache.set(id, { at: Date.now(), card });
    if (playerCache.size > 500) playerCache.delete(playerCache.keys().next().value);
    res.json(card);
  } catch (err) {
    console.error("player card:", err.message);
    res.status(503).json({ ok: false });
  }
});

// "Report a problem": a message, maybe a screenshot, and what the app knows about the player's device and game.
// The server adds who the player is, and its own view of the online game they are in (feedback.js). Kept and
// mailed; a few an hour per account.
const feedbackBudget = createFeedbackBudget();
app.post("/api/feedback", express.json({ limit: "3mb" }), async (req, res) => {
  apiHeaders(req, res);
  try {
    const body = req.body || {};
    const message = String(body.message || "").trim();
    if (message.length < 3 || message.length > MAX_MESSAGE) return res.status(400).json({ ok: false, error: "bad_message" });
    const userId = await accountOf(req);
    if (!feedbackBudget.take(userId || req.ip)) return res.status(429).json({ ok: false, error: "slow_down" });
    let screenshot = null;
    if (body.screenshot) {
      screenshot = parseScreenshot(body.screenshot);
      if (!screenshot) return res.status(400).json({ ok: false, error: "bad_screenshot" });
    }
    const kind = body.kind === "contact" ? "contact" : "problem";
    const client = body.client && typeof body.client === "object" ? body.client : {};
    const typedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || "")) ? String(body.email).slice(0, 120) : "";
    const [access, stats, profile, email] = await Promise.all([
      accessFor({ userId }), accountStats(userId), userId ? profileById(userId) : null, emailOf(userId),
    ]);
    const room = typeof client.playerId === "string" ? lobby.activeRoom(client.playerId) : null;
    const serverGame = room && {
      roomId: room.id, kind: room.kind, status: room.status, currentPlayer: room.state?.currentPlayer,
      points: room.state ? [1, 2].map((s) => room.state.players[s].points).join(" - ") : "", idleTurns: JSON.stringify(room.idleTurns || {}),
      seats: [1, 2].map((s) => room.seats[s] && { seat: s, name: room.seats[s].name, kind: room.seats[s].kind, userId: room.seats[s].userId || null, connected: room.seats[s].connected !== false }).filter(Boolean),
    };
    const account = {
      userId, name: profile?.name || "", email, role: access.role, country: profile?.country || "",
      level: stats.xp === null ? undefined : levelOf(stats.xp), xp: stats.xp ?? undefined,
    };
    const report = buildReport({ kind, message, client, account, replyTo: email || typedEmail, serverGame, ip: req.ip, screenshot, version: VERSION });
    const result = await sendFeedback(report, { userId, kind, message, replyTo: email || typedEmail, screenshot });
    res.status(result.ok ? 200 : 503).json({ ok: result.ok });
  } catch (err) {
    console.error("feedback:", err.message);
    res.status(500).json({ ok: false });
  }
});
// A body too big for the route (a huge screenshot): said, not a stack trace.
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") { apiHeaders(req, res); return res.status(413).json({ ok: false, error: "too_big" }); }
  next(err);
});

// This week's leaderboard, with the asking player's own place.
app.get("/api/leaderboard", async (req, res) => {
  apiHeaders(req, res);
  try {
    res.json(await weeklyLeaderboard(await accountOf(req), { range: req.query.range === "all" ? "all" : "week" }));
  } catch (err) {
    console.error("leaderboard:", err.message);
    res.status(503).json({ rows: [], me: null });
  }
});

// A friend code as a link: https://host/f/K7QF3A opens the app asking "Add …?".
app.get("/f/:code", (req, res) => {
  const code = normalizeFriendCode(req.params.code);
  res.redirect(code.length === 6 ? `/?friend=${code}` : "/");
});

// Invite links: https://host/j/K7QF opens the app already trying to join.
app.get("/j/:code", (req, res) => {
  const code = normalizeCode(req.params.code);
  res.redirect(code ? `/?join=${code}` : "/");
});

const store = await createStore();
const lobby = new Lobby(io, store, { afterRecord: (socket) => setStats(socket) });

//--------- friends: who is where, and invitations ---------
// "offline" | "online" | "busy" | "playing" (friends.js). The server knows who is in an online game;
// the app says whether it is on the home screen or in a game against the bot or at the same table.
const playingNow = (s) => Boolean(lobby.activeRoom(s.data.playerId));
const stateOf = (userId) => presenceOf(userId, playingNow);

// An account's accepted friends' ids, kept for a minute (they are asked every time someone connects).
const friendIdsCache = new Map();
async function acceptedFriendIds(userId) {
  const hit = friendIdsCache.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.ids;
  const ids = (await friendList(userId)).friends.map((f) => f.id);
  friendIdsCache.set(userId, { at: Date.now(), ids });
  return ids;
}
const forgetFriendIds = (...userIds) => userIds.forEach((id) => friendIdsCache.delete(id));
// Tells the friends who are online that this account's state is now what it is. Never throws.
async function announcePresence(userId) {
  if (!userId) return;
  try {
    const state = stateOf(userId);
    for (const id of await acceptedFriendIds(userId)) for (const s of socketsOf(id)) s.emit("friend_presence", { id: userId, state });
  } catch (err) {
    console.error("presence not announced:", err.message);
  }
}
const requestBudget = createBudget();
const serverReports = createReportBook();

// An invitation nobody answered in a minute: the inviter's room closes and both are told.
const invites = createInviteBook({
  onExpire: (inv) => {
    const room = lobby.byCode.get(inv.code);
    const waiting = room && room.status === "waiting";
    const inviter = socketsOf(inv.fromId).find((x) => lobby.roomOfSocket(x)?.code === inv.code);
    if (waiting && inviter) lobby.leaveRoom(inviter);
    if (!waiting) return; // they played: nothing to undo
    for (const x of [...socketsOf(inv.fromId), ...socketsOf(inv.toId)]) x.emit("invite_expired", { inviteId: inv.id });
  },
});
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
// The account's points, level and record on its connection: what opponents
// see and what matching uses. Read at hello, and again after each game is
// recorded (see `afterRecord` in lobby.js). When Supabase can't be read, what
// was there stays.
async function setStats(socket) {
  const d = socket.data;
  const stats = await accountStats(d.userId); // a guest has none the server can trust
  if (stats.xp === null && d.statsFor === d.userId) return;
  d.statsFor = d.userId;
  d.xp = stats.xp ?? 0;
  d.level = levelOf(d.xp); // the number on the badge
  d.record = stats.record ?? { played: 0, won: 0 }; // games played and won online, for the player card
}

// What this connection's account has (entitlements.js): Pro's things, the star, its role.
async function refreshAccess(socket) {
  const access = await accessFor(socket.data);
  Object.assign(socket.data, { pro: access.pro, star: access.star, role: access.role });
  return access;
}

async function setAccount(socket, token) {
  const d = socket.data;
  d.userId = await userIdFromToken(token);
  const profile = d.userId ? await profileOf(token) : { name: "", country: "", avatar: "" };
  d.name = profile.name || nameFromId(d.userId || d.playerId);
  d.country = profile.country;
  d.avatar = avatarOrDefault(profile.avatar, d.userId || d.playerId); // a picture of the game's gallery (accounts.js checks it), or the default one, for the player's card
  await setStats(socket);
  // Online for friends (friends.js): whichever account this app is now.
  markOffline(socket);
  markOnline(socket);
  announcePresence(d.userId);
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
    socket.data.tz = clampTz(p.tz); // minutes behind UTC: the player's own midnight (bonuses.js)
    socket.data.claims = p.claims === true; // an app that plays the points video and asks for the points (Lobby#heldSeats)
    // Signed in: the account (not the device) gives the name, so it's the
    // same on every phone. Guests: the device's own id.
    await setAccount(socket, p.accessToken);
    socket.data.consentVersion = Number(p.consentVersion) || 0;
    socket.data.devToken = typeof p.entitlement?.devToken === "string" ? p.entitlement.devToken : "";
    socket.data.piece = Number.isInteger(p.piece) ? p.piece : -1; // favorite piece, see shared/pieces.js
    socket.data.background = Number.isInteger(p.background) ? p.background : FREE_LOOKS.background; // see tableSeat
    await refreshAccess(socket);
    return {
      ok: true,
      name: socket.data.name,
      consentVersion: CONSENT_VERSION,
      consentOk: socket.data.consentVersion >= CONSENT_VERSION,
      emotes: EMOTES,
      signedIn: Boolean(socket.data.userId),
      pro: socket.data.pro,
      star: socket.data.star,
      role: socket.data.role,
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
    await refreshAccess(socket);
    return { ok: true, signedIn: Boolean(socket.data.userId), name: socket.data.name, pro: socket.data.pro, star: socket.data.star, role: socket.data.role, level: socket.data.level };
  });

  // The favorite piece changed in the options (used from the next game).
  on("piece", {}, (p) => {
    socket.data.piece = Number.isInteger(p.piece) ? p.piece : -1;
    return { ok: true };
  });
  // ...and the background (the table, see tableSeat in shared/level.js).
  on("look", {}, (p) => {
    if (Number.isInteger(p.background)) socket.data.background = p.background;
    return { ok: true };
  });

  // Same screen can re-send consent (after accepting a newer version).
  on("consent", {}, (p) => {
    socket.data.consentVersion = Number(p.consentVersion) || 0;
    return { ok: socket.data.consentVersion >= CONSENT_VERSION };
  });

  on("rejoin", {}, () => lobby.rejoin(socket));

  // The video before the winner card was watched (the game's points count) or closed (they don't).
  on("claim_points", {}, (p) => lobby.claimPoints(socket, { adFree: p.adFree === true }));
  on("skip_points", {}, () => lobby.skipPoints(socket));

  on("queue_join", { needsConsent: true }, () => lobby.joinQueue(socket));
  on("queue_leave", {}, () => ({ ok: lobby.leaveQueue(socket.data.playerId) }));

  // Creating a friend room is meant to be the paid feature (joining is
  // always free); free for everyone until ROOMS_NEED_PRO is switched on.
  on("room_create", { needsConsent: true }, async () => {
    if (ROOMS_NEED_PRO && !(await refreshAccess(socket)).pro) return { ok: false, error: "pro_required" };
    return lobby.createPrivate(socket);
  });
  on("room_join", { needsConsent: true }, (p) => lobby.joinByCode(socket, p.code));
  on("room_leave", {}, () => { lobby.leaveRoom(socket); return { ok: true }; });
  on("rematch", { needsConsent: true }, () => lobby.requestRematch(socket));
  on("rematch_decline", {}, () => lobby.declineRematch(socket));

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

  // "Report" on the opponent's card: kept for the owner to read (reports.js). The server's own players that
  // pass for people are answered like a real one (they are not told apart), and nothing is kept for them.
  const reports = serverReports;
  on("report_player", { needsConsent: true }, async (p) => {
    const reason = String(p.reason || "");
    if (!REPORT_REASONS.includes(reason)) return { ok: false, error: "bad_reason" };
    const room = lobby.roomOfSocket(socket);
    const other = room && room.seats[room.otherSeat(socket.data.seat)];
    if (!other) return { ok: false, error: "no_game" };
    if (other.kind === "bot") return { ok: true };
    const reporter = socket.data.userId || socket.data.playerId;
    const verdict = reports.take(reporter, room.id, other.userId || other.playerId);
    if (verdict === "again") return { ok: true }; // already told: no second line to read
    if (verdict === "slow_down") return { ok: false, error: "slow_down" };
    const saved = await saveReport({
      reporter: socket.data.userId, reporterPlayer: socket.data.playerId,
      reportedUser: other.userId, reportedPlayer: other.playerId, reportedName: other.name, roomId: room.id, reason,
    });
    // The owner gets a mail with everything and how to act (reports.js); not waited for.
    if (saved) {
      notifyReport({
        id: typeof saved === "string" ? saved : "", reason, roomId: room.id,
        reporter: { userId: socket.data.userId || null, playerId: socket.data.playerId, shownName: socket.data.name },
        reported: { userId: other.userId || null, playerId: other.playerId, shownName: other.name },
      });
    }
    return { ok: Boolean(saved) };
  });

  on("emote", {}, (p) => {
    const room = lobby.roomOfSocket(socket);
    return room ? room.emote(socket.data.seat, p.id) : { ok: false };
  });

  //--------- the friends the player chooses (friendships.js, docs/FRIENDS.md) ---------
  const account = () => socket.data.userId || null;
  const needAccount = (handler) => async (p) => (account() ? handler(p, account()) : { ok: false, error: "sign_in" });

  // Where the app is: its home screen, a game against the bot, or "Same table" (friends.js).
  on("presence_set", {}, (p) => {
    if (!setActivity(socket, String(p.state))) return { ok: false };
    announcePresence(account());
    return { ok: true };
  });

  // The friends screen in one answer: friends with their state, requests in and out, the account's code.
  on("friends_list", {}, needAccount(async (p, me) => {
    const [list, code, mePro] = await Promise.all([friendList(me), friendCodeOf(me), isPro({ userId: me })]);
    forgetFriendIds(me);
    const friends = await Promise.all(list.friends.map(async (f) => ({ ...f, pro: await isPro({ userId: f.id }), state: stateOf(f.id) })));
    return { ok: true, pro: mePro, code, friends, incoming: list.incoming, outgoing: list.outgoing };
  }));

  // Whose code this is, so the app can ask "Add Anna?" before it makes friends.
  on("friend_code_peek", {}, needAccount(async (p, me) => {
    if (!requestBudget.take(me)) return { ok: false, error: "slow_down" };
    const owner = await peekCode(p.code);
    return owner && owner.friendId !== me ? { ok: true, name: owner.name, country: owner.country } : { ok: false, error: owner ? "self" : "no_code" };
  }));

  on("friend_add_code", { needsConsent: true }, needAccount(async (p, me) => {
    if (!requestBudget.take(me)) return { ok: false, error: "slow_down" };
    const res = await addByCode(me, p.code);
    if (res.result === "accepted") {
      forgetFriendIds(me, res.friendId);
      for (const s of socketsOf(res.friendId)) s.emit("friend_accepted", { id: me, name: socket.data.name });
    }
    return { ok: res.result === "accepted" || res.result === "already", result: res.result, friendId: res.friendId };
  }));

  // A request to someone (their id came from the friends screen) or to the opponent of the game this
  // player is in or just played ("Add friend" on their card: the app never sees their account id).
  const sendRequest = async (me, otherId) => {
    if (!requestBudget.take(me)) return { ok: false, error: "slow_down" };
    const result = await requestFriend(me, otherId);
    if (result === "sent") {
      for (const s of socketsOf(otherId)) s.emit("friend_request", { id: me, name: socket.data.name, country: socket.data.country || "" });
    } else if (result === "accepted") {
      forgetFriendIds(me, otherId);
      for (const s of socketsOf(otherId)) s.emit("friend_accepted", { id: me, name: socket.data.name });
    }
    // "blocked" is said like "sent": the one who was blocked never learns it.
    return { ok: true, result: result === "blocked" ? "sent" : result };
  };
  on("friend_request", { needsConsent: true }, needAccount((p, me) => sendRequest(me, String(p.userId || ""))));
  on("friend_request_opponent", { needsConsent: true }, needAccount((p, me) => {
    const room = lobby.roomOfSocket(socket);
    const other = room && room.seats[room.otherSeat(socket.data.seat)];
    // A guest cannot be asked. The server's own players that pass for people are answered like
    // a person who hasn't replied yet (they are not told apart).
    if (other?.kind === "bot") return { ok: true, result: "sent" };
    if (!other || other.kind !== "human" || !other.userId) return { ok: false, error: "not_an_account" };
    return sendRequest(me, other.userId);
  }));

  on("friend_respond", {}, needAccount(async (p, me) => {
    const other = String(p.userId || "");
    const result = await respondToRequest(me, other, p.accept === true);
    if (result === "accepted") {
      forgetFriendIds(me, other);
      for (const s of socketsOf(other)) s.emit("friend_accepted", { id: me, name: socket.data.name });
    }
    return { ok: result !== "none", result };
  }));

  on("friend_remove", {}, needAccount(async (p, me) => {
    await removeFriend(me, String(p.userId || ""));
    forgetFriendIds(me, String(p.userId || ""));
    return { ok: true };
  }));
  on("friend_block", {}, needAccount(async (p, me) => {
    await blockUser(me, String(p.userId || ""));
    forgetFriendIds(me, String(p.userId || ""));
    return { ok: true };
  }));
  on("friend_unblock", {}, needAccount(async (p, me) => {
    await unblockUser(me, String(p.userId || ""));
    return { ok: true };
  }));

  // A player invites a friend to play: a private room, and the friend's app is told (what happens
  // depends on what the friend is doing, see inviteRule). Creating a room is Pro, as ever
  // (ROOMS_NEED_PRO): the one who invites. The friend plays free, Pro or not.
  on("friend_invite", { needsConsent: true }, async (p) => {
    const me = socket.data;
    const friendId = String(p.friendId || "");
    if (!me.userId || !me.pro) return { ok: false, error: "pro_required" };
    if (!(await areFriends(me.userId, friendId))) return { ok: false, error: "not_friends" };
    const state = stateOf(friendId);
    const rule = inviteRule(state);
    if (!rule.send) return { ok: false, error: rule.error, friendState: state };
    const res = lobby.createPrivate(socket);
    if (!res.ok) return res;
    const { invite, replaced } = invites.create({ fromId: me.userId, toId: friendId, code: res.code });
    for (const old of replaced) for (const s of socketsOf(old.toId)) s.emit("invite_expired", { inviteId: old.id }); // the old one is withdrawn
    for (const s of socketsOf(friendId)) {
      s.emit("friend_invite", { from: me.name, fromId: me.userId, code: res.code, inviteId: invite.id, soft: rule.soft, expiresAt: invite.expiresAt });
    }
    return { ...res, inviteId: invite.id, expiresAt: invite.expiresAt, friendState: state };
  });
  // ...the friend takes it (joining the room is the room_join with its code)...
  on("invite_accepted", {}, (p) => ({ ok: Boolean(invites.answer(String(p.inviteId || ""), socket.data.userId)) }));
  // ...or says no: the inviter hears it.
  on("invite_declined", {}, (p) => {
    const inv = invites.answer(String(p.inviteId || ""), socket.data.userId);
    const fromId = inv ? inv.fromId : String(p.fromId || "");
    for (const s of socketsOf(fromId)) s.emit("invite_declined", { name: socket.data.name, inviteId: p.inviteId });
    return { ok: true };
  });

  socket.on("disconnect", () => {
    const account = socket.data.presenceId;
    markOffline(socket);
    if (account) { invites.cancelFrom(account); announcePresence(account); }
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
