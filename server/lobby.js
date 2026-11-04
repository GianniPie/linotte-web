//----------- LOBBY ---------------
// Finds games for people: the random queue (free), private rooms joined with
// a short code or link (the host needs Pro, the guest doesn't), and putting a
// returning player back in the room they were in. Rooms live in memory.

import { Room } from "./room.js";
import { HumanBot } from "./humanBot.js";
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
  constructor(io) {
    this.io = io;
    this.queue = new Map(); // playerId -> { socket, timer }
    this.rooms = new Map(); // roomId -> Room
    this.byCode = new Map(); // code -> Room
    this.byPlayer = new Map(); // playerId -> Room
    setInterval(() => this.sweep(), 30 * 1000).unref();
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
      const room = new Room({ io: this.io, kind: "random", onClose: (r, why) => this.onRoomClose(r, why) });
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
    const room = new Room({ io: this.io, kind: "random", onClose: (r, why) => this.onRoomClose(r, why) });
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
    const room = new Room({ io: this.io, kind: "private", code: makeCode(this.byCode), onClose: (r, why) => this.onRoomClose(r, why) });
    this.register(room);
    room.addHuman(1, socket, me);
    this.byPlayer.set(me.playerId, room);
    return { ok: true, code: room.code };
  }

  joinByCode(socket, rawCode) {
    const me = socket.data;
    const code = normalizeCode(rawCode);
    const room = code && this.byCode.get(code);
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
  rejoin(socket) {
    const me = socket.data;
    const room = this.activeRoom(me.playerId);
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
      // Keep it around for ROOM_OVER_TTL_MS (see sweep) so a refresh can still
      // show the result, but free the code right away.
      if (room.code) this.byCode.delete(room.code);
    }
  }

  closeRoom(room) {
    room.dispose();
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
