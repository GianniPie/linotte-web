// Plays full games through the real Lobby/Room/HumanBot with fake sockets
// (no network), so the rules, validation, matchmaking and bot pacing can be
// checked in seconds:   BOT_TIME_SCALE=0.002 node server/smoke-test.js
import assert from "node:assert/strict";
import { Lobby } from "./lobby.js";
import { createMemoryStore } from "./store.js";
import { userIdFromToken, profileOf } from "./accounts.js";
import { isPro, forgetPro } from "./entitlements.js";
import { pickPieceIndexes, assignPieces, colorDistance } from "../public/shared/pieces.js";
import { recordResults, experience, accountStats, resultRows } from "./results.js";
import { levelOf, levelStart } from "../public/shared/level.js";
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
    emit(event, payload) { s.inbox.push({ event, payload }); },
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
    const locked = chooseDiceToLock(s.dice.values, s, seat, strategy);
    act({ type: "LOCK_DICE", locked });
    if (locked.every(Boolean)) break; // keeping all five: nothing to roll (see canRoll)
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
  // A grant (pro_grants) makes an account Pro without any purchase.
  const grants = (rows) => async (u) => ({ ok: true, json: async () => (u.includes("/rest/v1/pro_grants") ? rows : {}) });
  assert.equal(await isPro({ userId: "user-granted" }, { key: "", grantKey: "sb_secret_x", url: "https://example.supabase.co", fetch: grants([{ user_id: "user-granted" }]) }), true, "a granted account is Pro");
  assert.equal(await isPro({ userId: "user-plain" }, { key: "", grantKey: "sb_secret_x", url: "https://example.supabase.co", fetch: grants([]) }), false, "no grant, no purchase: not Pro");
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
  // Two Pro players want the same piece: the higher level keeps it.
  let r = assignPieces(20, 1, 20, 5);
  assert.ok(r.pieces[1] === 20 && r.pieces[0] !== 20 && r.denied === 1, "the higher level (seat 2) keeps it");
  r = assignPieces(20, 7, 20, 2);
  assert.ok(r.pieces[0] === 20 && r.pieces[1] !== 20 && r.denied === 2, "the higher level (seat 1) keeps it");
  assert.equal(assignPieces(20, 3, 20, 3, () => 0.9).denied, 1, "a tie: drawn (seat 2 here)");
  assert.equal(assignPieces(20, 3, 20, 3, () => 0.1).denied, 2, "a tie: drawn (seat 1 here)");
  r = assignPieces(20, 0, -1, 0);
  assert.ok(r.pieces[0] === 20 && r.denied === 0, "only one favorite: nobody is denied");
  for (let n = 0; n < 50; n++) {
    const [x, y] = assignPieces(20, 1, 20, 2).pieces;
    assert.ok(colorDistance(hex(x), hex(y)) >= 120, "still clearly different");
  }
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
  const range = (v) => async (u, o) => { sent.push([u, o]); return { headers: { get: () => v } }; };
  const quit = resultRows({ kind: "random", winner: 1, forfeitedBy: 2,
    seats: { 1: { kind: "human", userId: "a", name: "A" }, 2: { kind: "human", userId: "b", name: "B" } },
    state: { players: { 1: { points: 3 }, 2: { points: 5 } } } });
  assert.deepEqual(quit.map((r) => [r.user_id, r.won, r.abandoned]), [["a", true, false], ["b", false, true]], "the one who left abandoned");
  // The host stayed: no penalty; the guest left (no account, so no row).
  assert.equal(recorded[0].abandoned, false, "the one who stayed didn't abandon");
  // Online wins +2, lost or drawn to the end +1, bot wins +1 for every 5,
  // abandoned games -2, 2 daily bonuses +2 each, 3 ads +1 each
  // (here 2*42 + 7 + 13/5 - 2*3 + 2*2 + 3 = 94).
  const counts = async (u, o) => {
    sent.push([u, o]);
    const n = u.includes("kind=eq.daily") ? 2 : u.includes("kind=eq.ad") ? 3
      : u.includes("abandoned=is.true") ? 3 : u.includes("mode=eq.bot") ? 13 : u.includes("won=is.false") ? 7 : 42;
    return { ok: true, headers: { get: () => `0-0/${n}` } };
  };
  assert.equal(await experience("user-host", { key: "k", url: "https://example.supabase.co", fetch: counts }), 94, "experience is counted, bonuses included");
  const stats = await accountStats("user-host", { key: "k", url: "https://example.supabase.co", fetch: counts });
  assert.deepEqual(stats.record, { played: 52, won: 42 }, "the online record: 42 won of 52 (42 + 7 finished + 3 abandoned)");
  const asked = sent.slice(-6).map(([u]) => u);
  assert.ok(asked.some((u) => u.includes("source=eq.server&won=is.true")), "online wins from the server");
  assert.ok(asked.some((u) => u.includes("won=is.false&abandoned=is.false")), "online games finished without winning");
  assert.ok(asked.some((u) => u.includes("mode=eq.bot") && u.includes("from_guest=is.false")), "bot wins, not the guest's");
  assert.ok(asked.some((u) => u.includes("source=eq.server&abandoned=is.true")), "abandoned games");
  const none = async () => ({ ok: true, headers: { get: () => "*/0" } });
  assert.equal(await experience("user-host", { key: "k", url: "https://example.supabase.co", fetch: none }), 0, "none yet");
  assert.equal(await experience(null, { key: "k" }), 0, "a guest has none");
  assert.deepEqual([-15, -14, -5, -4, 0, 4, 5, 14, 15, 30, 274, 275, 324, 325, 775, 1275].map(levelOf),
    [-2, -1, -1, 0, 0, 0, 1, 1, 2, 3, 9, 10, 10, 11, 20, 30], "levels: 5 points more each, then 50 each from level 10");
  assert.deepEqual([-2, -1, 0, 1, 3, 10, 11, 20].map(levelStart), [-29, -14, -4, 5, 30, 275, 325, 775], "where levels start");
  assert.ok(!Object.is(levelOf(-1), -0), "never -0");
  console.log("ok: online results are recorded");
}

//--------- 13. idle players: 3 turns in a row without a roll lose the game ---------
{
  const recorded = [];
  const lobby5 = new Lobby(io, createMemoryStore(), { record: async (rows) => recorded.push(...rows) });
  const a = fakeSocket("player-idleaaaa1", "Moth1");
  const b = fakeSocket("player-idlebbbb2", "Newt2");
  a.data.userId = "user-a"; b.data.userId = "user-b";
  assert.ok(lobby5.createPrivate(a).ok);
  assert.ok((await lobby5.joinByCode(b, lobby5.roomOfSocket(a).code)).ok);
  const room = lobby5.roomOfSocket(a);
  const idleSeat = room.state.currentPlayer;
  const busySeat = room.otherSeat(idleSeat);
  const idleSock = idleSeat === a.data.seat ? a : b;
  const busySock = idleSock === a ? b : a;
  const skip = () => assert.ok(room.handleAction(idleSeat, { type: "END_TURN" }).ok, "a turn may end without a roll (the clock ran out)");

  skip(); await playTurn(room, busySeat);
  skip(); await playTurn(room, busySeat);
  assert.equal(room.status, "playing", "two idle turns: still playing");
  const told = find(busySock, "idle").at(-1)?.payload;
  assert.deepEqual(told, { seat: idleSeat, turns: 2, limit: 3 }, "both are told how many");
  skip();
  assert.equal(room.status, "over", "the third idle turn ends the game");
  assert.equal(room.winner, busySeat, "the other player wins");
  assert.equal(find(idleSock, "game_over").at(-1)?.payload.reason, "idle");
  await wait(10);
  const rowOf = (u) => recorded.find((r) => r.user_id === u);
  assert.equal(rowOf(idleSock.data.userId).abandoned, true, "the idle player abandoned");
  assert.equal(rowOf(busySock.data.userId).abandoned, false);

  // Playing again resets the count.
  const c = fakeSocket("player-idlecccc3", "Wren3");
  const d = fakeSocket("player-idledddd4", "Toad4");
  assert.ok(lobby5.createPrivate(c).ok);
  assert.ok((await lobby5.joinByCode(d, lobby5.roomOfSocket(c).code)).ok);
  const r2 = lobby5.roomOfSocket(c);
  const p = r2.state.currentPlayer, q = r2.otherSeat(p);
  r2.handleAction(p, { type: "END_TURN" }); await playTurn(r2, q);
  await playTurn(r2, p); await playTurn(r2, q);
  assert.equal(r2.idleTurns[p], 0, "a played turn clears the idle count");

  // Leaving a game whose opponent is idle (or gone) costs nothing.
  r2.handleAction(p, { type: "END_TURN" });
  r2.forfeit(q, "left");
  assert.equal(r2.forfeitedBy, 0, "leaving an idle opponent is not abandoning");
  console.log("ok: idle players");
}

//--------- 14. bonuses: daily first win, ad rewards, the week ---------
{
  const { weekStart, grantAdReward, todayStatus, grantDailyBonus } = await import("./bonuses.js");
  const monday = weekStart(new Date("2026-11-11T15:00:00Z")); // a Wednesday
  assert.equal(monday.toISOString(), "2026-11-09T00:00:00.000Z", "the week starts on Monday, 00:00 UTC");
  assert.equal(weekStart(new Date("2026-11-09T00:00:00Z")).toISOString(), "2026-11-09T00:00:00.000Z");
  assert.equal(weekStart(new Date("2026-11-15T23:59:00Z")).toISOString(), "2026-11-09T00:00:00.000Z", "Sunday is still the same week");

  // A fake xp_bonuses table.
  const rows = [];
  const db = async (u, o) => {
    if (o.method === "POST") {
      const row = JSON.parse(o.body);
      if (row.kind === "daily" && rows.some((r) => r.kind === "daily" && r.user_id === row.user_id && r.day === row.day)) return { ok: false, status: 409 };
      rows.push(row);
      return { ok: true };
    }
    const kind = u.match(/kind=eq\.(\w+)/)[1];
    const n = rows.filter((r) => r.kind === kind).length;
    return { ok: true, headers: { get: () => `0-0/${n}` } };
  };
  const opt = { key: "k", url: "https://example.supabase.co", fetch: db };
  assert.equal(await grantDailyBonus("u1", opt), true, "the first win of the day gets the bonus");
  assert.equal(await grantDailyBonus("u1", opt), false, "the second doesn't");
  assert.equal((await todayStatus("u1", opt)).dailyDone, true);
  for (let i = 5; i > 0; i--) assert.deepEqual(await grantAdReward("u1", opt), { ok: true, adsLeft: i - 1 }, "an ad: +1");
  assert.deepEqual(await grantAdReward("u1", opt), { ok: false, adsLeft: 0 }, "5 a day at most");

  // The lobby gives the winner the daily bonus once the game is recorded.
  const given = [];
  const lobby6 = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async (u) => { given.push(u); return true; } });
  const w = fakeSocket("player-bonusaaa1", "Lynx1");
  const l = fakeSocket("player-bonusbbb2", "Mole2");
  w.data.userId = "user-w"; l.data.userId = "user-l";
  assert.ok(lobby6.createPrivate(w).ok);
  assert.ok((await lobby6.joinByCode(l, lobby6.roomOfSocket(w).code)).ok);
  lobby6.roomOfSocket(w).forfeit(l.data.seat, "left");
  await wait(10);
  assert.deepEqual(given, ["user-w"], "only the winner");
  assert.deepEqual(find(w, "bonus").at(-1)?.payload, { kind: "daily", points: 2 }, "and their app is told");
  console.log("ok: bonuses");
}

//--------- 15. friends: private games between accounts, who's online ---------
{
  const { markOnline, markOffline, isOnline, socketsOf, friendsOf } = await import("./friends.js");
  const pairs = [];
  const lobby7 = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async () => false, befriend: async (a, b) => pairs.push([a, b]) });
  const a = fakeSocket("player-friendaa1", "Puma1");
  const b = fakeSocket("player-friendbb2", "Seal2");
  a.data.userId = "user-fa"; b.data.userId = "user-fb";
  assert.ok(lobby7.createPrivate(a).ok);
  assert.ok((await lobby7.joinByCode(b, lobby7.roomOfSocket(a).code)).ok);
  lobby7.roomOfSocket(a).forfeit(b.data.seat, "left");
  assert.deepEqual(pairs, [["user-fa", "user-fb"]], "a private game between two accounts makes them friends");

  // A random game doesn't.
  const c = fakeSocket("player-friendcc3", "Crow3");
  c.data.userId = "user-fc";
  const room = lobby7.newRoom({ kind: "random" });
  lobby7.register(room);
  room.addHuman(1, c, c.data);
  room.addHuman(2, a, a.data);
  room.start();
  room.forfeit(1, "left");
  assert.equal(pairs.length, 1, "a random opponent isn't a friend");

  markOnline(a);
  assert.ok(isOnline("user-fa") && socketsOf("user-fa").length === 1, "online while connected");
  markOffline(a);
  assert.ok(!isOnline("user-fa"), "offline once gone");
  assert.deepEqual(await friendsOf("user-fa", { key: "" }), [], "no database: no friends");

  const rows = [{ friend_id: "user-fb", name: null, country: "IT", games: 3, week_points: 7 }];
  const list = await friendsOf("user-fa", { key: "k", url: "https://example.supabase.co", fetch: async () => ({ ok: true, text: async () => JSON.stringify(rows) }) });
  assert.equal(list[0].id, "user-fb");
  assert.ok(list[0].name.length > 0, "a friend without a profile name gets their animal name");
  assert.equal(list[0].weekPoints, 7);
  console.log("ok: friends");
}

//--------- 16. the table's background, matching by level ---------
{
  const { tableSeat, canMeet, ownsBackground } = await import("../public/shared/level.js");
  const p = (xp, background = 4, bought = false) => ({ xp, background, bought });
  assert.equal(tableSeat(p(300), p(120)), 1, "more points: their table");
  assert.equal(tableSeat(p(120), p(300)), 2);
  assert.equal(tableSeat(p(310), p(320)), 2, "the same level: the exact points decide");
  assert.equal(tableSeat(p(50), p(50)), 0, "equal points: each their own");
  assert.equal(tableSeat(p(5, 4, true), p(900)), 1, "a bought background wins over any level");
  assert.equal(tableSeat(p(5, 4, true), p(900, 6, true)), 0, "two bought: each their own");
  assert.ok(ownsBackground(4, 0) && !ownsBackground(8, 0) && ownsBackground(8, 775), "a background is shown only once unlocked");

  assert.ok(canMeet(-1, -3), "below zero meets below zero");
  assert.ok(!canMeet(-1, 0) && !canMeet(0, -1), "...and nobody else");
  assert.ok(canMeet(0, 10) && !canMeet(0, 11), "the others within 10 levels");

  // In the queue: a player below zero is passed over.
  const lobby8 = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async () => false, befriend: async () => {} });
  const quitter = fakeSocket("player-matchqq1", "Gnu1");
  const fresh = fakeSocket("player-matchff2", "Ant2");
  const vet = fakeSocket("player-matchvv3", "Elk3");
  quitter.data.level = -1; fresh.data.level = 0; vet.data.level = 30;
  assert.equal(lobby8.joinQueue(quitter).matched, false);
  assert.equal(lobby8.joinQueue(fresh).matched, false, "a level 0 player doesn't meet one below zero");
  assert.equal(lobby8.joinQueue(vet).matched, false, "nor one 30 levels away");
  const fresh2 = fakeSocket("player-matchff4", "Bee4");
  fresh2.data.level = 3;
  assert.equal(lobby8.joinQueue(fresh2).matched, true, "but one 3 levels away");
  assert.equal(lobby8.roomOfSocket(fresh2), lobby8.roomOfSocket(fresh));

  // The room picks the table.
  const rich = fakeSocket("player-matchrr5", "Owl5");
  const poor = fakeSocket("player-matchpp6", "Fox6");
  Object.assign(rich.data, { userId: "u-rich", level: 10, xp: 300, background: 3, record: { played: 20, won: 12 } });
  Object.assign(poor.data, { userId: "u-poor", level: 1, xp: 8, background: 0 });
  assert.ok(lobby8.createPrivate(rich).ok);
  assert.ok((await lobby8.joinByCode(poor, lobby8.roomOfSocket(rich).code)).ok);
  const room = lobby8.roomOfSocket(rich);
  assert.equal(room.state.players[rich.data.seat].level, 10, "a signed-in player shows their level, Pro or not");
  assert.deepEqual(room.state.players[rich.data.seat].record, { played: 20, won: 12 }, "and their online record");
  assert.deepEqual(room.state.tableLook, { seat: rich.data.seat, background: 3 }, "both play at the table of the one with more points");
  const cheat = fakeSocket("player-matchcc7", "Rat7");
  Object.assign(cheat.data, { userId: "u-cheat", level: 0, xp: 0, background: 8 });
  const room2 = lobby8.newRoom({ kind: "random" });
  lobby8.register(room2);
  room2.addHuman(1, cheat, cheat.data);
  assert.equal(room2.seats[1].background, 4, "a background not unlocked yet falls back to the free one");
  console.log("ok: table and matching");
}

//--------- 17. the rules of a roll and a call ---------
{
  const { updateGame, canRoll, callBlockedBy } = await import("../public/shared/gameEngine.js");
  const { createInitialGameState } = await import("../public/shared/utils.js");
  const fresh = () => {
    const st = createInitialGameState();
    updateGame(st, { type: "ROLL_DICE", values: [2, 2, 2, 5, 6] });
    updateGame(st, { type: "STOP_ROLL" });
    return st;
  };
  let st = fresh();
  updateGame(st, { type: "LOCK_DICE", locked: [true, true, true, true, true] });
  assert.ok(!canRoll(st), "no roll with all five dice locked");
  const before = st.dice.rollsLeft;
  updateGame(st, { type: "ROLL_DICE", values: [1, 1, 1, 1, 1] });
  assert.equal(st.dice.rollsLeft, before, "...the engine ignores it");
  assert.equal(callBlockedBy(st, 3), "all_locked", "no call with all dice locked");

  st = fresh();
  updateGame(st, { type: "LOCK_DICE", locked: [true, true, true, true, false] });
  assert.equal(callBlockedBy(st, 4), "carre_four_locked", "no Carré with 4 dice locked");
  assert.equal(callBlockedBy(st, 3), null, "another call is fine");

  st = fresh();
  updateGame(st, { type: "SELEC_CALL", called: [null, null, null, 0, 1, 0, 0, 0] });
  assert.equal(st.called[4], 1, "Carré called with 3 dice locked... ");
  updateGame(st, { type: "LOCK_DICE", locked: [true, true, true, true, false] });
  assert.ok(!st.called[4], "...and dropped once a fourth die is locked");

  st = fresh();
  updateGame(st, { type: "SELEC_CALL", called: [null, null, null, 1, 0, 0, 0, 0] });
  updateGame(st, { type: "ROLL_DICE", values: [3, 3, 3, 4, 4] });
  updateGame(st, { type: "STOP_ROLL" });
  updateGame(st, { type: "SELEC_CALL", called: [null, null, null, 0, 0, 0, 0, 1] });
  assert.equal(st.called[7], 1, "the call can change between one throw and the next");

  // The server refuses them too.
  const lobby9 = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async () => false, befriend: async () => {} });
  const a = fakeSocket("player-rulesaaa1", "Ram1");
  const b = fakeSocket("player-rulesbbb2", "Yak2");
  assert.ok(lobby9.createPrivate(a).ok);
  assert.ok((await lobby9.joinByCode(b, lobby9.roomOfSocket(a).code)).ok);
  const room = lobby9.roomOfSocket(a);
  const seat = room.state.currentPlayer;
  const act = (x) => room.handleAction(seat, x);
  assert.ok(act({ type: "ROLL_DICE" }).ok && act({ type: "STOP_ROLL" }).ok);
  assert.ok(act({ type: "LOCK_DICE", locked: [true, true, true, true, false] }).ok);
  assert.equal(act({ type: "SELEC_CALL", called: [null, null, null, 0, 1, 0, 0, 0] }).reason, "cannot_call", "server: no Carré with 4 locked");
  assert.ok(act({ type: "SELEC_CALL", called: [null, null, null, 1, 0, 0, 0, 0] }).ok, "server: a Full is fine");
  assert.ok(act({ type: "LOCK_DICE", locked: [true, true, true, true, true] }).ok);
  assert.equal(act({ type: "ROLL_DICE" }).reason, "cannot_roll", "server: no roll with all five locked");
  assert.ok(act({ type: "LOCK_DICE", locked: [true, true, true, false, false] }).ok);
  assert.ok(act({ type: "SELEC_CALL", called: [null, null, null, 1, 0, 0, 0, 0] }).ok);
  assert.ok(act({ type: "ROLL_DICE" }).ok);
  assert.equal(act({ type: "SELEC_CALL", called: [null, null, null, 0, 0, 0, 0, 1] }).reason, "cannot_call", "server: no call while the dice roll");
  assert.ok(act({ type: "STOP_ROLL" }).ok);
  assert.ok(act({ type: "SELEC_CALL", called: [null, null, null, 0, 0, 0, 0, 1] }).ok, "server: a new call before the next roll");
  room.forfeit(seat, "left");
  console.log("ok: roll and call rules");
}

//--------- 18. chat reactions and the bell ---------
{
  const lobby10 = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async () => false, befriend: async () => {} });
  const a = fakeSocket("player-chataaaa1", "Cat1");
  const b = fakeSocket("player-chatbbbb2", "Dog2");
  assert.ok(lobby10.createPrivate(a).ok);
  assert.ok((await lobby10.joinByCode(b, lobby10.roomOfSocket(a).code)).ok);
  const room = lobby10.roomOfSocket(a);
  const seat = a.data.seat;
  assert.equal(room.state.players[seat].level, null, "a guest shows no level (nothing the server can trust)");
  assert.equal(room.state.players[seat].record, null);
  assert.ok(room.emote(seat, "👍").ok, "a reaction from the set goes through");
  assert.ok(!room.emote(seat, "❤️").ok, "one that isn't in the set is refused");
  assert.equal(find(b, "emote").at(-1)?.payload.id, "👍", "and the other player gets it");

  const wait = () => { room.lastEmoteAt[seat] = 0; };
  wait(); assert.ok(room.emote(seat, "🔔").ok, "the bell rings");
  wait(); assert.equal(room.emote(seat, "🔔").error, "nudge_limit", "but not again within 10 seconds");
  for (let n = 2; n <= 5; n++) { room.nudges[seat].at -= 11000; wait(); assert.ok(room.emote(seat, "🔔").ok, `bell ${n} of 5`); }
  room.nudges[seat].at -= 11000; wait();
  assert.equal(room.emote(seat, "🔔").error, "nudge_limit", "5 a game at most");
  assert.ok(find(b, "emote").filter((m) => m.payload.id === "🔔").length === 5, "the other player was rung 5 times");
  room.forfeit(seat, "left");
  console.log("ok: chat reactions");
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
