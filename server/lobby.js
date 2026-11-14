//----------- LOBBY ---------------
// Finds games for people: the random queue (free), private rooms joined with
// a short code or link (the host needs Pro, the guest doesn't), and putting a
// returning player back in the room they were in. Rooms live in memory, with
// a copy in the game store (store.js) so they survive a server restart.

import { Room } from "./room.js";
import { HumanBot } from "./humanBot.js";
import { noStore } from "./store.js";
import { resultRows, recordResults, claimGameXp } from "./results.js";
import { grantDailyBonus } from "./bonuses.js";
import { noteFriends } from "./friends.js";
import { DAILY_BONUS_POINTS, canMeet } from "../public/shared/level.js";
import {
  QUEUE_BOT_DELAY_MS, ROOM_WAIT_TTL_MS, ROOM_OVER_TTL_MS,
} from "./config.js";

// No 0/O/1/I: a code read out loud or typed from a screenshot can't be misread.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

function makeCode(taken) {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
}

export function normalizeCode(raw) {
  const code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((ch) => CODE_ALPHABET.includes(ch)) ? code : null;
}

export class Lobby {
  // `record` saves finished games for the Stats screen (see results.js) and
  // `grantDaily` the first game of the day played to the end (bonuses.js); the smoke test passes
  // its own.
  // `afterRecord` brings a connection's own points up to date once its game
  // is saved (server.js).
  constructor(io, store = noStore, { record = recordResults, grantDaily = grantDailyBonus, befriend = noteFriends, afterRecord = async () => {}, claim = claimGameXp } = {}) {
    this.io = io;
    this.store = store;
    this.record = record;
    this.grantDaily = grantDaily;
    this.befriend = befriend;
    this.afterRecord = afterRecord;
    this.claim = claim;
    this.pending = new Map(); // userId -> a finished game whose points wait for the video
    this.queue = new Map(); // playerId -> { socket, timer }
    this.rooms = new Map(); // roomId -> Room
    this.byCode = new Map(); // code -> Room
    this.byPlayer = new Map(); // playerId -> Room
    this.restoring = new Map(); // roomId -> Promise<Room|null>, so two players coming back at once share one copy
    this.pendingSaves = new Set();
    setInterval(() => this.sweep(), 30 * 1000).unref();
  }

  newRoom(opts) {
    return new Room({ io: this.io, ...opts, onClose: (r, why) => this.onRoomClose(r, why), onChange: (r) => this.persist(r) });
  }

  //--------- saving (server restarts) ---------
  // Saves a room shortly after it changes: the moves of one tap arrive
  // together and become a single write.
  persist(room) {
    if (this.pendingSaves.has(room)) return;
    this.pendingSaves.add(room);
    setImmediate(() => {
      this.pendingSaves.delete(room);
      if (room.status === "over") this.store.deleteRoom(room);
      else if (this.rooms.get(room.id) === room) this.store.saveRoom(room);
    });
  }

  // Before this server stops: one last copy of every game.
  async saveAll() {
    await Promise.all([...this.rooms.values()].filter((r) => r.status !== "over").map((r) => this.store.saveRoom(r)));
  }

  // A game this server doesn't have in memory, picked up from the store.
  async restore(roomId) {
    if (!roomId) return null;
    if (this.rooms.has(roomId)) return this.rooms.get(roomId);
    if (!this.restoring.has(roomId)) {
      this.restoring.set(roomId, (async () => {
        const data = await this.store.loadRoom(roomId);
        if (this.rooms.has(roomId)) return this.rooms.get(roomId);
        if (!data || data.status === "over") return null;
        const room = Room.fromJSON(data, { io: this.io, onClose: (r, why) => this.onRoomClose(r, why), onChange: (r) => this.persist(r) });
        this.register(room);
        for (const s of [1, 2]) if (room.seats[s]?.kind === "human") this.byPlayer.set(room.seats[s].playerId, room);
        console.log(`restored ${room.kind} room ${room.id} (${room.status})`);
        return room;
      })().finally(() => this.restoring.delete(roomId)));
    }
    return this.restoring.get(roomId);
  }

  roomOfSocket(socket) {
    return this.rooms.get(socket.data.roomId) || null;
  }

  // The room a player is currently committed to (waiting for a friend, or
  // mid-game) -- finished games don't count, so they can queue again at once.
  activeRoom(playerId) {
    const room = this.byPlayer.get(playerId);
    return room && room.status !== "over" ? room : null;
  }

  register(room) {
    this.rooms.set(room.id, room);
    if (room.code) this.byCode.set(room.code, room);
  }

  seatPlayers(room, ...entries) {
    // entries: [{ socket, playerId, name, userId, pro, country, piece }] -- seats assigned in random order
    const order = Math.random() < 0.5 ? [1, 2] : [2, 1];
    entries.forEach((e, i) => {
      room.addHuman(order[i], e.socket, e);
      this.byPlayer.set(e.playerId, room);
    });
    return order;
  }

  //--------- random queue ---------
  joinQueue(socket) {
    const me = socket.data;
    if (this.activeRoom(me.playerId)) return { ok: false, error: "already_in_game" };
    this.leaveQueue(me.playerId);

    for (const [otherId, entry] of this.queue) {
      if (otherId === me.playerId || !entry.socket.connected) continue;
      // Below zero meets below zero; the rest within a wide range of levels
      // (canMeet in shared/level.js). No one suitable: the bot comes.
      if (!canMeet(me.level || 0, entry.socket.data.level || 0)) continue;
      this.leaveQueue(otherId);
      const room = this.newRoom({ kind: "random" });
      this.register(room);
      this.seatPlayers(room,
        { ...me, socket },
        { ...entry.socket.data, socket: entry.socket, playerId: otherId });
      room.start();
      return { ok: true, matched: true };
    }

    // Nobody waiting: after a random wait, a bot takes the other seat.
    const [lo, hi] = QUEUE_BOT_DELAY_MS;
    const timer = setTimeout(() => this.matchWithBot(me.playerId), lo + Math.random() * (hi - lo));
    this.queue.set(me.playerId, { socket, timer });
    return { ok: true, matched: false };
  }

  leaveQueue(playerId) {
    const entry = this.queue.get(playerId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.queue.delete(playerId);
    return true;
  }

  matchWithBot(playerId) {
    const entry = this.queue.get(playerId);
    if (!entry || !entry.socket.connected) { this.leaveQueue(playerId); return; }
    this.leaveQueue(playerId);
    const { socket } = entry;
    const room = this.newRoom({ kind: "random" });
    this.register(room);
    const humanSeat = this.seatPlayers(room, { ...socket.data, socket, playerId })[0];
    room.addBot(room.otherSeat(humanSeat), new HumanBot({ avoidName: socket.data.name }));
    room.start();
  }

  //--------- private rooms ---------
  createPrivate(socket) {
    const me = socket.data;
    if (this.activeRoom(me.playerId)) return { ok: false, error: "already_in_game" };
    this.leaveQueue(me.playerId);
    const room = this.newRoom({ kind: "private", code: makeCode(this.byCode) });
    this.register(room);
    room.addHuman(1, socket, me);
    this.byPlayer.set(me.playerId, room);
    return { ok: true, code: room.code };
  }

  async joinByCode(socket, rawCode) {
    const me = socket.data;
    const code = normalizeCode(rawCode);
    // a room created before a server restart is still in the store
    const room = code && (this.byCode.get(code) || await this.restore(await this.store.roomIdOfCode(code)));
    if (!room || room.status === "over") return { ok: false, error: "bad_code" };
    if (room.seatOf(me.playerId)) return { ok: false, error: "own_room" };
    if (room.status !== "waiting" || !room.freeSeat()) return { ok: false, error: "room_full" };
    if (this.activeRoom(me.playerId)) return { ok: false, error: "already_in_game" };
    this.leaveQueue(me.playerId);

    room.addHuman(room.freeSeat(), socket, me);
    this.byPlayer.set(me.playerId, room);
    room.start();
    return { ok: true };
  }

  //--------- coming back ---------
  async rejoin(socket) {
    const me = socket.data;
    let room = this.activeRoom(me.playerId);
    // After a server restart the game is in the store, not in memory.
    if (!room) {
      const restored = await this.restore(await this.store.roomIdOfPlayer(me.playerId));
      if (restored && restored.status !== "over" && restored.seatOf(me.playerId)) room = restored;
    }
    if (!room) return { ok: false };
    const seat = room.seatOf(me.playerId);
    room.onReconnect(seat, socket);
    if (room.status === "waiting") return { ok: true, status: "waiting", code: room.code };
    return { ok: true, status: "playing", snapshot: room.snapshot(seat) };
  }

  //--------- leaving ---------
  leaveRoom(socket) {
    const room = this.roomOfSocket(socket);
    if (!room) return;
    const seat = socket.data.seat;
    socket.leave(room.channel);
    socket.data.roomId = null;
    if (room.status === "waiting") {
      this.closeRoom(room);
    } else if (room.status === "playing") {
      room.forfeit(seat, "left");
    } else if (room.status === "over" && room.seats[seat]) {
      // Gone back to the home: no rematch with them any more.
      room.seats[seat].left = true;
      room.emitToSeat(room.otherSeat(seat), "rematch_declined", { left: true });
    }
  }

  //--------- rematch ---------
  // After a game either player may ask for another one against the same
  // opponent, in the same kind of room. A person has to accept; the
  // server's bot answers like one would (usually yes, after a moment).
  requestRematch(socket) {
    const room = this.roomOfSocket(socket);
    if (!room || room.status !== "over") return { ok: false, error: "no_game" };
    if (this.activeRoom(socket.data.playerId)) return { ok: false, error: "already_in_game" };
    const seat = socket.data.seat;
    const other = room.otherSeat(seat);
    const them = room.seats[other];
    if (!them || them.left || (them.kind === "human" && !them.connected)) return { ok: false, error: "opponent_left" };
    room.rematch = { ...room.rematch, [seat]: true };
    if (them.kind === "bot") {
      // The bot answers like a person (see humanize.js): usually yes, after a moment.
      const { accept, waitMs } = them.bot.answerRematch({ won: room.winner === other });
      setTimeout(() => (accept ? this.startRematch(room) : room.emitToSeat(seat, "rematch_declined", {})), waitMs);
      return { ok: true, waiting: true };
    }
    if (room.rematch[other]) return this.startRematch(room) ? { ok: true } : { ok: false, error: "opponent_left" };
    room.emitToSeat(other, "rematch_offer", {});
    return { ok: true, waiting: true };
  }

  // The player who was asked for a rematch says no: the one who asked is told.
  declineRematch(socket) {
    const room = this.roomOfSocket(socket);
    if (!room || room.status !== "over") return { ok: false, error: "no_game" };
    const other = room.otherSeat(socket.data.seat);
    if (room.rematch?.[other]) room.emitToSeat(other, "rematch_declined", {});
    room.rematch = {};
    return { ok: true };
  }

  // Both said yes: a new game with the same two players (and the same bot).
  startRematch(old) {
    if (old.rematchStarted || old.status !== "over") return false;
    const players = {};
    for (const s of [1, 2]) {
      const x = old.seats[s];
      if (x.kind === "bot") continue;
      const socket = this.io.sockets.sockets.get(x.socketId);
      // Still connected, and still looking at this game (not off in another).
      if (!socket?.connected || x.left || socket.data.roomId !== old.id || this.activeRoom(x.playerId)) {
        old.emitToSeat(old.otherSeat(s), "rematch_declined", { left: true });
        return false;
      }
      players[s] = socket;
    }
    old.rematchStarted = true;
    const room = this.newRoom({ kind: old.kind });
    this.register(room);
    for (const s of [1, 2]) {
      const x = old.seats[s];
      if (x.kind === "bot") {
        room.addBot(s, new HumanBot({ name: x.name, persona: x.bot.persona, country: x.bot.country ?? "" }));
      } else {
        players[s].leave(old.channel);
        room.addHuman(s, players[s], { ...players[s].data, playerId: x.playerId });
        this.byPlayer.set(x.playerId, room);
      }
    }
    room.start();
    this.closeRoom(old);
    return true;
  }

  handleDisconnect(socket) {
    this.leaveQueue(socket.data.playerId);
    const room = this.roomOfSocket(socket);
    if (!room) return;
    const seat = socket.data.seat;
    // Only the socket that currently owns the seat counts: a player who has
    // already reconnected on a new socket must not be marked gone again when
    // the old one finally times out.
    if (room.seats[seat]?.socketId === socket.id) room.onDisconnect(seat);
  }

  //--------- housekeeping ---------
  onRoomClose(room, why) {
    if (why === "over") {
      this.store.deleteRoom(room); // nothing left to resume
      const held = this.heldSeats(room);
      const recorded = this.record(resultRows(room, held));
      this.giveDailyBonus(room, recorded, held);
      this.tellRecorded(room, recorded);
      // Two accounts that played a private room are friends (friends.js).
      const [a, b] = [room.seats[1], room.seats[2]];
      if (room.kind === "private" && a?.userId && b?.userId) this.befriend(a.userId, b.userId);
      // Keep it around for ROOM_OVER_TTL_MS (see sweep) so a refresh can still
      // show the result, but free the code right away.
      if (room.code) this.byCode.delete(room.code);
    }
  }

  // Once the game is saved, each signed-in player's connection gets its new
  // points (what opponents and matching see) and its app is told ("recorded"),
  // so the level it shows is the server's, not a guess made too early.
  async tellRecorded(room, recorded) {
    await recorded;
    for (const seat of [1, 2]) {
      const p = room.seats[seat];
      if (p?.kind !== "human" || !p.userId) continue;
      const socket = this.io.sockets.sockets.get(p.socketId);
      if (!socket) continue;
      try { await this.afterRecord(socket); } catch (err) { console.error("stats not refreshed:", err.message); }
      socket.emit("recorded", {});
    }
  }

  // The first online game of the day played to its end is worth a bonus, won
  // or lost: it is there to bring players back every day, not to reward the
  // winner. Whoever left before the end doesn't get it. Once the game is
  // recorded, each player's app hears it ("bonus") and says so.
  async giveDailyBonus(room, recorded, held = new Set()) {
    await recorded;
    for (const seat of [1, 2]) {
      const player = room.seats[seat];
      if (player?.kind !== "human" || !player.userId || room.forfeitedBy === seat || held.has(seat)) continue;
      const socket = this.io.sockets.sockets.get(player.socketId);
      if (!(await this.grantDaily(player.userId, { tz: socket?.data?.tz }))) continue;
      socket?.emit("bonus", { kind: "daily", points: DAILY_BONUS_POINTS });
    }
  }

  // The points of a game wait for the video the app plays before its winner
  // card -- not Pro (no video), not a game left or let run out (it costs
  // points, which a closed video can't avoid), and only for an app that knows
  // to ask for them ("claims" in its hello): an older one gets them at once.
  // The game is recorded either way; its points count when the video has been
  // watched (claimPoints), and never if it is closed (skipPoints).
  heldSeats(room) {
    const held = new Set();
    for (const seat of [1, 2]) {
      const p = room.seats[seat];
      if (p?.kind !== "human" || !p.userId || p.pro || room.forfeitedBy === seat) continue;
      const socket = this.io.sockets.sockets.get(p.socketId);
      if (!socket?.data?.claims) continue;
      held.add(seat);
      this.pending.set(p.userId, { since: Date.now() - 30000 }); // 30 s of margin for the clocks of the server and the database
    }
    return held;
  }

  // The app watched the video: the game's points count, and the day's first
  // game brings its bonus. { ok, claimed, daily }.
  async claimPoints(socket) {
    const userId = socket.data.userId;
    const waiting = userId && this.pending.get(userId);
    if (!waiting) return { ok: true, claimed: false };
    this.pending.delete(userId);
    if (!(await this.claim(userId, waiting.since))) return { ok: false };
    const daily = await this.grantDaily(userId, { tz: socket.data.tz });
    try { await this.afterRecord(socket); } catch (err) { console.error("stats not refreshed:", err.message); }
    return { ok: true, claimed: true, daily: Boolean(daily), points: daily ? DAILY_BONUS_POINTS : 0 };
  }

  // The video was closed: the game earns nothing.
  skipPoints(socket) {
    this.pending.delete(socket.data.userId);
    return { ok: true };
  }

  closeRoom(room) {
    room.dispose();
    this.store.deleteRoom(room);
    this.rooms.delete(room.id);
    if (room.code) this.byCode.delete(room.code);
    for (const s of [1, 2]) {
      const pid = room.seats[s]?.playerId;
      if (pid && this.byPlayer.get(pid) === room) this.byPlayer.delete(pid);
    }
  }

  sweep() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (room.status === "waiting" && now - room.createdAt > ROOM_WAIT_TTL_MS) {
        room.emitToSeat(1, "room_expired", {});
        this.closeRoom(room);
      } else if (room.status === "over" && now - room.endedAt > ROOM_OVER_TTL_MS) {
        this.closeRoom(room);
      } else if (room.status === "playing") {
        const anyoneHere = [1, 2].some((s) => room.seats[s]?.kind === "human" && room.seats[s].connected);
        if (!anyoneHere && now - room.createdAt > ROOM_WAIT_TTL_MS) this.closeRoom(room);
      }
    }
  }
}
