//----------- ROOM ---------------
// One game between two seats. A seat is a human (a socket) or a bot; the
// room treats both the same way: every action goes through handleAction(),
// which validates it against the server's own copy of the state, applies it
// with the shared engine, and relays it (numbered) to everyone in the room.
// That relay IS the live view: the player waiting for their turn gets every
// tap of the active player, in order, and replays it on their own screen.
//
// Transport-agnostic on purpose: the room only needs `io.to(id).emit`, so it
// can later move behind Redis or a Durable Object without touching the rules.

import { updateGame, canRoll, callAllowed } from "../public/shared/gameEngine.js";
import { createInitialGameState, rndNum } from "../public/shared/utils.js";
import { piecesPath, pieces } from "../public/shared/assets.js";
import { assignPieces, isPlayPiece } from "../public/shared/pieces.js";
import { tableSeat, ownsBackground, FREE_LOOKS } from "../public/shared/level.js";
import { NUDGE, NUDGE_COOLDOWN_MS, NUDGE_MAX_PER_GAME } from "../public/shared/chat.js";
import {
  TURN_SECONDS, TURN_SLACK_MS, TURN_GRACE_MS, COIN_FLIP_MS, IDLE_TURNS_LIMIT,
  RECONNECT_GRACE_MS, EMOTES,
} from "./config.js";
import { HumanBot } from "./humanBot.js";

const COORD = /^[0-4][0-4]$/;
const EMPTY_CALLED = () => [null, null, null, false, false, false, false, false];

const pieceOf = (i) => ({ pieceImage: piecesPath + pieces[i], color: "#" + pieces[i].split("_")[1].slice(0, 6) });

let roomCounter = 0;

export class Room {
  constructor({ io, kind, code = null, onClose = () => {}, onChange = () => {} }) {
    this.id = "r" + (++roomCounter).toString(36) + Math.random().toString(36).slice(2, 6);
    this.io = io;
    this.kind = kind; // "random" | "private"
    this.code = code;
    this.onClose = onClose;
    // Called after anything worth saving changed (see Lobby.persist): the
    // store keeps a copy so the game survives a server restart.
    this.onChange = onChange;
    this.seats = { 1: null, 2: null };
    this.status = "waiting"; // waiting -> playing -> over
    this.state = null;
    this.seq = 0;
    this.turnId = 0;
    this.rolling = false;
    this.winner = null;
    this.createdAt = Date.now();
    this.endedAt = 0;
    this.turnEndsAt = 0;
    this.turnTimer = null;
    this.rollGuard = null;
    this.graceTimers = {};
    this.idleTurns = {}; // seat -> turns in a row ended without a roll
    this.lastEmoteAt = {};
    this.nudges = {}; // seat -> { at, n }: the bell's limits (see emote)
  }

  get channel() { return "room:" + this.id; }

  //--------- seats ---------
  seatOf(playerId) {
    for (const s of [1, 2]) if (this.seats[s]?.playerId === playerId) return s;
    return 0;
  }

  freeSeat() { return !this.seats[1] ? 1 : !this.seats[2] ? 2 : 0; }

  addHuman(seat, socket, { playerId, name, userId = null, pro = false, country = "", piece = -1, level = 0, xp = 0, record = null, background = FREE_LOOKS.background }) {
    this.seats[seat] = {
      kind: "human", playerId, name, userId: userId || null, pro: Boolean(pro), country: country || "",
      level: Number(level) || 0, xp: Number(xp) || 0, record: record || { played: 0, won: 0 },
      // The background they'd show (the table, see tableSeat): only one
      // their level has unlocked (nothing can be bought yet).
      background: ownsBackground(background, xp) ? background : FREE_LOOKS.background, bought: false,
      // Choosing one's piece is part of Pro; the server checks it itself.
      piece: pro && isPlayPiece(piece) ? piece : -1, socketId: socket.id, connected: true,
    };
    this.bindSocket(seat, socket);
    this.onChange(this);
  }

  bindSocket(seat, socket) {
    this.seats[seat].socketId = socket.id;
    this.seats[seat].connected = true;
    socket.join(this.channel);
    socket.data.roomId = this.id;
    socket.data.seat = seat;
  }

  addBot(seat, bot) {
    this.seats[seat] = { kind: "bot", playerId: "bot-" + Math.random().toString(36).slice(2), name: bot.name, country: bot.country || "", connected: true, bot };
    bot.attach(this, seat);
  }

  otherSeat(seat) { return seat === 1 ? 2 : 1; }

  emitToSeat(seat, event, payload) {
    const s = this.seats[seat];
    if (s?.kind === "human" && s.connected) this.io.to(s.socketId).emit(event, payload);
  }

  broadcast(event, payload) { this.io.to(this.channel).emit(event, payload); }

  botSeats() { return [1, 2].filter((s) => this.seats[s]?.kind === "bot"); }

  //--------- lifecycle ---------
  start() {
    // Each player's favorite piece if they chose one (Pro), else a random
    // one; the two always look clearly different. When both want the same,
    // the higher level keeps it (see assignPieces in shared/pieces.js).
    const { pieces: [i1, i2], denied } = assignPieces(
      this.seats[1].piece, this.seats[1].level || 0, this.seats[2].piece, this.seats[2].level || 0);
    const [a, b] = [pieceOf(i1), pieceOf(i2)];
    const state = createInitialGameState();
    state.players[1].name = this.seats[1].name;
    state.players[2].name = this.seats[2].name;
    // Both players see who is Pro (a star by the name) and their flags.
    for (const s of [1, 2]) {
      state.players[s].pro = Boolean(this.seats[s].pro);
      state.players[s].country = this.seats[s].country || "";
      // Every signed-in player shows their level and online record (a guest's
      // can't be trusted: none; Pro adds a star and a frame to the badge).
      const signedIn = Boolean(this.seats[s].userId);
      state.players[s].level = signedIn ? this.seats[s].level || 0 : null;
      state.players[s].record = signedIn ? this.seats[s].record : null;
    }
    Object.assign(state.players[1], a);
    Object.assign(state.players[2], b);
    // The player who didn't get their favorite hears why (see startOnline).
    if (denied) state.players[denied].pieceDenied = true;
    // One background for both (the table), or each their own (null).
    const look = (x) => ({ xp: x.kind === "human" ? x.xp || 0 : 0, background: x.background ?? FREE_LOOKS.background, bought: Boolean(x.bought) });
    const table = tableSeat(look(this.seats[1]), look(this.seats[2]));
    state.tableLook = table ? { seat: table, background: look(this.seats[table]).background } : null;
    state.currentPlayer = Math.random() < 0.5 ? 1 : 2;
    this.state = state;
    this.starter = state.currentPlayer;
    this.status = "playing";
    this.idleTurns = {};
    this.seq = 0;
    this.turnId = 1;
    this.rolling = false;

    for (const seat of [1, 2]) this.emitToSeat(seat, "game_start", this.snapshot(seat, { fresh: true }));
    this.armTurnTimer(COIN_FLIP_MS);
    this.onChange(this);
    for (const seat of this.botSeats()) this.seats[seat].bot.onEvent("gameStart", { startDelay: COIN_FLIP_MS });
  }

  snapshot(seat, { fresh = false } = {}) {
    return {
      roomId: this.id,
      code: this.code,
      kind: this.kind,
      seat,
      fresh, // true only for the initial game_start (the client plays the coin flip)
      starter: this.starter,
      seq: this.seq,
      state: this.state,
      rolling: this.rolling,
      timeLeftMs: Math.max(0, this.turnEndsAt - Date.now()),
      opponentConnected: this.seats[this.otherSeat(seat)]?.connected ?? false,
    };
  }

  timeLeftMs() { return Math.max(0, this.turnEndsAt - Date.now() - TURN_GRACE_MS); }

  armTurnTimer(extraMs = 0) {
    clearTimeout(this.turnTimer);
    const ms = extraMs + TURN_SECONDS * 1000 + TURN_SLACK_MS + TURN_GRACE_MS;
    this.turnEndsAt = Date.now() + ms;
    this.turnTimer = setTimeout(() => this.onTurnTimeout(), ms);
  }

  // A seat that neither moved nor was auto-submitted by its own client (gone,
  // frozen, or a bot that stalled): end its turn for it, committing whatever
  // piece is already placed, exactly like the client's own clock would.
  onTurnTimeout() {
    if (this.status !== "playing") return;
    this.rolling = false;
    this.applyEndTurn(this.state.currentPlayer, { forced: true });
  }

  //--------- actions ---------
  handleAction(seat, raw) {
    if (this.status !== "playing") return this.reject("not_playing");
    if (!raw || typeof raw !== "object" || typeof raw.type !== "string") return this.reject("bad_action");
    if (seat !== this.state.currentPlayer) return this.reject("not_your_turn");

    const s = this.state;
    switch (raw.type) {
      case "ROLL_DICE": {
        // no roll left, or all five dice locked (nothing to roll)
        if (this.rolling || !canRoll(s)) return this.reject("cannot_roll");
        const values = s.dice.values.map((v, i) => (s.dice.locked[i] ? v : rndNum(1, 6)));
        updateGame(s, { type: "ROLL_DICE", values });
        this.rolling = true;
        // The client sends STOP_ROLL once its roll animation ends; if it never
        // does (app killed mid-roll), settle the roll ourselves.
        clearTimeout(this.rollGuard);
        this.rollGuard = setTimeout(() => this.settleRoll(seat), 6000);
        return this.relay(seat, { type: "ROLL_DICE", values: s.dice.values.slice(), rollsLeft: s.dice.rollsLeft });
      }
      case "STOP_ROLL": {
        if (!this.rolling) return this.reject("not_rolling");
        return this.settleRoll(seat);
      }
      case "LOCK_DICE": {
        if (this.rolling || s.dice.rollsLeft === 3) return this.reject("cannot_lock");
        const l = raw.locked;
        if (!Array.isArray(l) || l.length !== 5) return this.reject("bad_action");
        const locked = l.map(Boolean);
        updateGame(s, { type: "LOCK_DICE", locked });
        return this.relay(seat, { type: "LOCK_DICE", locked: locked.slice() });
      }
      case "SELEC_CALL": {
        if (this.rolling || s.dice.rollsLeft === 3) return this.reject("cannot_call");
        const c = raw.called;
        if (!Array.isArray(c) || c.length !== 8) return this.reject("bad_action");
        const called = EMPTY_CALLED();
        let n = 0;
        for (let i = 3; i < 8; i++) if (c[i]) { called[i] = 1; n++; }
        if (n > 1) return this.reject("bad_action"); // one call at a time
        // never mid-roll (above); never with all dice locked; a Carré never
        // with 4 locked (see callBlockedBy in gameEngine.js)
        for (let i = 3; i < 8; i++) if (called[i] && !callAllowed(s, i)) return this.reject("cannot_call");
        updateGame(s, { type: "SELEC_CALL", called });
        return this.relay(seat, { type: "SELEC_CALL", called: called.slice() });
      }
      case "PLACE_PIECE": {
        const coordinates = String(raw.coordinates ?? "");
        if (!COORD.test(coordinates)) return this.reject("bad_action");
        if (raw.player === 0) {
          // Allowed while the dice roll: rolling again takes the tentative
          // piece back, and a client that sent the roll first (older apps)
          // would otherwise see the cancel refused, its screen redrawn with
          // the piece still there, and that piece committed at END_TURN.
          // Taking back a tentative placement. A stale cancel for a tile that
          // isn't the pending one is ignored rather than cancelling the real one.
          if (s.currentPosition !== coordinates) return { ok: true, ignored: true };
          updateGame(s, { type: "PLACE_PIECE", coordinates, player: 0 });
          return this.relay(seat, { type: "PLACE_PIECE", coordinates, player: 0 });
        }
        if (this.rolling) return this.reject("cannot_place");
        const [r, c] = [Number(coordinates[0]), Number(coordinates[1])];
        if (s.possibleMoves[r][c] !== 1 || s.table[r][c] !== 0) return this.reject("illegal_move");
        updateGame(s, { type: "PLACE_PIECE", coordinates, player: seat });
        return this.relay(seat, { type: "PLACE_PIECE", coordinates, player: seat });
      }
      case "END_TURN": {
        if (this.rolling) return this.reject("cannot_end");
        return this.applyEndTurn(seat, { forced: false });
      }
      default:
        return this.reject("bad_action");
    }
  }

  settleRoll(seat) {
    clearTimeout(this.rollGuard);
    this.rolling = false;
    updateGame(this.state, { type: "STOP_ROLL" });
    return this.relay(seat, { type: "STOP_ROLL" });
  }

  applyEndTurn(seat, { forced }) {
    const s = this.state;
    const before = { 1: s.players[1].points, 2: s.players[2].points };
    // A turn that ends without a single roll (the player's own clock ran
    // out, or the server's): one more idle turn in a row.
    const idle = s.dice.rollsLeft === 3;
    clearTimeout(this.rollGuard);
    updateGame(s, { type: "END_TURN" });
    this.turnId++;
    const result = this.relay(seat, forced ? { type: "END_TURN", forced: true } : { type: "END_TURN" });

    if (this.seats[seat]?.kind === "human" && this.noteIdle(seat, idle)) {
      this.forfeit(seat, "idle");
      return result;
    }

    const gained = { 1: s.players[1].points - before[1], 2: s.players[2].points - before[2] };
    const noPieces = s.players[1].remainingPieces === 0 || s.players[2].remainingPieces === 0;
    if (noPieces || s.isFive) {
      this.finish(this.winnerByPoints(), "normal");
    } else {
      this.armTurnTimer();
      for (const b of this.botSeats()) this.seats[b].bot.onEvent("turnEnded", { by: seat, gained });
      for (const b of this.botSeats()) if (s.currentPlayer === b) this.seats[b].bot.onEvent("turn", {});
    }
    return result;
  }

  winnerByPoints() {
    const [a, b] = [this.state.players[1].points, this.state.players[2].points];
    return a > b ? 1 : a < b ? 2 : 0;
  }

  relay(seat, action) {
    const seq = ++this.seq;
    this.broadcast("action", { seq, seat, action });
    this.onChange(this);
    return { ok: true, seq };
  }

  reject(reason) {
    return { ok: false, reason, snapshot: this.status === "playing" ? this.snapshotForResync() : null };
  }

  // Per-seat fields (seat, opponentConnected) are filled in by the caller's
  // socket via roomSnapshot(); a rejection just needs the shared part.
  snapshotForResync() {
    return { roomId: this.id, seq: this.seq, state: this.state, rolling: this.rolling, starter: this.starter, timeLeftMs: Math.max(0, this.turnEndsAt - Date.now()) };
  }

  //--------- emotes ---------
  emote(seat, id) {
    if (this.status !== "playing" || !EMOTES.includes(id)) return { ok: false };
    const now = Date.now();
    if (now - (this.lastEmoteAt[seat] || 0) < 800) return { ok: false };
    // The bell (a nudge: the board shakes and rings for both) is limited: one
    // every 10 seconds and 5 a game, or it becomes a nuisance.
    if (id === NUDGE) {
      const sent = this.nudges[seat] || { at: 0, n: 0 };
      if (now - sent.at < NUDGE_COOLDOWN_MS || sent.n >= NUDGE_MAX_PER_GAME) return { ok: false, error: "nudge_limit" };
      this.nudges[seat] = { at: now, n: sent.n + 1 };
    }
    this.lastEmoteAt[seat] = now;
    const other = this.otherSeat(seat);
    this.emitToSeat(other, "emote", { from: seat, id });
    if (this.seats[other]?.kind === "bot") this.seats[other].bot.onEvent("emote", { id });
    return { ok: true };
  }

  //--------- connection changes ---------
  onDisconnect(seat) {
    const s = this.seats[seat];
    if (!s || s.kind !== "human") return;
    s.connected = false;
    if (this.status !== "playing") return; // a waiting host may be off sharing the invite link
    this.emitToSeat(this.otherSeat(seat), "opponent_status", { connected: false });
    clearTimeout(this.graceTimers[seat]);
    this.graceTimers[seat] = setTimeout(() => this.forfeit(seat, "disconnect"), RECONNECT_GRACE_MS);
  }

  onReconnect(seat, socket) {
    clearTimeout(this.graceTimers[seat]);
    this.bindSocket(seat, socket);
    this.emitToSeat(this.otherSeat(seat), "opponent_status", { connected: true });
  }

  // Counts a seat's idle turns in a row (see IDLE_TURNS_LIMIT) and tells
  // both players when the count changes, so the apps can warn them. True
  // when the seat has reached the limit.
  noteIdle(seat, idle) {
    const was = this.idleTurns[seat] || 0;
    const now = idle ? was + 1 : 0;
    this.idleTurns[seat] = now;
    if (now !== was) this.broadcast("idle", { seat, turns: now, limit: IDLE_TURNS_LIMIT });
    return now >= IDLE_TURNS_LIMIT;
  }

  forfeit(seat, reason) {
    if (this.status !== "playing") return;
    // Abandoned: costs level points (see results.js). Except leaving a game
    // the opponent had already given up on: gone (disconnected) or idle.
    const other = this.seats[this.otherSeat(seat)];
    const excused = reason === "left" && other?.kind === "human"
      && (!other.connected || (this.idleTurns[this.otherSeat(seat)] || 0) > 0);
    this.forfeitedBy = excused ? 0 : seat;
    this.finish(this.otherSeat(seat), reason);
  }

  finish(winner, reason) {
    if (this.status === "over") return;
    this.status = "over";
    this.winner = winner;
    this.endedAt = Date.now();
    clearTimeout(this.turnTimer);
    clearTimeout(this.rollGuard);
    Object.values(this.graceTimers).forEach(clearTimeout);
    this.broadcast("game_over", { winner, reason });
    for (const b of this.botSeats()) this.seats[b].bot.onEvent("gameOver", { winner });
    this.onClose(this, "over");
  }

  //--------- saving and restoring (server restarts) ---------
  // Everything needed to pick the game up again on another server. Sockets,
  // timers and the bot's running turn are not saved: they are rebuilt.
  toJSON() {
    const seat = (s) => {
      const x = this.seats[s];
      if (!x) return null;
      if (x.kind === "bot") return { kind: "bot", playerId: x.playerId, name: x.name, bot: x.bot.toJSON() };
      return { kind: "human", playerId: x.playerId, name: x.name, userId: x.userId || null, pro: Boolean(x.pro), country: x.country || "", level: x.level || 0, record: x.record || null };
    };
    return {
      v: 1,
      id: this.id, kind: this.kind, code: this.code, status: this.status,
      state: this.state, seq: this.seq, turnId: this.turnId, rolling: this.rolling,
      starter: this.starter, winner: this.winner, forfeitedBy: this.forfeitedBy || 0, idleTurns: this.idleTurns,
      createdAt: this.createdAt, endedAt: this.endedAt, turnEndsAt: this.turnEndsAt,
      seats: { 1: seat(1), 2: seat(2) },
    };
  }

  // Rebuilds a saved game on this server. Its players are offline until they
  // reconnect (their apps do it by themselves and call rejoin); each gets the
  // usual reconnect grace before forfeiting. A roll that was in the air is
  // settled, the turn clock resumes where it was (with a little extra for the
  // time the restart took) and a bot whose turn it is starts playing again.
  static fromJSON(data, { io, onClose, onChange }) {
    const room = new Room({ io, kind: data.kind, code: data.code, onClose, onChange });
    room.id = data.id;
    Object.assign(room, {
      status: data.status, state: data.state, seq: data.seq, turnId: data.turnId,
      starter: data.starter, winner: data.winner, forfeitedBy: data.forfeitedBy || 0, idleTurns: data.idleTurns || {},
      createdAt: data.createdAt, endedAt: data.endedAt,
    });
    for (const s of [1, 2]) {
      const x = data.seats[s];
      if (!x) continue;
      if (x.kind === "bot") {
        room.seats[s] = { kind: "bot", playerId: x.playerId, name: x.name, country: x.bot?.country || "", connected: true, bot: HumanBot.fromJSON(x.bot) };
        room.seats[s].bot.attach(room, s);
      } else {
        room.seats[s] = { kind: "human", playerId: x.playerId, name: x.name, userId: x.userId || null, pro: Boolean(x.pro), country: x.country || "", level: x.level || 0, record: x.record || { played: 0, won: 0 }, socketId: null, connected: false };
      }
    }
    if (room.status !== "playing") return room;

    if (data.rolling) updateGame(room.state, { type: "STOP_ROLL" });
    room.rolling = false;
    const left = Math.max(data.turnEndsAt - Date.now(), 0) + 10000;
    clearTimeout(room.turnTimer);
    room.turnEndsAt = Date.now() + left;
    room.turnTimer = setTimeout(() => room.onTurnTimeout(), left);
    for (const s of [1, 2]) {
      if (room.seats[s]?.kind !== "human") continue;
      room.graceTimers[s] = setTimeout(() => room.forfeit(s, "disconnect"), RECONNECT_GRACE_MS);
    }
    const botTurn = room.botSeats().find((b) => room.state.currentPlayer === b);
    if (botTurn) setTimeout(() => room.seats[botTurn]?.bot.onEvent("turn", {}), 1500);
    return room;
  }

  // Releases timers and bots; the lobby drops its references.
  dispose() {
    clearTimeout(this.turnTimer);
    clearTimeout(this.rollGuard);
    Object.values(this.graceTimers).forEach(clearTimeout);
    for (const b of this.botSeats()) this.seats[b].bot.stop();
    this.io.in(this.channel).socketsLeave(this.channel);
  }
}
