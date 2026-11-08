// Plays full games through the real Lobby/Room/HumanBot with fake sockets
// (no network), so the rules, validation, matchmaking and bot pacing can be
// checked in seconds:   BOT_TIME_SCALE=0.002 node server/smoke-test.js
import assert from "node:assert/strict";
import { Lobby } from "./lobby.js";
import { createMemoryStore } from "./store.js";
import { userIdFromToken, profileOf } from "./accounts.js";
import { isPro, forgetPro } from "./entitlements.js";
import { pickPieceIndexes, colorDistance } from "../public/shared/pieces.js";
import { recordResults } from "./results.js";
import { pieces } from "../public/shared/assets.js";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
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
  sockets: { sockets },
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
  // A time limit, not a count of loop rounds: the bot's turns are waited for
  // in 2ms steps, so a round count failed whenever the machine was busy.
  const deadline = Date.now() + 60000;
  while (room.status === "playing") {
    if (Date.now() > deadline) throw new Error("game did not finish within a minute");
    if (room.state.currentPlayer === humanSeat) await playTurn(room, humanSeat);
    else await wait(2);
  }
}

//--------- tests ---------
const store = createMemoryStore();
const lobby = new Lobby(io, store);

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

// 3b. rolling again takes a tentative piece back, in either order
{
  const a = fakeSocket("player-ffff0001", "Wren66");
  const b = fakeSocket("player-ffff0002", "Lark77");
  lobby.joinQueue(a); lobby.joinQueue(b);
  const room = lobby.roomOfSocket(a);
  const cur = room.state.currentPlayer;
  const place = () => {
    // make one free tile playable, whatever the dice showed
    const r = room.state.table.findIndex((row) => row.includes(0));
    const c = room.state.table[r].indexOf(0);
    room.state.possibleMoves[r][c] = 1;
    const coordinates = `${r}${c}`;
    assert.ok(room.handleAction(cur, { type: "PLACE_PIECE", coordinates, player: cur }).ok);
    return coordinates;
  };
  assert.ok(room.handleAction(cur, { type: "ROLL_DICE" }).ok);
  assert.ok(room.handleAction(cur, { type: "STOP_ROLL" }).ok);
  // this app: the cancel goes first, then the roll
  let at = place();
  assert.ok(room.handleAction(cur, { type: "PLACE_PIECE", coordinates: at, player: 0 }).ok);
  assert.ok(room.handleAction(cur, { type: "ROLL_DICE" }).ok);
  assert.equal(room.state.currentPosition, null);
  assert.ok(room.handleAction(cur, { type: "STOP_ROLL" }).ok);
  // older apps: the roll goes first, the cancel arrives while the dice roll
  at = place();
  assert.ok(room.handleAction(cur, { type: "ROLL_DICE" }).ok);
  const cancel = room.handleAction(cur, { type: "PLACE_PIECE", coordinates: at, player: 0 });
  assert.ok(cancel.ok, "a cancel while rolling must not be refused");
  assert.equal(room.state.currentPosition, null);
  // placing a new piece while the dice roll is still refused
  const r = room.state.table.findIndex((row) => row.includes(0));
  assert.equal(room.handleAction(cur, { type: "PLACE_PIECE", coordinates: `${r}${room.state.table[r].indexOf(0)}`, player: cur }).reason, "cannot_place");
  console.log("ok: rolling again takes a tentative piece back");
}

// 4. private room: code join, own-room and bad-code errors, rejoin after a drop
{
  const host = fakeSocket("player-ffffffff", "Lark66");
  const guest = fakeSocket("player-gggggggg", "Tern77");
  const created = lobby.createPrivate(host);
  assert.ok(created.ok && /^[A-HJ-NP-Z2-9]{4}$/.test(created.code));
  assert.equal((await lobby.joinByCode(host, created.code)).error, "own_room");
  assert.equal((await lobby.joinByCode(guest, "ZZZZ")).error, "bad_code");
  assert.ok((await lobby.joinByCode(guest, created.code.toLowerCase())).ok, "codes are case-insensitive");
  const room = lobby.roomOfSocket(guest);
  assert.equal(room.botSeats().length, 0, "private rooms never get a bot");
  assert.equal(room.status, "playing");

  // host's phone drops (e.g. went to WhatsApp) and comes back on a new socket
  host.connected = false;
  lobby.handleDisconnect(host);
  assert.equal(find(guest, "opponent_status").at(-1).payload.connected, false);
  const host2 = fakeSocket("player-ffffffff", "Lark66");
  const back = await lobby.rejoin(host2);
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

// 6. a server restart (every deploy) doesn't end the games being played
{
  // two people mid-game, a player mid-game against the bot, a friend room
  // still waiting for its guest
  const a = fakeSocket("player-jjjjjjjj", "Finch10"), b = fakeSocket("player-kkkkkkkk", "Robin20");
  lobby.joinQueue(a); lobby.joinQueue(b);
  const pvp = lobby.roomOfSocket(a);
  const cur = pvp.state.currentPlayer;
  assert.ok(pvp.handleAction(cur, { type: "ROLL_DICE" }).ok); // the dice are in the air when the server stops
  const solo = fakeSocket("player-llllllll", "Swift30");
  lobby.joinQueue(solo);
  await wait(100); // the bot takes the seat
  const vsBot = lobby.roomOfSocket(solo);
  assert.equal(vsBot.botSeats().length, 1);
  const host = fakeSocket("player-mmmmmmmm", "Gull40");
  const { code } = lobby.createPrivate(host);
  await wait(20); // saves are written right after each change

  const before = { pvp: JSON.stringify(pvp.state.table), seq: pvp.seq, turn: pvp.state.currentPlayer, bot: vsBot.seats[vsBot.botSeats()[0]].name };
  await lobby.saveAll();
  for (const r of [pvp, vsBot]) r.dispose(); // the old server is gone

  // the new server: empty memory, same store
  const lobby2 = new Lobby(io, store);
  const a2 = fakeSocket("player-jjjjjjjj", "Finch10"), b2 = fakeSocket("player-kkkkkkkk", "Robin20");
  const [ra, rb] = await Promise.all([lobby2.rejoin(a2), lobby2.rejoin(b2)]);
  assert.ok(ra.ok && rb.ok && ra.status === "playing", "both players get their game back");
  const pvp2 = lobby2.roomOfSocket(a2);
  assert.equal(pvp2, lobby2.roomOfSocket(b2), "one shared copy of the game");
  assert.equal(JSON.stringify(pvp2.state.table), before.pvp);
  assert.equal(pvp2.seq, before.seq);
  assert.equal(pvp2.state.currentPlayer, before.turn);
  assert.equal(pvp2.rolling, false, "a roll in the air is settled");
  // both seats are people: play each turn until the game ends
  const deadline = Date.now() + 60000;
  while (pvp2.status === "playing" && Date.now() < deadline) await playTurn(pvp2, pvp2.state.currentPlayer);
  assert.equal(pvp2.status, "over", "the restored game is played to the end");

  const solo2 = fakeSocket("player-llllllll", "Swift30");
  assert.ok((await lobby2.rejoin(solo2)).ok);
  const vsBot2 = lobby2.roomOfSocket(solo2);
  assert.equal(vsBot2.seats[vsBot2.botSeats()[0]].name, before.bot, "the same bot comes back");
  await runGame(vsBot2, solo2.data.seat);
  assert.equal(vsBot2.status, "over", "the bot plays on after the restart");

  const guest = fakeSocket("player-nnnnnnnn", "Wren50");
  assert.ok((await lobby2.joinByCode(guest, code)).ok, "a room code from before the restart still works");
  console.log("ok: games survive a server restart");
}

//--------- 7. accounts: only Linotte's own, valid tokens count ---------
{
  const url = "https://example.supabase.co";
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" }] });
  const sign = (claims, key = privateKey) => new SignJWT(claims).setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setIssuedAt().setExpirationTime(claims.exp ?? "1h").sign(key);
  const ok = await sign({ sub: "user-123", iss: `${url}/auth/v1`, aud: "authenticated" });
  assert.equal(await userIdFromToken(ok, { keys, url }), "user-123", "a valid token gives the account id");
  assert.equal(await userIdFromToken(undefined, { keys, url }), null, "no token: a guest");
  assert.equal(await userIdFromToken(ok, { keys, url: "" }), null, "accounts switched off: a guest");
  const otherProject = await sign({ sub: "user-123", iss: "https://other.supabase.co/auth/v1", aud: "authenticated" });
  assert.equal(await userIdFromToken(otherProject, { keys, url }), null, "another project's token is refused");
  const expired = await sign({ sub: "user-123", iss: `${url}/auth/v1`, aud: "authenticated", exp: Math.floor(Date.now() / 1000) - 60 });
  assert.equal(await userIdFromToken(expired, { keys, url }), null, "an expired token is refused");
  const forged = await sign({ sub: "user-123", iss: `${url}/auth/v1`, aud: "authenticated" }, (await generateKeyPair("ES256")).privateKey);
  assert.equal(await userIdFromToken(forged, { keys, url }), null, "a token signed by someone else is refused");
  console.log("ok: account tokens are checked");
}

//--------- 8. Pro: the verified account, asked to RevenueCat ---------
{
  const asked = [];
  const answer = (entitlements, status = 200) => async (url) => {
    asked.push(url);
    return { ok: status === 200, status, json: async () => ({ subscriber: { entitlements } }) };
  };
  const lifetime = answer({ pro: { expires_date: null } });
  const opts = { key: "sk_test", fetch: lifetime };
  assert.equal(await isPro({ userId: null }, opts), false, "a guest is never Pro");
  assert.equal(await isPro({ userId: "user-1" }, { ...opts, key: "" }), false, "no RevenueCat key: nobody is Pro");
  assert.equal(await isPro({ userId: "user-1" }, opts), true, "a lifetime purchase is Pro");
  assert.ok(asked.at(-1).endsWith("/subscribers/user-1"), "RevenueCat is asked about the account id");
  const n = asked.length;
  assert.equal(await isPro({ userId: "user-1" }, opts), true);
  assert.equal(asked.length, n, "the answer is cached");
  assert.equal(await isPro({ userId: "user-2" }, { key: "sk_test", fetch: answer({}) }), false, "no entitlement: not Pro");
  assert.equal(await isPro({ userId: "user-3" }, { key: "sk_test", fetch: answer({ pro: { expires_date: "2001-01-01T00:00:00Z" } }) }), false, "an expired one: not Pro");
  forgetPro("user-1");
  assert.equal(await isPro({ userId: "user-1" }, { key: "sk_test", fetch: answer({}, 500) }), false, "an outage with nothing cached: not Pro");
  assert.equal(await isPro({ devToken: "dev-pro" }, { key: "" }), true, "the developer token works outside production");
  console.log("ok: Pro comes from the account");
}

//--------- 9. profiles: only clean names, real pictures and countries ---------
{
  const url = "https://example.supabase.co";
  const reply = (rows, ok = true) => ({ url, fetch: async () => ({ ok, json: async () => rows }) });
  assert.deepEqual(await profileOf("t", reply([{ name: "Gianni", avatar: "p020", country: "IT" }])),
    { name: "Gianni", avatar: "p020", country: "IT" }, "a good profile is kept");
  assert.deepEqual(await profileOf("t", reply([{ name: "F.u.c.k", avatar: "p999", country: "XX" }])),
    { name: "", avatar: "", country: "" }, "a bad name, picture or country is dropped");
  assert.deepEqual(await profileOf("t", reply([])), { name: "", avatar: "", country: "" }, "no profile yet");
  assert.deepEqual(await profileOf("t", reply(null, false)), { name: "", avatar: "", country: "" }, "an error: nothing");
  assert.deepEqual(await profileOf("", reply([{ name: "Gianni" }])), { name: "", avatar: "", country: "" }, "a guest has none");
  console.log("ok: profiles are checked");
}

//--------- 10. favorite pieces ---------
{
  const hex = (i) => pieces[i].split("_")[1].slice(0, 6);
  for (let n = 0; n < 200; n++) {
    const [a, b] = pickPieceIndexes();
    assert.ok(a >= 8 && b >= 8 && a !== b, "two different playing pieces");
    assert.ok(colorDistance(hex(a), hex(b)) >= 120, "that look clearly different");
  }
  assert.equal(pickPieceIndexes(20, -1)[0], 20, "player 1's favorite");
  assert.equal(pickPieceIndexes(-1, 20)[1], 20, "player 2's favorite");
  const [a, b] = pickPieceIndexes(20, 20);
  assert.ok(a === 20 && b !== 20, "the same favorite: player 1 keeps it, player 2 gets another");
  assert.ok(pickPieceIndexes(3, -1)[0] >= 8, "a plain colour (pictures only) isn't a playing piece");
  console.log("ok: favorite pieces");
}

//--------- 11. stats: a finished online game is recorded for signed-in players ---------
{
  const recorded = [];
  const lobby3 = new Lobby(io, createMemoryStore(), { record: async (rows) => recorded.push(...rows) });
  const host = fakeSocket("player-statsaaa1", "Heron1");
  const guest = fakeSocket("player-statsbbb2", "Ibis2");
  host.data.userId = "user-host";
  assert.ok(lobby3.createPrivate(host).ok);
  const code = lobby3.roomOfSocket(host).code;
  assert.ok((await lobby3.joinByCode(guest, code)).ok);
  const room = lobby3.roomOfSocket(host);
  room.forfeit(guest.data.seat, "left");
  await wait(10);
  assert.equal(recorded.length, 1, "only the signed-in player gets a row");
  assert.deepEqual(
    { user: recorded[0].user_id, mode: recorded[0].mode, won: recorded[0].won, opponent: recorded[0].opponent, source: recorded[0].source },
    { user: "user-host", mode: "friend", won: true, opponent: "Ibis2", source: "server" });

  const sent = [];
  const ok = await recordResults(recorded, { key: "sb_secret_x", url: "https://example.supabase.co", fetch: async (u, o) => { sent.push([u, o]); return { ok: true }; } });
  assert.ok(ok && sent[0][0].endsWith("/rest/v1/game_results") && sent[0][1].headers.apikey === "sb_secret_x", "sent with the secret key");
  assert.equal(await recordResults(recorded, { key: "" }), false, "no key: nothing sent");
  console.log("ok: online results are recorded");
}

//--------- 12. rematch ---------
{
  const lobby4 = new Lobby(io, createMemoryStore(), { record: async () => {} });
  const a = fakeSocket("player-rematchaa1", "Owl1");
  const b = fakeSocket("player-rematchbb2", "Yak2");
  assert.ok(lobby4.createPrivate(a).ok);
  assert.ok((await lobby4.joinByCode(b, lobby4.roomOfSocket(a).code)).ok);
  const first = lobby4.roomOfSocket(a);
  first.forfeit(b.data.seat, "left");
  assert.equal(first.status, "over");

  const askA = lobby4.requestRematch(a);
  assert.ok(askA.ok && askA.waiting, "the first player waits for the other");
  assert.ok(find(b, "rematch_offer").length, "the other is asked");
  const askB = lobby4.requestRematch(b);
  assert.ok(askB.ok && !askB.waiting, "both said yes: a new game starts");
  const second = lobby4.roomOfSocket(a);
  assert.ok(second && second !== first && second.status === "playing", "a new game, already playing");
  assert.equal(lobby4.roomOfSocket(b), second, "with the same two players");
  assert.equal(second.kind, "private");

  // after this one, one player goes home: no rematch any more
  second.forfeit(a.data.seat, "left");
  lobby4.leaveRoom(b);
  assert.ok(find(a, "rematch_declined").length, "the one left behind is told");
  assert.equal(lobby4.requestRematch(a).error, "opponent_left");
  console.log("ok: rematch");
}

console.log("all smoke tests passed");
process.exit(0);
