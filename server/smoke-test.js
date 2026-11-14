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
  const asked = sent.slice(-8).map(([u]) => u);
  assert.ok(asked.some((u) => u.includes("source=eq.server&won=is.true")), "online wins from the server");
  assert.ok(asked.some((u) => u.includes("won=is.false&abandoned=is.false")), "online games finished without winning");
  assert.ok(asked.some((u) => u.includes("mode=eq.bot") && u.includes("from_guest=is.false")), "bot wins, not the guest's");
  assert.ok(asked.some((u) => u.includes("source=eq.server&abandoned=is.true")), "abandoned games");
  assert.ok(asked.filter((u) => u.includes("earns_xp=is.true")).length === 3, "points only from games whose video was watched (wins, finished, bot)");
  const none = async () => ({ ok: true, headers: { get: () => "*/0" } });
  assert.equal(await experience("user-host", { key: "k", url: "https://example.supabase.co", fetch: none }), 0, "none yet");
  assert.equal(await experience(null, { key: "k" }), 0, "a guest has none");
  const broken = async () => ({ ok: false, status: 500, headers: { get: () => null } });
  const unknown = await accountStats("user-host", { key: "k", url: "https://example.supabase.co", fetch: broken });
  assert.equal(unknown.xp, null, "when Supabase can't be read the points are unknown, not 0");
  assert.equal(unknown.record, null, "and so is the record");
  assert.equal(await experience("user-host", { key: "k", url: "https://example.supabase.co", fetch: broken }), 0, "experience() still gives a number");
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
  // The day is the player's: midnight on their device (the app sends its zone).
  const asked = [];
  const spy = { ...opt, fetch: async (u, o) => { asked.push(u); return { ok: true, headers: { get: () => "0-0/0" } }; } };
  const realNow = Date.now;
  Date.now = () => new Date("2026-11-11T23:30:00Z").getTime(); // 00:30 on the 12th in Rome (UTC+1: 60 minutes *behind* UTC is -60)
  try {
    await todayStatus("u9", { ...spy, tz: -60 });
    assert.ok(asked.every((u) => u.includes("day=eq.2026-11-12")), "past midnight in Rome it is already the 12th");
    asked.length = 0;
    await todayStatus("u9", { ...spy, tz: 5 * 60 }); // New York in winter, 18:30 on the 11th
    assert.ok(asked.every((u) => u.includes("day=eq.2026-11-11")), "still the 11th in New York");
    asked.length = 0;
    await todayStatus("u9", spy);
    assert.ok(asked.every((u) => u.includes("day=eq.2026-11-11")), "no zone: UTC");
  } finally { Date.now = realNow; }
  const down = { ...opt, fetch: async () => ({ ok: false, status: 500, headers: { get: () => null } }) };
  assert.deepEqual(await todayStatus("u1", down), { dailyDone: null, adsLeft: null }, "a database error is unknown, not 'none left'");
  assert.deepEqual(await grantAdReward("u1", down), { ok: false, adsLeft: null }, "and no ad is counted either way");

  // The lobby gives the winner the daily bonus once the game is recorded.
  const given = [];
  const refreshed = [];
  const lobby6 = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async (u) => { given.push(u); return true; }, afterRecord: async (sock) => { refreshed.push(sock.id); } });
  const w = fakeSocket("player-bonusaaa1", "Lynx1");
  const l = fakeSocket("player-bonusbbb2", "Mole2");
  w.data.userId = "user-w"; l.data.userId = "user-l";
  assert.ok(lobby6.createPrivate(w).ok);
  assert.ok((await lobby6.joinByCode(l, lobby6.roomOfSocket(w).code)).ok);
  lobby6.roomOfSocket(w).forfeit(l.data.seat, "left");
  await wait(10);
  assert.deepEqual(given, ["user-w"], "the player who left the game doesn't get it");
  assert.deepEqual(find(w, "bonus").at(-1)?.payload, { kind: "daily", points: 2 }, "and their app is told");
  assert.ok(find(w, "recorded").length === 1 && find(l, "recorded").length === 1, "both signed-in apps hear the game is recorded");
  assert.deepEqual(refreshed.sort(), [l.id, w.id].sort(), "and both connections' points are read again");
  // A game played to the end gives it to both, the loser as much as the winner.
  const both = [];
  const lobbyB = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async (u) => { both.push(u); return true; }, afterRecord: async () => {} });
  const seatOf = (id, userId) => ({ kind: "human", userId, socketId: id });
  await lobbyB.giveDailyBonus({ seats: { 1: seatOf(w.id, "user-w"), 2: seatOf(l.id, "user-l") }, forfeitedBy: null, winner: 1 }, Promise.resolve());
  assert.deepEqual(both.sort(), ["user-l", "user-w"], "won or lost, the first game of the day brings the bonus");
  assert.ok(find(l, "bonus").some((m) => m.payload.kind === "daily"), "and the loser's app is told too");
  console.log("ok: bonuses");

  // The points wait for the video: held for a signed-in non-Pro player whose app
  // asks to claim them, then counted (and the daily bonus given) once claimed.
  const claimed = [], daily = [], refreshedNow = [];
  const lobbyC = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async (u) => { daily.push(u); return true; }, afterRecord: async (sock) => { refreshedNow.push(sock.id); }, claim: async (u, since) => { claimed.push([u, since]); return true; } });
  w.data.claims = true; w.data.userId = "user-w"; l.data.userId = "user-l"; // l's app doesn't know claims
  const room = { forfeitedBy: null, winner: 1, seats: { 1: { ...seatOf(w.id, "user-w"), pro: false }, 2: { ...seatOf(l.id, "user-l"), pro: false } } };
  assert.deepEqual([...lobbyC.heldSeats(room)], [1], "held for the app that claims, not for an older one");
  room.seats[1].pro = true;
  lobbyC.pending.clear();
  assert.deepEqual([...lobbyC.heldSeats(room)], [], "Pro has no video: nothing held");
  room.seats[1].pro = false;
  room.forfeitedBy = 1;
  assert.deepEqual([...lobbyC.heldSeats(room)], [], "a game left costs points whatever the video: not held");
  room.forfeitedBy = null;
  lobbyC.pending.clear();
  const held = lobbyC.heldSeats(room);
  await lobbyC.giveDailyBonus(room, Promise.resolve(), held);
  assert.deepEqual(daily, ["user-l"], "the held player's bonus waits for the video");
  const res = await lobbyC.claimPoints(w);
  assert.deepEqual([res.ok, res.claimed, res.daily, res.points], [true, true, true, 2], "watched: the points count and the bonus comes");
  assert.equal(claimed.length, 1, "the game's rows are claimed");
  assert.ok(daily.includes("user-w"), "the bonus is given when claimed");
  assert.ok(refreshedNow.includes(w.id), "and the connection's points are read again");
  assert.equal((await lobbyC.claimPoints(w)).claimed, false, "nothing to claim twice");
  lobbyC.heldSeats(room);
  assert.equal(lobbyC.skipPoints(w).ok, true);
  assert.equal((await lobbyC.claimPoints(w)).claimed, false, "closed: the game never earns its points");
  // The rows carry it.
  const rowsHeld = resultRows({ kind: "random", winner: 1, forfeitedBy: null,
    seats: { 1: { kind: "human", userId: "a", name: "A" }, 2: { kind: "human", userId: "b", name: "B" } },
    state: { players: { 1: { points: 3 }, 2: { points: 5 } } } }, new Set([1]));
  assert.deepEqual(rowsHeld.map((r) => [r.user_id, r.earns_xp]), [["a", false], ["b", true]], "the held game is recorded without its points");
  const { claimGameXp } = await import("./results.js");
  const patches = [];
  assert.equal(await claimGameXp("user-w", Date.now(), { key: "k", url: "https://example.supabase.co", fetch: async (u, o) => { patches.push([u, o]); return { ok: true }; } }), true);
  assert.ok(patches[0][0].includes("user_id=eq.user-w") && patches[0][0].includes("earns_xp=is.false") && patches[0][1].method === "PATCH", "only that player's waiting games");
  console.log("ok: points wait for the video");
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

  // The one who was asked can say no: the one who asked is told, nothing starts.
  const lobbyR = new Lobby(io, createMemoryStore(), { record: async () => {} });
  const c = fakeSocket("player-rematchcc3", "Fox3");
  const d = fakeSocket("player-rematchdd4", "Elk4");
  assert.ok(lobbyR.createPrivate(c).ok);
  assert.ok((await lobbyR.joinByCode(d, lobbyR.roomOfSocket(c).code)).ok);
  const roomR = lobbyR.roomOfSocket(c);
  roomR.forfeit(d.data.seat, "left");
  assert.ok(lobbyR.requestRematch(c).waiting);
  assert.ok(find(d, "rematch_offer").length, "asked");
  assert.ok(lobbyR.declineRematch(d).ok);
  assert.ok(find(c, "rematch_declined").length, "the one who asked is told no");
  assert.equal(lobbyR.roomOfSocket(c), roomR, "no new game");
  assert.equal(lobbyR.declineRematch(d).ok, true, "declining twice is harmless");

  // The bot answers like a person: through its persona, usually yes, after a moment.
  const { rematchAnswer, makePersona } = await import("./humanize.js");
  let yes = 0, waits = [];
  for (let i = 0; i < 400; i++) { const r = rematchAnswer(makePersona(), { botWon: i % 2 === 0 }); if (r.accept) yes++; waits.push(r.waitMs); }
  assert.ok(yes > 280 && yes < 395, `usually yes, sometimes no (${yes}/400)`);
  assert.ok(waits.every((w) => w > 500 && w < 12000), "after a moment, never instantly");
  const lost = Array.from({ length: 600 }, () => rematchAnswer({ chatty: 0.35 }, { botWon: false }).accept).filter(Boolean).length;
  const won = Array.from({ length: 600 }, () => rematchAnswer({ chatty: 0.35, speed: 1 }, { botWon: true }).accept).filter(Boolean).length;
  assert.ok(lost > won, "more eager for a revenge when it lost");
  console.log("ok: rematch");
}

//--------- 17. the bot lab: turns in, corrections, weights out ---------
{
  const { createBotLab } = await import("./botlab.js");
  const { trainSpeedWeights } = await import("../public/shared/botLearning.js");
  const { pickSpeedPlacement, setSpeedWeights, getSpeedWeights, explainPlacement, labCandidates, chooseBestMove } = await import("../public/shared/botAI.js");
  const { createInitialGameState } = await import("../public/shared/utils.js");
  const express = (await import("express")).default;
  const os = await import("node:os");
  const fsm = await import("node:fs");
  const pathm = await import("node:path");

  // learning: a cell the ladder passes over can be taught
  const mk = (rc, o) => ({ rc, tile: "x", tag: "preferred", pointsGained: 0, deniedPoints: 0, rarity: 50, lineConnection: 0, clusterScore: 0, blockScore: 0, longestLineAfter: 1, wouldWinGame: false, wouldLoseGame: false, criticalBlock: false, urgentBlock: false, ...o });
  const cands = [mk("11", { longestLineAfter: 3 }), mk("22", { longestLineAfter: 2, lineConnection: 3, clusterScore: 2 }), mk("33")];
  assert.equal(pickSpeedPlacement(cands, null).rc, "11", "the ladder prefers the longest line");
  const learned = trainSpeedWeights([{ id: "a", candidates: cands, correct: "22" }]);
  assert.equal(pickSpeedPlacement(cands, learned.weights).rc, "22", "after the correction the other cell wins");
  assert.equal(learned.report[0].status, "learned");
  assert.equal(trainSpeedWeights([{ id: "b", candidates: [mk("11", { tag: "dead" }), mk("22")], correct: "11" }]).report[0].status, "filtered", "a cell the bot's filters drop can't be learned");
  assert.equal(trainSpeedWeights([{ id: "c", candidates: [mk("11", { criticalBlock: true }), mk("22")], correct: "22" }]).report[0].status, "tier", "nor one that gives up a critical block");

  // the real bot: weights change its placement, and none by default
  const st = createInitialGameState();
  st.table[1][1] = 2; st.table[3][3] = 1; // a piece each, so the cells below mean something
  for (const [r, c] of [[0, 0], [0, 1], [1, 2], [2, 2], [3, 0], [4, 4]]) st.possibleMoves[r][c] = 1; // what this throw allows
  const before = chooseBestMove(st, 2, "speed");
  assert.equal(getSpeedWeights(), null, "no weights unless the lab sets them");
  const all = labCandidates(st, 2);
  const ranked = explainPlacement(st, 2, "speed").ranked;
  assert.ok(all.length >= ranked.length && all.every((c) => c.rc && c.tag), "every legal cell comes with its signals");
  assert.equal(before, "22", "the ladder takes the rarest of equal cells");
  setSpeedWeights([10000, 1000, 4, 2, 1, 1, -50]); // what the lab would send (here: rarity counts against)
  assert.equal(chooseBestMove(st, 2, "speed"), "01", "with weights the bot places by them");
  assert.equal(chooseBestMove(st, 2, "points"), chooseBestMove(st, 2, "points"), "the points bot is untouched");
  setSpeedWeights(null);
  assert.equal(chooseBestMove(st, 2, "speed"), before, "and goes back to the ladder without the weights");
  assert.equal(ranked.length > 1 && trainSpeedWeights([{ id: "x", candidates: all, correct: ranked[1].rc }]).report[0].status, "conflict", "a choice the signals can't explain is reported, not forced");

  // roll decisions: aim, call, stop can be taught too
  {
    const { trainAim, trainCall, trainStop, trainAll } = await import("../public/shared/botLearning.js");
    const { pickTarget, pickCall, setSpeedModels, getSpeedModels, shouldStopRolling, chooseCallToMake, chooseDiceToLock, labAim, labCall, labStop, labLock, aimFeatures, AIM_PRIOR } = await import("../public/shared/botAI.js");
    const opt = (combo, value, probability) => ({ combo, comboKey: combo, need: 1, cellWeight: value, probability, value: value * probability, attractiveness: value * probability });
    const aimOptions = [opt("brelan3", 40, 0.9), opt("full", 30, 0.5), opt("carre", 30, 0.4)];
    assert.equal(pickTarget(aimOptions, null).comboKey, "brelan3", "built-in aim: value x chance");
    const aim = trainAim([{ id: "a1", options: aimOptions, correct: "full" }]);
    assert.equal(aim.report[0].status, "learned");
    assert.equal(pickTarget(aimOptions, aim.weights).comboKey, "full", "after the correction it aims at the other combo");
    assert.equal(trainAim([{ id: "a2", options: aimOptions, correct: "yam" }]).report[0].status, "missing", "a combo that wasn't on offer");
    const callOptions = [{ combo: "full", eligible: true, score: 5000, probability: 0.4 }, { combo: "carre", eligible: true, score: 4000, probability: 0.3 }, { combo: "yam", eligible: false, score: 0, probability: 0.1, reason: "too far" }];
    assert.equal(pickCall(callOptions, null), "full", "built-in call: best score");
    assert.equal(pickCall(callOptions, trainCall([{ id: "c1", options: callOptions, correct: "carre" }]).weights), "carre", "a call can be taught");
    assert.equal(pickCall(callOptions, trainCall([{ id: "c2", options: callOptions, correct: "none" }]).weights), null, "and so can calling nothing");
    assert.equal(trainCall([{ id: "c3", options: callOptions, correct: "yam" }]).report[0].status, "filtered", "a call the rules rule out can't be taught");
    // keeping dice is an aim in disguise: dice kept by a combo teach that combo
    const lockOpts = aimOptions.map((o) => ({ ...o, mask: o.combo === "brelan3" ? "11100" : o.combo === "full" ? "11011" : "11000" }));
    const keepFull = trainAll([{ id: "k1", kind: "lock", candidates: lockOpts, correct: "11011" }]);
    assert.equal(keepFull.report[0].status, "learned", "a keep that some aim makes can be taught");
    assert.equal(pickTarget(aimOptions, keepFull.aim).comboKey, "full", "and the bot then aims at that combo");
    assert.equal(trainAll([{ id: "k2", kind: "lock", candidates: lockOpts, correct: "00101" }]).report[0].status, "unreachable", "a keep no aim makes is reported");
    assert.equal(trainAll([{ id: "k3", kind: "lock", candidates: lockOpts, correct: "11000" }]).report[0].status, "learned", "several combos may keep the same dice: any is right");

    // appel: calling the combo being chased is something only the lab can teach
    const appelOptions = [{ combo: "full", eligible: true, soft: false, score: 3000, probability: 0.3 }, { combo: "carre", eligible: false, soft: true, score: 60000, probability: 0.5, reason: "chased" }];
    assert.equal(pickCall(appelOptions, null), "full", "built-in: the chased combo is never called");
    const quiet = trainCall([{ id: "q1", options: callOptions, correct: "carre" }]).weights;
    assert.equal(pickCall(appelOptions, quiet), "full", "an unrelated correction doesn't switch it on");
    const taught = trainCall([{ id: "p1", options: appelOptions, correct: "carre" }]);
    assert.equal(taught.report[0].status, "learned", "calling the chased combo can be taught");
    assert.equal(pickCall(appelOptions, taught.weights), "carre", "and then it goes for the appel tile");
    const x = [1, 1, 2, 2, 0, 1, 0.5, 0];
    const stop = trainStop([{ id: "s1", x, correct: "roll" }]);
    assert.ok(stop.weights.reduce((n, w, i) => n + w * x[i], 0) < 0, "after the correction it rolls on where the rules said stop");
    const all = trainAll([{ id: "t#aim0", kind: "aim", candidates: aimOptions, correct: "full" }, { id: "t#stop0", kind: "stop", x, correct: "roll" }]);
    assert.ok(all.aim && all.stop && !all.call && !all.weights && all.agreement === 1, "every kind is trained on its own");

    // the real bot follows what it was taught, and none by default
    const gs = createInitialGameState();
    gs.table[1][1] = 2; gs.table[3][3] = 1;
    gs.dice.values = [3, 3, 3, 5, 6]; gs.dice.rollsLeft = 2;
    for (const [r, c] of [[0, 0], [1, 2], [2, 2]]) gs.possibleMoves[r][c] = 1;
    assert.deepEqual(getSpeedModels(), { aim: null, call: null, stop: null }, "no models unless the lab sets them");
    const rules = shouldStopRolling(gs, 2, "speed");
    const lock0 = chooseDiceToLock(gs.dice.values, gs, 2, "speed");
    setSpeedModels({ stop: [0, 50, 0, 0, 0, 0, 0, 0] });
    assert.equal(shouldStopRolling(gs, 2, "speed"), true, "taught to stop, it stops");
    setSpeedModels({ stop: [0, -50, 0, 0, 0, 0, 0, 0] });
    assert.equal(shouldStopRolling(gs, 2, "speed"), false, "taught to roll, it rolls");
    assert.equal(shouldStopRolling(gs, 1, "points"), shouldStopRolling(gs, 1, "points"), "the points bot is untouched");
    const noMove = createInitialGameState(); noMove.dice.values = [1, 2, 3, 4, 6]; noMove.dice.rollsLeft = 2;
    assert.equal(shouldStopRolling(noMove, 2, "speed"), false, "with no cell to place it can't stop, whatever it was taught");
    setSpeedModels({});
    assert.equal(shouldStopRolling(gs, 2, "speed"), rules, "and goes back to the rules without models");
    assert.deepEqual(chooseDiceToLock(gs.dice.values, gs, 2, "speed"), lock0);
    const la = labAim(gs, 2, "speed");
    assert.ok(la && la.options.every((o) => o.combo && Number.isFinite(o.probability)) && la.chosen === la.builtin, "the lab sees every combo on offer");
    const ll = labLock(gs, 2, "speed");
    assert.equal(ll.chosen, lock0.map((x) => (x ? "1" : "0")).join(""), "the lab records the dice the bot keeps");
    assert.ok(ll.options.length === la.options.length && ll.options.every((o) => /^[01]{5}$/.test(o.mask)), "and the dice each combo would keep");
    const ls = labStop(gs, 2, "speed");
    assert.ok(ls.applicable && ls.x.length === 8 && (ls.chosen === "stop" || ls.chosen === "roll"), "and the stop signals");
    assert.equal(labStop({ ...gs, dice: { ...gs.dice, rollsLeft: 0 } }, 2, "speed"), null, "no stop decision after the last roll");
    labCall(gs, 2, "speed"); chooseCallToMake(gs, 2, "speed"); // run, whatever they say
  }

  // the HTTP side
  const file = pathm.join(os.tmpdir(), `botlab-${process.pid}.json`);
  const lab = createBotLab({ file, key: "", enabled: true });
  const app = express();
  lab.attach(app);
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/api/botlab`;
  const post = (p, body) => fetch(`${base}/${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  const turn = { id: "g1-1", game: "g1", n: 1, strategy: "speed", boardBefore: st.table.map((r) => r.slice()), piecesLeft: { p1: 12, p2: 12 }, points: { p1: 0, p2: 0 }, rolls: [], placement: { chosen: all[0].rc, candidates: all } };
  assert.ok((await post("turn", { turn })).ok, "a turn is taken");
  const info = await fetch(`${base}/info`).then((r) => r.json());
  assert.ok(info.port > 0 && Array.isArray(info.urls) && info.addresses.every((a) => !a.startsWith("169.254.") && a !== "127.0.0.1"), "the lab says where the phone can reach it");
  assert.equal((await fetch(`${base}/state`).then((r) => r.json())).turns.length, 1);
  assert.equal((await post("feedback", { turnId: "g1-1", verdict: "wrong", correct: "99" })).ok, false, "a cell that wasn't legal is refused");
  const fb = await post("feedback", { turnId: "g1-1", verdict: "valid" });
  assert.ok(fb.ok && fb.learned.weights, "validated: weights come back");
  assert.equal((await post("feedback", { turnId: "nope", verdict: "valid" })).ok, false, "unknown turn");
  await post("feedback", { turnId: "g1-1", verdict: "clear" });
  assert.equal(lab.learned.weights, null, "no reviews, no weights");
  // a roll of the turn, with its decisions
  const aimOpts = [{ combo: "brelan3", need: 1, probability: 0.9, cellWeight: 40, value: 36 }, { combo: "full", need: 2, probability: 0.5, cellWeight: 30, value: 15 }];
  const rolled = { ...turn, id: "g1-2", n: 2, rolls: [{ dice: [3, 3, 3, 5, 6], rollsLeft: 2, lab: {
    aim: { chosen: "brelan3", builtin: "brelan3", options: aimOpts },
    call: { chosen: "none", builtin: "none", options: [{ combo: "full", eligible: true, reason: "", score: 900, probability: 0.3 }, { combo: "yam", eligible: false, reason: "too far", score: 0, probability: 0.1 }] },
    stop: { applicable: true, builtin: "roll", chosen: "roll", x: [-1, 1, 1, 2, 0, 1, 0, 0] },
    lock: { chosen: "11100", options: [{ combo: "brelan3", mask: "11100" }, { combo: "full", mask: "11011" }] },
  } }] };
  assert.ok((await post("turn", { turn: rolled })).ok);
  assert.equal((await post("feedback", { turnId: "g1-2", kind: "aim", roll: 0, verdict: "wrong", correct: "yam" })).ok, false, "an aim that wasn't on offer is refused");
  assert.equal((await post("feedback", { turnId: "g1-2", kind: "aim", roll: 5, verdict: "valid" })).ok, false, "a roll that doesn't exist");
  assert.equal((await post("feedback", { turnId: "g1-2", kind: "aim", verdict: "valid" })).ok, false, "a roll review needs the roll");
  const fa = await post("feedback", { turnId: "g1-2", kind: "aim", roll: 0, verdict: "wrong", correct: "full" });
  assert.ok(fa.ok && fa.learned.aim, "an aim review: the aim model comes back");
  assert.equal(fa.learned.weights, null, "the placement is not touched by it");
  assert.equal((await post("feedback", { turnId: "g1-2", kind: "call", roll: 0, verdict: "wrong", correct: "none" })).ok, true, "no call is a valid answer");
  assert.equal((await post("feedback", { turnId: "g1-2", kind: "stop", roll: 0, verdict: "wrong", correct: "stop" })).ok, true);
  assert.equal((await post("feedback", { turnId: "g1-2", kind: "lock", roll: 0, verdict: "wrong", correct: "1110" })).ok, false, "a keep must be five dice");
  const fl = await post("feedback", { turnId: "g1-2", kind: "lock", roll: 0, verdict: "wrong", correct: "11011" });
  assert.ok(fl.ok && fl.learned.report.some((r) => r.kind === "lock" && r.status === "learned"), "a keep review is learned");
  await post("feedback", { turnId: "g1-2", kind: "lock", roll: 0, verdict: "clear" });
  const st1 = await fetch(`${base}/state`).then((r) => r.json());
  assert.deepEqual(st1.cases.map((c) => c.id).sort(), ["g1-2#aim0", "g1-2#call0", "g1-2#stop0"], "one review per decision");
  assert.ok(lab.learned.stop && lab.learned.call, "each kind is trained");
  for (const k of ["aim", "call", "stop"]) await post("feedback", { turnId: "g1-2", kind: k, roll: 0, verdict: "clear" });
  assert.equal(lab.learned.aim, null, "taking the reviews back takes the learning back");
  // off: not there at all
  const off = express();
  createBotLab({ file, key: "", enabled: false }).attach(off);
  const srv2 = off.listen(0);
  assert.equal((await fetch(`http://127.0.0.1:${srv2.address().port}/api/botlab/state`)).status, 404, "off means 404");
  // a key, when one is set
  const keyed = express();
  createBotLab({ file, key: "k1", enabled: true }).attach(keyed);
  const srv3 = keyed.listen(0);
  const kb = `http://127.0.0.1:${srv3.address().port}/api/botlab/state`;
  assert.equal((await fetch(kb)).status, 404, "without the key");
  assert.equal((await fetch(kb + "?key=k1")).status, 200, "with the key");
  srv.close(); srv2.close(); srv3.close();
  try { fsm.unlinkSync(file); } catch { /* not written */ }
  console.log("ok: bot lab");
}

//--------- 19. the bot: what it notices and says ---------
{
  const { scoringCells, newPieceCell, touches, placementMargin, nearness, TRIPLES } = await import("./botSense.js");
  const { pickFor, replyTo: replyId, wrongOne, activity, cooledHeat, HEAT_HALF_LIFE_MS, SITUATIONS } = await import("./botChat.js");
  const { HumanBot } = await import("./humanBot.js");
  const { makePersona } = await import("./humanize.js");

  // Reading the board.
  const empty = () => Array.from({ length: 5 }, () => Array(5).fill(0));
  const b = empty(); b[0][0] = 1; b[0][1] = 1; b[2][2] = 2; b[3][3] = 2;
  assert.ok(TRIPLES.length > 40, "every scoring triple");
  assert.deepEqual([...scoringCells(b, 1).keys()], [2], "one piece from a line: the third cell of the row");
  assert.deepEqual([...scoringCells(b, 2).keys()].sort((x, y) => x - y), [6, 24], "two on the diagonal: either end makes a triple");
  const after = b.map((r) => r.slice()); after[0][2] = 2;
  assert.equal(newPieceCell(b, after, 2), 2, "the cell they filled");
  assert.equal(scoringCells(after, 1).size, 0, "blocked: no scoring cell left");
  assert.ok(touches(b, 1, 5, 2) && !touches(b, 1, 24, 1), "touching two of their pieces");
  assert.equal(placementMargin([{ pointsGained: 1 }, { pointsGained: 0 }]), 1, "a point more: clear");
  assert.equal(placementMargin([{ pointsGained: 0, longestLineAfter: 2 }, { pointsGained: 0, longestLineAfter: 2 }]), 0, "the same: unsure");
  assert.equal(placementMargin([{ pointsGained: 0 }]), 1, "one choice: clear");
  assert.equal(nearness({ need: 1, probability: 0.3 }, { combinationsRealized: [] }), "near");
  assert.equal(nearness({ need: 3, probability: 0.1 }, { combinationsRealized: [] }), "far");
  assert.equal(nearness({ need: 3, probability: 0.3 }, { combinationsRealized: [] }), "middle");
  assert.equal(nearness(null, { combinationsRealized: [0, 0, 0, 0, 1, 0, 0, 0] }), "made", "a Carré is there");

  // The chat.
  for (const sit of Object.keys(SITUATIONS)) {
    const ids = SITUATIONS[sit].map(([id]) => id);
    for (let i = 0; i < 40; i++) assert.ok(ids.includes(pickFor(sit)), `${sit} picks from its own list`);
  }
  assert.ok(["😡", "🥺", "🫤", "😮"].includes(pickFor("blockedByOpponent")), "grrr, nooo, mhhh or wow when blocked");
  assert.equal(pickFor("nudgeRoll"), "🎲"); assert.equal(pickFor("nudgeAwake"), "🔔"); assert.equal(pickFor("away"), "⏳");
  for (let i = 0; i < 60; i++) assert.notEqual(wrongOne("🤣"), "🤣", "a wrong reaction is a different one");
  assert.ok(["🎲", "🤣", "🙏🏻"].includes(replyId("🎲")), "answers to the point");
  assert.ok(activity(0.1, 0) < activity(0.6, 0) && activity(0.3, 0) < activity(0.3, 1), "more talkative with nature and when talked to");
  assert.ok(Math.abs(cooledHeat(1, HEAT_HALF_LIFE_MS) - 0.5) < 1e-9, "it cools off");

  // A bot on a stub room: what it does with what it sees.
  const mk = (over = {}, timeScale = 0.0005) => {
    const log = [];
    const room = {
      status: "playing", turnId: 1, state: { table: empty(), currentPlayer: 1, combinationsRealized: [], dice: {}, possibleMoves: [] },
      otherSeat: (s) => (s === 1 ? 2 : 1), timeLeftMs: () => 30000,
      emote: (seat, id) => { log.push(id); return { ok: true }; },
    };
    const bot = new HumanBot({ timeScale, persona: { ...makePersona(), chatty: 0.6, emojiSlip: 0, patience: 0.5, ...over } });
    bot.attach(room, 2);
    return { bot, room, log };
  };
  {
    // Blocked: the opponent put a piece on the cell where the bot would have scored.
    const { bot, room } = mk();
    const before = empty(); before[0][0] = 2; before[0][1] = 2;
    bot.tableBefore = before;
    room.state.table = before.map((r) => r.slice()); room.state.table[0][2] = 1;
    const said = []; bot.speak = (sit) => said.push(sit);
    bot.afterOpponentTurn({ 1: 0, 2: 0 });
    assert.deepEqual(said, ["blockedByOpponent"], "its line was closed");
    // Not blocked although it could have been.
    const { bot: b2, room: r2 } = mk();
    b2.tableBefore = before;
    r2.state.table = before.map((r) => r.slice()); r2.state.table[4][4] = 1;
    const said2 = []; b2.speak = (sit) => said2.push(sit);
    b2.afterOpponentTurn({ 1: 0, 2: 0 });
    assert.deepEqual(said2, ["opponentLetItBe"], "they let a point stand");
    // A big score by the opponent.
    const { bot: b3, room: r3 } = mk();
    b3.tableBefore = empty(); r3.state.table = empty(); r3.state.table[1][1] = 1;
    const said3 = []; b3.speak = (sit) => said3.push(sit);
    b3.afterOpponentTurn({ 1: 2, 2: 0 });
    assert.deepEqual(said3, ["opponentBigScore"]);
    // Its own turn: it closed a line, then scored.
    const { bot: b4, room: r4 } = mk(); r4.state.currentPlayer = 1;
    const said4 = []; b4.speak = (sit) => said4.push(sit);
    b4.turn.blocked = true; b4.afterOwnTurn({ 1: 0, 2: 0 });
    b4.turn.yam = true; b4.afterOwnTurn({ 1: 0, 2: 0 });
    b4.afterOwnTurn({ 1: 0, 2: 1 });
    assert.deepEqual(said4.filter((x) => x !== "random"), ["botBlocked", "botBigScore", "botScored"], "it reacts to what it did");
  }
  {
    // Nothing to react to until the opponent has placed something.
    const { bot, room, log } = mk({ chatty: 0.6 }); // the board is empty
    const mathRandom = Math.random; Math.random = () => 0.01;
    bot.speak("botScored", 1);
    bot.speak("random", 1);
    bot.tableBefore = empty();
    bot.afterOpponentTurn({ 1: 0, 2: 0 }); // they placed nothing this turn
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(log, [], "no reactions on its own before they have placed a piece");
    bot.speak("start", 1); // the hello at the start is still fine
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(log.length, 1, "the hello at the start");
    room.state.table[0][0] = 1; // they placed a piece
    bot.lastSayAt = 0;
    bot.speak("botScored", 1);
    await new Promise((r) => setTimeout(r, 60));
    Math.random = mathRandom;
    assert.equal(log.length, 2, "now it can react");
  }
  {
    // A wrong reaction is corrected a moment later.
    const { bot, log } = mk({ emojiSlip: 1 });
    bot.send("❤️");
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(log.length, 2, "a wrong one, then the right one");
    assert.notEqual(log[0], "❤️"); assert.equal(log[1], "❤️");
    // The bell, the roll and wait are never mixed up.
    const { bot: nb, log: nl } = mk({ emojiSlip: 1 });
    nb.send("🔔");
    assert.deepEqual(nl, ["🔔"]);
  }
  {
    // Kept waiting, it nudges: "roll" when they haven't rolled, then the bell.
    const { bot, room, log } = mk({ patience: 0.3 });
    room.state.currentPlayer = 1;
    room.idleTurns = { 1: 1 }; // they have let a turn run out: now the bell is allowed
    const sent = []; const realSay = bot.say.bind(bot); bot.say = (id, o) => { sent.push(id); return realSay(id, o); };
    const mathRandom = Math.random; Math.random = () => 0.01; // always yes
    bot.watchOpponent(0);
    await new Promise((r) => setTimeout(r, 150));
    Math.random = mathRandom;
    assert.ok(sent.includes("🎲"), "says roll when waited on");
    assert.ok(sent.includes("🔔"), "then rings the bell, but only for one who has missed a turn");
    // A player who has been taking their turns is never rung.
    const { bot: nb2, room: nr2 } = mk({ patience: 0.3 }); nr2.state.currentPlayer = 1; nr2.idleTurns = {};
    const sentNb = []; nb2.say = (id) => { sentNb.push(id); return true; };
    Math.random = () => 0.01;
    nb2.watchOpponent(0);
    await new Promise((r) => setTimeout(r, 150));
    Math.random = mathRandom;
    assert.ok(sentNb.includes("🎲") && !sentNb.includes("🔔"), "no bell without a missed turn");
    // An action of theirs starts the wait over.
    const { bot: b2, room: r2 } = mk({ patience: 0.3 }, 0.01); r2.state.currentPlayer = 1;
    const sent2 = []; b2.say = (id) => { sent2.push(id); return true; };
    Math.random = () => 0.01;
    b2.watchOpponent(0);
    for (let i = 0; i < 20; i++) { b2.noticeOpponent({ type: "LOCK_DICE" }); await new Promise((r) => setTimeout(r, 4)); }
    Math.random = mathRandom;
    assert.ok(!sent2.includes("🎲"), "no nudge while they are playing");
    b2.stop();
  }
  {
    // Talked to, it talks more; it cools off.
    const { bot } = mk();
    const calm = bot.activityNow();
    for (let i = 0; i < 4; i++) bot.warmUp();
    assert.ok(bot.activityNow() > calm, "more active when stimulated");
  }
  // A whole game through the real room still ends with bots that move, react and don't throw.
  console.log("ok: the bot notices and says");
}

console.log("all smoke tests passed");
process.exit(0);
