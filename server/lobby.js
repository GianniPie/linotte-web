//----------- LOBBY ---------------
// Finds games for people: the random queue (free), private rooms joined with
// a short code or link (the host needs Pro, the guest doesn't), and putting a
// returning player back in the room they were in. Rooms live in memory, with
// a copy in the game store (store.js) so they survive a server restart.

import { Room } from "./room.js";
import { HumanBot } from "./humanBot.js";
import { noStore } from "./store.js";
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
  constructor(io, store = noStore) {
    this.io = io;
    this.store = store;
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
    // entries: [{ socket, playerId, name }] -- seats assigned in random order
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
      this.leaveQueue(otherId);
      const room = this.newRoom({ kind: "random" });
      this.register(room);
      this.seatPlayers(room,
        { socket, playerId: me.playerId, name: me.name },
        { socket: entry.socket, playerId: otherId, name: entry.socket.data.name });
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
    const humanSeat = this.seatPlayers(room, { socket, playerId, name: socket.data.name })[0];
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
    }
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
      // Keep it around for ROOM_OVER_TTL_MS (see sweep) so a refresh can still
      // show the result, but free the code right away.
      if (room.code) this.byCode.delete(room.code);
    }
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
