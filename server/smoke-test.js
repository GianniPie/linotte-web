// Plays full games through the real Lobby/Room/HumanBot with fake sockets
// (no network), so the rules, validation, matchmaking and bot pacing can be
// checked in seconds:   BOT_TIME_SCALE=0.002 node server/smoke-test.js
import assert from "node:assert/strict";
import { Lobby } from "./lobby.js";
import { QUEUE_BOT_DELAY_MS } from "./config.js";
import {
  chooseCallToMake, chooseDiceToLock, shouldStopRolling, explainPlacement,
} from "../public/shared/botAI.js";

QUEUE_BOT_DELAY_MS[0] = 20; // don't wait 7s for the bot in a test
QUEUE_BOT_DELAY_MS[1] = 40;

//--------- fakes ---------
const channels = new Map(); // channel -> Set(socket)
const sockets = new Map(); // id -> socket
const io = {
  to(target) {
    return {
      emit(event, payload) {
        const group = channels.get(target) || new Set(sockets.has(target) ? [sockets.get(target)] : []);
        group.forEach((s) => s.inbox.push({ event, payload }));
      },
    };
  },
  in(channel) { return { socketsLeave() { channels.delete(channel); } }; },
};
let n = 0;
function fakeSocket(playerId, name) {
  const s = {
    id: "s" + ++n, connected: true, data: { playerId, name, consentVersion: 1 }, inbox: [],
    join(ch) { (channels.get(ch) || channels.set(ch, new Set()).get(ch)).add(s); },
    leave(ch) { channels.get(ch)?.delete(s); },
  };
  sockets.set(s.id, s);
  return s;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const find = (s, ev) => s.inbox.filter((m) => m.event === ev);

//--------- a scripted "human" that plays legally ---------
async function playTurn(room, seat) {
  const act = (a) => { const r = room.handleAction(seat, a); assert.ok(r.ok, `human action rejected: ${JSON.stringify(a)} -> ${r.reason}`); return r; };
  const strategy = "points";
  for (;;) {
    act({ type: "ROLL_DICE" });
    act({ type: "STOP_ROLL" });
    const s = room.state;
    if (s.dice.rollsLeft <= 0 || shouldStopRolling(s, seat, strategy)) break;
    const call = chooseCallToMake(s, seat, strategy);
    if (call != null) { const called = [null, null, null, 0, 0, 0, 0, 0]; called[call] = 1; act({ type: "SELEC_CALL", called }); }
    act({ type: "LOCK_DICE", locked: chooseDiceToLock(s.dice.values, s, seat, strategy) });
  }
  const ex = explainPlacement(room.state, seat, strategy);
  if (ex.chosen) act({ type: "PLACE_PIECE", coordinates: ex.chosen.rc, player: seat });
  act({ type: "END_TURN" });
}

async function runGame(room, humanSeat) {
  let guard = 0;
  while (room.status === "playing") {
    if (++guard > 400) throw new Error("game did not finish");
    if (room.state.currentPlayer === humanSeat) await playTurn(room, humanSeat);
    else await wait(2);
  }
}

//--------- tests ---------
const lobby = new Lobby(io);

// 1. random queue falls back to a bot, a full game finishes, nothing is rejected
{
  const me = fakeSocket("player-aaaaaaaa", "Wren11");
  assert.ok(lobby.joinQueue(me).ok);
  await wait(300);
  const start = find(me, "game_start")[0];
  assert.ok(start, "bot should have joined the queue after the wait");
  const room = lobby.roomOfSocket(me);
  assert.equal(room.botSeats().length, 1);
  const seat = me.data.seat;
  assert.equal(start.payload.seat, seat);
  await runGame(room, seat);
  assert.equal(room.status, "over");
  assert.ok(find(me, "game_over").length === 1);
  const actions = find(me, "action");
  assert.ok(actions.length > 20);
  assert.deepEqual(actions.map((m) => m.payload.seq), actions.map((_, i) => i + 1), "seq must be gapless");
  console.log(`ok: vs-bot game finished, winner=${room.winner}, ${actions.length} relayed actions, bot emotes=${find(me, "emote").length}`);
}

// 2. two humans in the queue are matched together
{
  const a = fakeSocket("player-bbbbbbbb", "Owl22");
  const b = fakeSocket("player-cccccccc", "Jay33");
  lobby.joinQueue(a);
  const res = lobby.joinQueue(b);
  assert.ok(res.matched);
  const room = lobby.roomOfSocket(a);
  assert.equal(room, lobby.roomOfSocket(b));
  assert.equal(room.botSeats().length, 0);
  assert.notEqual(a.data.seat, b.data.seat);
  console.log("ok: two humans matched without a bot");
}

// 3. validation: wrong turn, illegal tile, placing before rolling, stale actions
{
  const a = fakeSocket("player-dddddddd", "Dove44");
  const b = fakeSocket("player-eeeeeeee", "Kite55");
  lobby.joinQueue(a); lobby.joinQueue(b);
  const room = lobby.roomOfSocket(a);
  const cur = room.state.currentPlayer, other = cur === 1 ? 2 : 1;
  assert.equal(room.handleAction(other, { type: "ROLL_DICE" }).reason, "not_your_turn");
  assert.equal(room.handleAction(cur, { type: "PLACE_PIECE", coordinates: "22", player: cur }).reason, "illegal_move");
  assert.equal(room.handleAction(cur, { type: "LOCK_DICE", locked: [true, false, false, false, false] }).reason, "cannot_lock");
  assert.equal(room.handleAction(cur, { type: "STOP_ROLL" }).reason, "not_rolling");
  assert.equal(room.handleAction(cur, { type: "NUKE" }).reason, "bad_action");
  assert.ok(room.handleAction(cur, { type: "ROLL_DICE" }).ok);
  assert.equal(room.handleAction(cur, { type: "ROLL_DICE" }).reason, "cannot_roll", "no second roll while rolling");
  assert.equal(room.handleAction(cur, { type: "END_TURN" }).reason, "cannot_end");
  assert.ok(room.handleAction(cur, { type: "STOP_ROLL" }).ok);
  // a rejected action carries the authoritative state so the client can redraw
  assert.ok(room.handleAction(other, { type: "ROLL_DICE" }).snapshot.state);
  console.log("ok: invalid actions rejected");
}

// 4. private room: code join, own-room and bad-code errors, rejoin after a drop
{
  const host = fakeSocket("player-ffffffff", "Lark66");
  const guest = fakeSocket("player-gggggggg", "Tern77");
  const created = lobby.createPrivate(host);
  assert.ok(created.ok && /^[A-HJ-NP-Z2-9]{4}$/.test(created.code));
  assert.equal(lobby.joinByCode(host, created.code).error, "own_room");
  assert.equal(lobby.joinByCode(guest, "ZZZZ").error, "bad_code");
  assert.ok(lobby.joinByCode(guest, created.code.toLowerCase()).ok, "codes are case-insensitive");
  const room = lobby.roomOfSocket(guest);
  assert.equal(room.botSeats().length, 0, "private rooms never get a bot");
  assert.equal(room.status, "playing");

  // host's phone drops (e.g. went to WhatsApp) and comes back on a new socket
  host.connected = false;
  lobby.handleDisconnect(host);
  assert.equal(find(guest, "opponent_status").at(-1).payload.connected, false);
  const host2 = fakeSocket("player-ffffffff", "Lark66");
  const back = lobby.rejoin(host2);
  assert.ok(back.ok && back.status === "playing" && back.snapshot.state);
  assert.equal(find(guest, "opponent_status").at(-1).payload.connected, true);
  console.log("ok: private room, code join, disconnect and rejoin");
}

// 5. forfeit
{
  const a = fakeSocket("player-hhhhhhhh", "Pipit88");
  const b = fakeSocket("player-iiiiiiii", "Stork99");
  lobby.joinQueue(a); lobby.joinQueue(b);
  lobby.leaveRoom(a);
  assert.equal(find(b, "game_over").at(-1).payload.reason, "left");
  console.log("ok: leaving forfeits to the opponent");
}

console.log("all smoke tests passed");
process.exit(0);
