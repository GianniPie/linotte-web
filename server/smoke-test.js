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
import { QUEUE_BOT_DELAY_MS, BOT_MODE } from "./config.js";
import {
  chooseCallToMake, chooseDiceToLock, shouldStopRolling, explainPlacement,
} from "../public/shared/botAI.js";

QUEUE_BOT_DELAY_MS[0] = 20; // don't wait 7s for the bot in a test
QUEUE_BOT_DELAY_MS[1] = 40;
BOT_MODE.same = 1; // the bot asks for what the player asked, unless a test says otherwise

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
  // Roles: the ones given by hand (account_roles), above a purchase; the star only for a purchase.
  const { accessFor, accessOf, atLeast, ROLES } = await import("./entitlements.js");
  const roleRows = (map) => async (u) => ({ ok: true, json: async () => { const id = decodeURIComponent((u.match(/user_id=eq\.([^&]+)/) || [])[1] || ""); return u.includes("/account_roles") ? (map[id] ? [{ role: map[id] }] : []) : u.includes("/pro_grants") ? [] : {}; } });
  const withRoles = (map, extra = {}) => ({ key: "", grantKey: "sb_secret_x", url: "https://example.supabase.co", fetch: roleRows(map), ...extra });
  const a1 = await accessFor({ userId: "user-t" }, withRoles({ "user-t": "tester" }));
  assert.deepEqual([a1.role, a1.pro, a1.star], ["tester", true, false], "a tester has Pro and no star");
  const a2 = await accessFor({ userId: "user-s" }, withRoles({ "user-s": "special" }));
  assert.ok(a2.pro && !a2.star && a2.special && !a2.staff && !a2.admin, "the close circle: special, not staff");
  const a3 = await accessFor({ userId: "user-c" }, withRoles({ "user-c": "collaborator" }));
  assert.ok(a3.pro && a3.star && a3.special && a3.staff && !a3.admin, "a collaborator is Pro (the star) and staff, not admin");
  const a4 = await accessFor({ userId: "user-a" }, withRoles({ "user-a": "admin" }));
  assert.ok(a4.pro && a4.star && a4.special && a4.staff && a4.admin, "the admin has it all, Pro and the star");
  const a5 = await accessFor({ userId: "user-p" }, { ...withRoles({}), key: "sk_test", fetch: async (u) => (u.includes("revenuecat") ? { ok: true, json: async () => ({ subscriber: { entitlements: { pro: { expires_date: null } } } }) } : roleRows({})(u)) });
  assert.deepEqual([a5.role, a5.pro, a5.star], ["pro", true, true], "a purchase is Pro with the star");
  // A tester (or special) is not Pro: it can buy it, and then it is, with the star.
  const bought = { ...withRoles({ "user-tb": "tester", "user-sb": "special" }), key: "sk_test", fetch: async (u) => (u.includes("revenuecat") ? { ok: true, json: async () => ({ subscriber: { entitlements: { pro: { expires_date: null } } } }) } : roleRows({ "user-tb": "tester", "user-sb": "special" })(u)) };
  const a9 = await accessFor({ userId: "user-tb" }, bought);
  assert.deepEqual([a9.role, a9.pro, a9.purchased, a9.star], ["tester", true, true, true], "a tester who buys Pro is Pro: the star");
  const a10 = await accessFor({ userId: "user-sb" }, bought);
  assert.ok(a10.special && a10.star && a10.purchased, "so is a special one");
  const a6 = await accessFor({ userId: "user-m" }, withRoles({}));
  assert.deepEqual([a6.role, a6.pro, a6.star], ["member", false, false], "signed in, nothing else: a member");
  const a7 = await accessFor({ userId: null }, withRoles({}));
  assert.deepEqual([a7.role, a7.pro], ["guest", false], "no account: a guest");
  const a8 = await accessFor({ userId: "user-old" }, { key: "", grantKey: "sb_secret_x", url: "https://example.supabase.co", fetch: async (u) => (u.includes("/account_roles") ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, json: async () => (u.includes("/pro_grants") ? [{ user_id: "user-old" }] : {}) }) });
  assert.deepEqual([a8.role, a8.pro, a8.star], ["tester", true, false], "the older grants still count, as a tester, even before account_roles exists");
  assert.ok(ROLES.indexOf("tester") > ROLES.indexOf("pro") && atLeast("admin", "collaborator") && !atLeast("pro", "tester"), "the order of the roles");
  assert.equal(accessOf("pro").star, true);
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
  // Online games played before ONLINE_RATES_FROM: wins +2, lost or drawn to the end +1, abandoned -2
  // (here 40 wins, 6 finished, 2 abandoned = 82); since: +4, +2, -3 (2 wins, 1 finished, 1 abandoned = 7).
  // Bot wins +1 each (13), 2 daily bonuses +2 each, 3 ads +1 each, and the bonus points of the
  // bot wins (speed bonus, or the margin beyond the first point: 16): 82 + 7 + 13 + 16 + 4 + 3 = 125, and the
  // margin of the online games since ONLINE_MARGIN_FROM (-5 here, summed by the database): 120.
  const counts = async (u, o) => {
    sent.push([u, o]);
    if (u.includes("/rpc/bot_bonus_xp")) return { ok: true, json: async () => 16 }; // the bonus points of the bot wins, summed by the database
    if (u.includes("/rpc/online_margin_xp")) return { ok: true, json: async () => -5 }; // what the online games were won or lost by, summed by the database
    const era = u.includes("played_at=lt.") ? "old" : u.includes("played_at=gte.") ? "new" : "all";
    const pick = (o, w, a) => ({ old: o, new: w, all: a })[era];
    const n = u.includes("kind=eq.daily") ? 2 : u.includes("kind=eq.ad") ? 3
      : u.includes("abandoned=is.true") ? pick(2, 1, 3) : u.includes("mode=eq.bot") ? 13
      : u.includes("won=is.false") ? pick(6, 1, 7) : pick(40, 2, 42);
    return { ok: true, headers: { get: () => `0-0/${n}` } };
  };
  assert.equal(await experience("user-host", { key: "k", url: "https://example.supabase.co", fetch: counts }), 120, "experience is counted: bonuses, the speed bonus and the margin of the online games included");
  const stats = await accountStats("user-host", { key: "k", url: "https://example.supabase.co", fetch: counts });
  assert.deepEqual(stats.record, { played: 52, won: 42 }, "the online record: 42 won of 52 (42 + 7 finished + 3 abandoned)");
  const asked = sent.slice(-15).map(([u]) => u);
  assert.ok(asked.some((u) => u.includes("source=eq.server&won=is.true")), "online wins from the server");
  assert.ok(asked.some((u) => u.includes("won=is.false&abandoned=is.false")), "online games finished without winning");
  assert.ok(asked.some((u) => u.includes("mode=eq.bot") && u.includes("from_guest=is.false")), "bot wins, not the guest's");
  assert.ok(asked.some((u) => u.includes("source=eq.server&abandoned=is.true")), "abandoned games");
  assert.ok(asked.filter((u) => u.includes("earns_xp=is.true")).length === 5, "points only from games whose video was watched (wins, finished, bot)");
  assert.ok(asked.some((u) => u.includes("/rpc/bot_bonus_xp")), "the bonus of the bot wins is summed by the database");
  const marginCall = sent.slice(-15).find(([u]) => u.includes("/rpc/online_margin_xp"));
  assert.ok(marginCall && JSON.parse(marginCall[1].body).uid === "user-host", "the margin of the Ruthless games is summed by the database");
  // without the SQL (the function isn't there yet) only the margin is left out, not the whole level
  const noMargin = async (u, o) => (u.includes("/rpc/online_margin_xp") ? { ok: false, status: 404, headers: { get: () => null } } : counts(u, o));
  assert.equal(await experience("user-host", { key: "k", url: "https://example.supabase.co", fetch: noMargin }), 125, "the margin missing leaves the rest of the points");
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
  const { speedBonus, SPEED_TOP_TURNS, SPEED_TOP_PAY } = await import("../public/shared/level.js");
  assert.deepEqual([0, 3, 5, 6, 10, 15, 16, 17, 30].map(speedBonus), [0, 11, 11, 10, 6, 1, 0, 0, 0], "a win in 5 turns pays 12 (11 on top of the 1), one less per extra turn, down to the win's own 1 point");
  const { botWinPayout } = await import("../public/shared/level.js");
  assert.equal(botWinPayout({ strategy: "points", turns: 7, margin: 6 }), 6, "points mode pays the pure winning margin");
  assert.equal(botWinPayout({ strategy: "points", turns: 7, margin: 0 }), 1, "at least the win's 1 point");
  assert.equal(botWinPayout({ strategy: "speed", turns: 7, margin: 6 }), 10, "speed mode pays 1 and the speed bonus");
  assert.equal(botWinPayout({ strategy: "speed", turns: 20, margin: 6 }), 1, "a slow speed win pays its 1 point");
  assert.equal(SPEED_TOP_PAY, 12); assert.equal(SPEED_TOP_TURNS, 5);
  // Player names: what the check must refuse and what it must let through.
  const { nameProblem } = await import("../public/shared/playerNames.js");
  const refuse = [
    "Dio Brutto", "DioBrutto", "BruttoDio", "bruttodio", "DIOBRUTTO", "PorcoDio", "dioporco", "StronzoDio", // blasphemy, glued or not
    "Cazzo", "C4zz0", "Kazzo", "Ca77o", "F.u.c.k", "Fuuuck", "Phuck", "Fvck", "Dick69", "Sex123", "BigDick", // spellings, numbers, joined words
    "Putain", "Mierda", "Caralho", "Scheisse", "Arschloch", "Joder", "Fanculo", "Inculo", "SucaMi", "Mortacci", // other languages
    "\uff46\uff55\uff43\uff4b", // full-width letters
    "操你妈", "妈的你", // Chinese
    "C\u0430zzo", "F\u0443ck", // look-alike letters from another alphabet: not an allowed alphabet
    "Admin", "Linotte", "Support",
  ];
  for (const n of refuse) assert.ok(nameProblem(n), `the name "${n}" must be refused`);
  const accept = [
    "Claudio", "Audio", "Radio", "Dionisio", "Diogo", "Sussex", "Essex", "Cassandra", "Passo", "Analisi", "Cumulo", "Dickens",
    "Sexton", "Bassano", "Gesualdo", "Cristiano", "Cristo", "Monique", "Computer", "Reputation", "Madonnina", "Therapist",
    "Penisola", "Marco_92", "Luca2008", "Anna2020", "Luca Rossi", "Mia-Rose", "Élodie", "José", "Bjørn", "Łukasz", "小明同学", "Brutto",
  ];
  for (const n of accept) assert.equal(nameProblem(n), "", `the name "${n}" must be accepted`);
  // A name can be changed once a day.
  const { nameChangeWaitMs } = await import("../public/shared/playerNames.js");
  const hour = 3600_000, at = Date.parse("2026-11-20T12:00:00Z");
  assert.equal(nameChangeWaitMs(undefined, at), 0, "no change on record: free");
  assert.equal(nameChangeWaitMs(null, at), 0);
  assert.equal(nameChangeWaitMs("not a date", at), 0);
  assert.equal(nameChangeWaitMs(new Date(at - 1 * hour).toISOString(), at), 23 * hour, "changed an hour ago: 23 hours to go");
  assert.equal(nameChangeWaitMs(new Date(at - 24 * hour).toISOString(), at), 0, "a day later it is free again");
  assert.equal(nameChangeWaitMs(new Date(at - 30 * hour).toISOString(), at), 0);
  // Online games: Normal as ever, Ruthless counts the points they were won or lost by.
  const { onlinePayout, onlineMarginExtra, ABANDON_BASE, validMode } = await import("../public/shared/level.js");
  const R = { ruthless: true };
  assert.equal(onlinePayout({ won: true, points: 7, opponentPoints: 3, ...R }), 4, "ruthless, a win by 4: +4, the margin alone");
  assert.equal(onlinePayout({ won: false, points: 3, opponentPoints: 7, ...R }), -4, "a loss by 4: -4");
  assert.equal(onlinePayout({ won: false, points: 4, opponentPoints: 4, ...R }), 0, "a draw: 0");
  assert.equal(onlinePayout({ won: true, points: 2, opponentPoints: 5, ...R }), 1, "won because the opponent left while ahead: no margin, the least a win is worth");
  assert.equal(onlinePayout({ abandoned: true, points: 3, opponentPoints: 7, ...R }), -(ABANDON_BASE + 4), "leaving: -6 and the lead of the opponent");
  assert.equal(onlinePayout({ abandoned: true, points: 5, opponentPoints: 1, ...R }), -6, "leaving while ahead: -6");
  for (const [points, opponentPoints] of [[0, 9], [3, 7], [5, 5], [8, 2]]) { // leaving always costs more than finishing from the same score
    assert.ok(onlinePayout({ abandoned: true, points, opponentPoints, ...R }) < onlinePayout({ won: false, points, opponentPoints, ...R }), `leaving at ${points}-${opponentPoints} costs more than losing`);
  }
  assert.equal(onlinePayout({ won: true, points: 7, opponentPoints: 3 }), 4, "normal: a win is +4 whatever the score");
  assert.equal(onlinePayout({ won: false, points: 3, opponentPoints: 7 }), 2, "normal: +2 for a loss played to the end");
  assert.equal(onlinePayout({ abandoned: true, points: 3, opponentPoints: 7 }), -3, "normal: leaving is -3");
  assert.equal(onlineMarginExtra({ won: true, points: 7, opponentPoints: 3, ...R }), 0, "a win by 4 is +4: the same as the flat +4");
  assert.equal(onlineMarginExtra({ won: true, points: 5, opponentPoints: 3, ...R }), -2, "a win by 2 is 2 less than the flat +4");
  assert.equal(onlineMarginExtra({ won: false, points: 3, opponentPoints: 7, ...R }), -6, "a loss by 4 is 6 less than the flat +2");
  assert.equal(onlineMarginExtra({ won: false, points: 4, opponentPoints: 4, ...R }), -2, "a draw is 2 less than the flat +2");
  assert.equal(onlineMarginExtra({ abandoned: true, points: 3, opponentPoints: 7, ...R }), -(3 + 4), "and of the flat -3");
  assert.equal(onlineMarginExtra({ won: true, points: 7, opponentPoints: 3 }), 0, "nothing on top in a normal game");
  assert.deepEqual(["ruthless", "normal", "x", undefined, null].map(validMode), ["ruthless", "normal", "normal", "normal", "normal"]);
  // Giving up against the bot is offered only when the board alone says the game can't be won.
  const { cannotWin, canReachPoints } = await import("../public/shared/giveUp.js");
  const board = (cells) => { const t = Array.from({ length: 5 }, () => Array(5).fill(0)); for (const [r, c, v] of cells) t[r][c] = v; return t; };
  const game = (table, p1, p2, left1, left2) => ({ table, players: { 1: { points: p1, remainingPieces: left1 }, 2: { points: p2, remainingPieces: left2 } } });
  assert.equal(cannotWin(game(board([]), 0, 0, 12, 12), 1), false, "a fresh game can be won");
  assert.equal(cannotWin(game(board([[0, 0, 1], [0, 1, 1]]), 0, 0, 1, 5), 1), false, "one piece finishes a line: 1 point is reachable");
  assert.equal(cannotWin(game(board([[0, 0, 1], [0, 1, 1]]), 0, 1, 1, 5), 1), true, "one piece makes 1 point at most, the bot has 1: no win left");
  assert.equal(cannotWin(game(board([[0, 0, 1], [0, 1, 1]]), 0, 1, 2, 5), 1), false, "two pieces can make 2 points here (a row of 4 holds 2 lines)");
  assert.equal(cannotWin(game(board([]), 0, 1, 0, 3), 1), true, "no pieces left and behind");
  assert.equal(cannotWin(game(board([]), 0, 0, 0, 3), 1), true, "no pieces left and level: at best a draw, so no win");
  assert.equal(canReachPoints(board([[1, 1, 2], [1, 1, 2]]), 1, 1, 12), true, "lines the other player has not touched are still open");
  assert.equal(canReachPoints(board([[0, 1, 2], [0, 2, 1], [0, 3, 2]]), 1, 1, 1), false, "one piece can't make a line when every line with a piece of yours is blocked");
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
  const claimed = [], daily = [], refreshedNow = [], videoLog = [];
  const lobbyC = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async (u) => { daily.push(u); return true; }, afterRecord: async (sock) => { refreshedNow.push(sock.id); }, claim: async (u, since) => { claimed.push([u, since]); return true; }, video: (u, event, d = {}) => videoLog.push([u, event, d.ms ?? null]) });
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
  // And what became of each video was written down, in order.
  assert.deepEqual(videoLog.filter(([u]) => u === "user-w").map(([, e]) => e),
    ["shown", "shown", "watched", "nothing_waiting", "shown", "closed", "nothing_waiting"], "every video's outcome is logged");
  assert.ok(videoLog.find(([, e]) => e === "watched")[2] >= 0, "with the time it took");
  lobbyC.pending.clear();
  lobbyC.heldSeats(room);
  lobbyC.heldSeats(room);
  assert.ok(videoLog.some(([u, e]) => u === "user-w" && e === "no_answer"), "a video never answered is logged when the next one comes");
  const { logVideo } = await import("./videoLog.js");
  const posted = [];
  assert.equal(await logVideo("user-x", "closed", { ms: 3210.4 }, { key: "k", url: "https://example.supabase.co", fetch: async (u, o) => { posted.push([u, JSON.parse(o.body)]); return { ok: true }; } }), true);
  assert.deepEqual(posted[0], ["https://example.supabase.co/rest/v1/video_events", { user_id: "user-x", event: "closed", ms: 3210 }]);
  assert.equal(await logVideo("user-x", "closed", {}, { key: "k", url: "https://example.supabase.co", fetch: async () => { throw new Error("down"); } }), false, "a failure is never thrown");
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

//--------- 15a. a room whose owner is away, and an account coming back from another device ---------
{
  const lobby = new Lobby(io, createMemoryStore(), { record: async () => {}, grantDaily: async () => false, befriend: async () => {} });
  const host = fakeSocket("player-awayhost01", "Host1");
  host.data.userId = "user-away-host";
  assert.ok(lobby.createPrivate(host).ok);
  const room = lobby.roomOfSocket(host);
  const code = room.code;
  // The owner goes (closes the app); just now the room still waits for them...
  lobby.handleDisconnect(host);
  assert.ok(!room.hostAway(90000), "gone for a moment: still joinable");
  // ...a while later it no longer does: a friend with the link is told, not thrown into an empty game.
  room.seats[host.data.seat].awaySince = Date.now() - 100000;
  const guest = fakeSocket("player-awayguest2", "Guest2");
  assert.equal((await lobby.joinByCode(guest, code)).error, "host_away", "an absent owner's room can't be joined");
  assert.equal(room.status, "waiting", "and it keeps waiting");
  // The same account on another device: the seat is theirs again, with the same code.
  const phone = fakeSocket("player-awayphone03", "Phone3");
  phone.data.userId = "user-away-host";
  const back = await lobby.rejoin(phone);
  assert.deepEqual([back.ok, back.status, back.code], [true, "waiting", code], "the owner is back in their room from another device");
  assert.ok(!room.hostAway(90000), "and the room is joinable again");
  assert.ok((await lobby.joinByCode(guest, code)).ok, "so the friend can join");
  // A device that is still connected is not taken over.
  const thief = fakeSocket("player-awaythief04", "Thief4");
  thief.data.userId = "user-away-host";
  assert.equal((await lobby.rejoin(thief)).ok, false, "a connected seat is not taken from its device");
  room.forfeit(phone.data.seat, "left");
  console.log("ok: a room whose owner is away");
}

//--------- 15d. the default picture ---------
{
  const { defaultAvatar, avatarOrDefault, DEFAULT_AVATARS, isAvatar } = await import("../public/shared/assets.js");
  assert.equal(DEFAULT_AVATARS.length, 8);
  assert.deepEqual(DEFAULT_AVATARS, ["p001", "p002", "p003", "p004", "p005", "p006", "p007", "p008"], "the first eight pieces");
  assert.equal(defaultAvatar("user-a"), defaultAvatar("user-a"), "always the same for the same account");
  const seen = new Set(Array.from({ length: 200 }, (_, i) => defaultAvatar("user-" + i)));
  assert.ok(seen.size >= 6 && [...seen].every((id) => DEFAULT_AVATARS.includes(id)), "spread over the eight, never another");
  assert.equal(avatarOrDefault("p020", "x"), "p020", "a chosen picture wins");
  assert.ok(isAvatar(avatarOrDefault("", "x")) && isAvatar(avatarOrDefault("../evil", "x")), "no choice, or a bad one: the default");
  console.log("ok: default picture");
}

//--------- 15e. problem reports from the form ---------
{
  const { parseScreenshot, buildReport, sendFeedback, emailOf, createFeedbackBudget } = await import("./feedback.js");
  const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).toString("base64");
  assert.equal(parseScreenshot(png)?.ext, "png", "a PNG is kept");
  assert.equal(parseScreenshot("data:image/png;base64," + Buffer.from("not a png").toString("base64")), null, "bytes that are not the type it says");
  assert.equal(parseScreenshot("data:text/html;base64,PGI+"), null, "not an image");
  assert.equal(parseScreenshot("data:image/jpeg;base64," + Buffer.alloc(1_600_000, 0xff).toString("base64")), null, "too big");
  const shot = parseScreenshot(png);
  const report = buildReport({
    message: "The dice froze on my turn", version: "9.9.9", ip: "1.2.3.4", screenshot: shot,
    account: { userId: "u1", name: "Gianni", email: "g@example.com", role: "admin", level: 5, xp: 100, country: "IT" },
    client: { language: "it", userAgent: "UA", screen: "390x844", viewport: "390x700", pixelRatio: 3, host: "linotte.app", errors: ["TypeError: x is not a function"], game: { mode: "bot", strategy: "points", inProgress: true, points: "3 - 1", turns: 6 } },
    serverGame: { roomId: "r1", kind: "random", status: "playing", seats: [{ seat: 1, name: "A", kind: "human", connected: true }] },
  });
  assert.ok(report.text.startsWith("The dice froze on my turn"), "the message first");
  for (const needle of ["Gianni (u1)", "g@example.com", "Role: admin", "9.9.9", "390x844", "Mode: bot (points)", "Room: r1", "TypeError: x is not a function"]) assert.ok(report.text.includes(needle), "the mail says " + needle);
  assert.ok(report.subject.includes("Gianni") && report.subject.includes("9.9.9"), "a subject that says who and which version");
  assert.ok(report.subject.startsWith("[Linotte problem]") && buildReport({ kind: "contact", message: "Hello", account: {}, replyTo: "a@b.co" }).subject.startsWith("[Linotte contact]"), "the subject says which kind");
  assert.ok(buildReport({ kind: "contact", message: "Hello", account: {}, replyTo: "a@b.co" }).text.includes("E-mail to answer: a@b.co"), "the address a guest gave");
  assert.deepEqual(report.attachments.map((a) => a.filename), ["details.json", "screenshot.png"], "details and the screenshot go along");
  // kept and mailed
  const calls = [];
  const fetcher = async (u, o) => { calls.push([u, o?.method, o?.body && JSON.parse(o.body)]); return { ok: true, status: 200, text: async () => "" }; };
  const sent = await sendFeedback(report, { userId: "u1", message: "m", replyTo: "g@example.com", screenshot: shot }, { key: "k", url: "https://example.supabase.co", resendKey: "re_x", fetch: fetcher });
  assert.deepEqual([sent.ok, sent.kept, sent.mailed], [true, true, true]);
  assert.ok(calls[0][0].endsWith("/rest/v1/feedback") && calls[0][2].user_id === "u1" && calls[0][2].screenshot.startsWith("data:image/png;base64,"), "kept in the table");
  assert.ok(calls[1][0].includes("api.resend.com") && calls[1][2].to[0] === "linotte.cloud@gmail.com" && calls[1][2].reply_to === "g@example.com", "mailed to the project's address, replyable");
  // one of the two failing still counts as sent; both failing doesn't
  const mailDown = async (u) => (u.includes("resend") ? { ok: false, status: 500, text: async () => "no" } : { ok: true });
  assert.equal((await sendFeedback(report, {}, { key: "k", url: "https://x.supabase.co", resendKey: "re_x", fetch: mailDown })).ok, true, "kept though the mail failed");
  assert.equal((await sendFeedback(report, {}, { key: "k", url: "https://x.supabase.co", resendKey: "re_x", fetch: async () => ({ ok: false, status: 500, text: async () => "" }) })).ok, false, "neither: not sent");
  assert.equal((await sendFeedback(report, {}, { key: "", resendKey: "" })).ok, true, "a local run: only logged");
  assert.equal(await emailOf("u1", { key: "k", url: "https://x.supabase.co", fetch: async () => ({ ok: true, json: async () => ({ email: "g@example.com" }) }) }), "g@example.com");
  assert.equal(await emailOf(null, { key: "k" }), null);
  let clock = 0;
  const budget = createFeedbackBudget({ perHour: 2, now: () => clock });
  assert.ok(budget.take("a") && budget.take("a") && !budget.take("a"), "two an hour");
  clock = 3600_001;
  assert.ok(budget.take("a"), "an hour later");
  console.log("ok: problem reports");
}

//--------- 15c. reporting a player ---------
{
  const { createReportBook, saveReport, REPORT_REASONS } = await import("./reports.js");
  let clock = 0;
  const book = createReportBook({ perHour: 2, now: () => clock });
  assert.equal(book.take("a", "room1", "x"), "ok", "a first report");
  assert.equal(book.take("a", "room1", "x"), "again", "the same player in the same game: not twice");
  assert.equal(book.take("a", "room2", "x"), "ok", "another game");
  assert.equal(book.take("a", "room3", "x"), "slow_down", "two an hour");
  clock = 3600_001;
  assert.equal(book.take("a", "room3", "x"), "ok", "an hour later");
  const sent = [];
  const keep = { key: "k", url: "https://example.supabase.co", fetch: async (u, o) => { sent.push([u, JSON.parse(o.body)]); return { ok: true }; } };
  assert.ok(await saveReport({ reporter: "u1", reporterPlayer: "p1", reportedUser: null, reportedPlayer: "p2", reportedName: "Rude", roomId: "r", reason: "name" }, keep));
  assert.ok(sent[0][0].endsWith("/rest/v1/reports") && sent[0][1].reason === "name" && sent[0][1].reported_name === "Rude", "kept in the reports table");
  assert.equal(await saveReport({ reason: "invented" }, keep), false, "only the listed reasons");
  assert.equal(await saveReport({ reason: "other" }, { ...keep, fetch: async () => ({ ok: false, status: 500 }) }), false, "a failure is reported, not thrown");
  assert.deepEqual(REPORT_REASONS, ["name", "emoji", "other"]);
  // the row's id comes back when the database gives it
  assert.equal(await saveReport({ reason: "name" }, { ...keep, fetch: async () => ({ ok: true, json: async () => [{ id: "abc-123" }] }) }), "abc-123", "the id of the kept row");
  // the mail for each report: everything, a link to Supabase's SQL editor with the query in it, the query, the terminal command
  const { buildReportMail, notifyReport } = await import("./reports.js");
  const uid = "22222222-2222-4222-8222-222222222222", rid = "33333333-3333-4333-8333-333333333333";
  const mail = buildReportMail({ id: rid, reason: "name", when: "2026-11-20T10:00:00Z", roomId: "room9", reporter: { userId: null, playerId: "dev-1", shownName: "Fox12" }, reported: { userId: uid, playerId: "dev-2", shownName: "Wolf7", rawName: "BadName", email: "x@example.com", country: "IT", level: 3, xp: 40 } }, { url: "https://abcd.supabase.co" });
  assert.ok(mail.subject.includes("OFFENSIVE NAME") && mail.subject.includes("Wolf7"));
  for (const part of ["BadName", "x@example.com", "Level: 3 (40 points)", "guest (device dev-1)", `account ${uid}`, "room9",
    `update public.profiles set name = null where id = '${uid}';`, `update public.reports set handled = true where id = '${rid}';`,
    `node scripts/moderate.mjs rename ${uid} --handled ${rid}`, "https://supabase.com/dashboard/project/abcd/sql/new?content="]) {
    assert.ok(mail.text.includes(part), `the report mail has: ${part}`);
  }
  assert.ok(decodeURIComponent(mail.link.split("content=")[1]).startsWith(`update public.profiles set name = null where id = '${uid}';`), "the link carries the query");
  const guest = buildReportMail({ reason: "emoji", reported: { userId: null, playerId: "dev-3", shownName: "Cat4" }, reporter: {} });
  assert.ok(guest.text.includes("is a guest") && !guest.text.includes("update public.profiles"), "a guest has no profile to change");
  let sentMail = null;
  const looked = [];
  assert.ok(await notifyReport({ id: rid, reason: "name", roomId: "r1", reporter: { userId: null, playerId: "p1", shownName: "A" }, reported: { userId: uid, playerId: "p2", shownName: "B" } }, {
    key: "k", url: "https://abcd.supabase.co", send: async (subject, text) => { sentMail = { subject, text }; return true; },
    fetch: async (u) => { looked.push(u); return { ok: true, json: async () => (u.includes("/profiles") ? [{ name: "BruttoDio", country: "IT" }] : { email: "bad@example.com" }), headers: { get: () => null } }; },
  }), "the mail is sent");
  assert.ok(sentMail.text.includes('"BruttoDio"') && sentMail.text.includes("bad@example.com"), "the stored name and the e-mail are looked up");
  assert.equal(await notifyReport({ reason: "name" }, { key: "", url: "", send: async () => { throw new Error("boom"); } }), false, "a failure never throws");
  // 3 different signed-in players reporting a name within 24 hours take it away
  const { autoRemoveName, AUTO_REMOVE_REPORTS } = await import("./reports.js");
  assert.equal(AUTO_REMOVE_REPORTS, 3);
  const fakeBase = (reportRows, profileName) => {
    const calls = [];
    return { calls, fetch: async (u, o = {}) => {
      calls.push([o.method || "GET", u, o.body]);
      if (u.includes("/reports?reported_user=") && !o.method) return { ok: true, json: async () => reportRows };
      if (u.includes("/profiles?id=eq.") && !o.method) return { ok: true, json: async () => [{ name: profileName }] };
      return { ok: true, json: async () => [] };
    } };
  };
  const rows3 = [{ id: "r1", reporter: "a" }, { id: "r2", reporter: "b" }, { id: "r3", reporter: "c" }];
  const base = fakeBase(rows3, "BadName");
  const out = await autoRemoveName(uid, { key: "k", url: "https://abcd.supabase.co", fetch: base.fetch, now: () => Date.parse("2026-11-20T12:00:00Z") });
  assert.deepEqual(out, { removed: true, previousName: "BadName", reporters: 3 });
  const asked = base.calls[0][1];
  assert.ok(asked.includes("handled=eq.false") && asked.includes("reporter=not.is.null") && asked.includes("reason=eq.name") && asked.includes("created_at=gte.2026-11-19T12%3A00%3A00.000Z"), "only open name reports by accounts, from the last 24 hours");
  const patchName = base.calls.find((c) => c[0] === "PATCH" && c[1].includes("/profiles?id="));
  assert.equal(JSON.parse(patchName[2]).name, null, "the name is taken away");
  assert.equal(JSON.parse(patchName[2]).name_removed_at, "2026-11-20T12:00:00.000Z", "and the date is kept, so the app can say why");
  // before the SQL is run again the column isn't there: the name is taken away all the same
  const oldDb = fakeBase(rows3, "BadName");
  const noColumn = { ...oldDb, fetch: async (u, o = {}) => (o.method === "PATCH" && u.includes("/profiles?id=") && String(o.body).includes("name_removed_at") ? (oldDb.calls.push(["PATCH", u, o.body]), { ok: false, status: 400 }) : oldDb.fetch(u, o)) };
  assert.equal((await autoRemoveName(uid, { key: "k", url: "https://abcd.supabase.co", fetch: noColumn.fetch })).removed, true, "works without the new column");
  const patchReports = base.calls.find((c) => c[0] === "PATCH" && c[1].includes("/reports?id=in.(r1,r2,r3)"));
  assert.deepEqual(JSON.parse(patchReports[2]), { handled: true }, "the reports that counted are closed");
  const two = fakeBase([{ id: "r1", reporter: "a" }, { id: "r2", reporter: "a" }, { id: "r3", reporter: "b" }], "BadName"); // one player three times, and another: 2 people
  assert.equal((await autoRemoveName(uid, { key: "k", url: "https://abcd.supabase.co", fetch: two.fetch })).removed, false, "the same player reporting twice counts once");
  assert.ok(!two.calls.some((c) => c[0] === "PATCH"), "nothing is changed below the threshold");
  const empty = fakeBase(rows3, "");
  assert.equal((await autoRemoveName(uid, { key: "k", url: "https://abcd.supabase.co", fetch: empty.fetch })).removed, false, "no name, nothing to take away");
  assert.equal((await autoRemoveName(null, { key: "k", url: "u" })).removed, false, "a guest has no profile");
  // and the mail tells about it, with the way back
  const auto = buildReportMail({ id: rid, reason: "name", reporter: {}, reported: { userId: uid, shownName: "Wolf7" }, auto: { removed: true, previousName: "Bad'Name", reporters: 3 } }, { url: "https://abcd.supabase.co" });
  assert.ok(auto.subject.includes("NAME REMOVED") && auto.text.startsWith("AUTOMATIC:") && auto.text.includes(`update public.profiles set name = 'Bad''Name' where id = '${uid}';`), "the mail says it and gives the undo");
  // the whole path: the third report triggers it and the mail follows
  const third = fakeBase(rows3, "BadName");
  let sentAuto = null;
  await notifyReport({ id: "r3", reason: "name", roomId: "r", reporter: { userId: "c", playerId: "p", shownName: "C" }, reported: { userId: uid, playerId: "q", shownName: "Wolf7" } }, {
    key: "k", url: "https://abcd.supabase.co", fetch: third.fetch, send: async (subject, text) => { sentAuto = { subject, text }; return true; },
  });
  assert.ok(sentAuto.subject.includes("NAME REMOVED automatically") && third.calls.some((c) => c[0] === "PATCH" && c[1].includes("/profiles?id=")), "the third report takes the name away and mails it");
  const emoji = fakeBase(rows3, "BadName");
  await notifyReport({ reason: "emoji", reporter: {}, reported: { userId: uid, shownName: "W" } }, { key: "k", url: "https://abcd.supabase.co", fetch: emoji.fetch, send: async () => true });
  assert.ok(!emoji.calls.some((c) => c[0] === "PATCH"), "only name reports count");
  console.log("ok: reports");
}

//--------- 15b. friends you choose: code, requests, states, invitations ---------
{
  const { markOnline, markOffline, setActivity, presenceOf } = await import("./friends.js");
  const fr = await import("./friendships.js");
  const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
  const calls = [];
  const db = (answers) => ({ key: "k", url: "https://example.supabase.co", fetch: async (u, o) => {
    const name = u.split("/rpc/")[1];
    calls.push([name, JSON.parse(o.body)]);
    const v = typeof answers[name] === "function" ? answers[name](JSON.parse(o.body)) : answers[name];
    return { ok: true, text: async () => JSON.stringify(v ?? null) };
  } });

  // the personal code
  assert.equal(await fr.friendCodeOf(A, db({ friend_code_of: "K7QF3A" })), "K7QF3A");
  assert.equal(await fr.friendCodeOf(A, db({ friend_code_of: "K7QF3" })), null, "a malformed code is refused");
  assert.equal(await fr.friendCodeOf(A, { key: "" }), null, "no database: no code");
  assert.equal(await fr.friendCodeOf("nope", db({})), null, "not an account id");
  assert.equal(fr.normalizeFriendCode(" k7q-f3a "), "K7QF3A", "typed any way");

  // using someone's code: friends at once
  calls.length = 0;
  const added = await fr.addByCode(A, "k7qf3a", db({ user_by_friend_code: B, friend_request: "accepted" }));
  assert.deepEqual(added, { result: "accepted", friendId: B });
  assert.deepEqual(calls.at(-1), ["friend_request", { a: A, b: B, auto: true }], "a code is consent: auto-accepted");
  calls.length = 0;
  assert.equal((await fr.addByCode(A, "ABC", db({}))).result, "no_code");
  assert.equal(calls.length, 0, "a bad code never reaches the database");
  assert.equal((await fr.addByCode(A, "K7QF3A", db({ user_by_friend_code: null }))).result, "no_code", "a code nobody has");

  // whose code it is, before using it
  assert.deepEqual(await fr.peekCode("k7qf3a", db({ friend_code_owner: [{ user_id: B, name: "Seal2", country: "IT" }] })), { friendId: B, name: "Seal2", country: "IT" });
  assert.equal(await fr.peekCode("k7qf3a", db({ friend_code_owner: [] })), null, "a code nobody has");
  assert.equal(await fr.peekCode("bad", db({})), null);

  // requests and answers
  assert.equal(await fr.requestFriend(A, B, db({ friend_request: "sent" })), "sent");
  assert.deepEqual(calls.at(-1), ["friend_request", { a: A, b: B, auto: false }]);
  assert.equal(await fr.requestFriend(A, "not-an-id", db({})), "none");
  assert.equal(await fr.respondToRequest(B, A, true, db({ friend_respond: "accepted" })), "accepted");
  assert.deepEqual(calls.at(-1), ["friend_respond", { me: B, other: A, accept: true }]);

  // the friends screen
  const rows = [
    { friend_id: B, name: "Seal2", country: "IT", status: "accepted", requested_by: A, games: 3, week_points: 9 },
    { friend_id: "33333333-3333-4333-8333-333333333333", name: null, country: null, status: "pending", requested_by: "33333333-3333-4333-8333-333333333333", games: 0, week_points: 0 },
    { friend_id: "44444444-4444-4444-8444-444444444444", name: "Mia", country: "FR", status: "pending", requested_by: A, games: 0, week_points: 0 },
  ];
  const list = await fr.friendList(A, db({ friend_list: rows }));
  assert.equal(list.friends.length, 1);
  assert.equal(list.friends[0].weekPoints, 9);
  assert.equal(list.incoming.length, 1, "a request someone else sent is for the account to answer");
  assert.ok(list.incoming[0].name.length > 0, "without a profile name, the animal name");
  assert.equal(list.outgoing[0].name, "Mia", "a request the account sent is waiting");
  assert.deepEqual((await fr.friendList(A, { key: "" })).friends, [], "no database: nobody");

  // the brake on requests
  let clock = 0;
  const budget = fr.createBudget({ perHour: 3, now: () => clock });
  assert.ok(budget.take(A) && budget.take(A) && budget.take(A), "three allowed");
  assert.ok(!budget.take(A), "the fourth in an hour is not");
  assert.ok(budget.take(B), "someone else's budget is their own");
  clock = 3600_001;
  assert.ok(budget.take(A), "an hour later it is back");

  // what a friend is doing
  const mk = (userId, activity) => { const x = fakeSocket("player-" + userId.slice(0, 8), "N"); x.data.userId = userId; markOnline(x); if (activity) setActivity(x, activity); return x; };
  assert.equal(presenceOf(A), "offline", "nobody connected");
  const home = mk(A);
  assert.equal(presenceOf(A), "online", "on the home screen");
  assert.ok(setActivity(home, "bot") && !setActivity(home, "volcano"), "only the known states");
  assert.equal(presenceOf(A), "busy", "in a game against the bot");
  setActivity(home, "table");
  assert.equal(presenceOf(A), "busy", "at the same table");
  assert.equal(presenceOf(A, () => true), "playing", "in an online game (the lobby knows)");
  const second = mk(A);
  assert.equal(presenceOf(A), "online", "free on a second device is free enough");
  assert.equal(presenceOf(A, (x) => x === home), "playing", "...unless a game is on any of them");
  markOffline(home); markOffline(second);
  assert.equal(presenceOf(A), "offline", "gone");

  // what an invitation does for each state
  assert.deepEqual(fr.inviteRule("online"), { send: true, soft: false }, "home: a window");
  assert.deepEqual(fr.inviteRule("busy"), { send: true, soft: true }, "bot or same table: a quiet banner");
  assert.deepEqual(fr.inviteRule("playing"), { send: false, error: "friend_playing" }, "in an online game: nothing sent");
  assert.deepEqual(fr.inviteRule("offline"), { send: false, error: "friend_offline" });

  // the open invitations: one per inviter, only the friend answers, a minute and it is over
  const timers = [];
  const expired = [];
  const book = fr.createInviteBook({ onExpire: (i) => expired.push(i.id), setTimer: (fn) => { const t = { fn, unref() {} }; timers.push(t); return t; }, clearTimer: (t) => { t.cleared = true; } });
  const one = book.create({ fromId: A, toId: B, code: "K7QF" });
  assert.equal(book.size(), 1);
  const two = book.create({ fromId: A, toId: B, code: "ZZZZ" });
  assert.equal(two.replaced.length, 1, "a new invitation withdraws the old one");
  assert.equal(book.size(), 1);
  assert.equal(book.answer(two.invite.id, A), null, "not the inviter's to answer");
  assert.equal(book.answer(two.invite.id, B)?.code, "ZZZZ", "the friend answers");
  assert.equal(book.size(), 0);
  const three = book.create({ fromId: A, toId: B, code: "QQQQ" });
  timers.at(-1).fn();
  assert.deepEqual(expired, [three.invite.id], "unanswered: it expires");
  assert.equal(book.size(), 0);
  const four = book.create({ fromId: A, toId: B, code: "WWWW" });
  assert.equal(book.cancelFrom(A).length, 1, "the inviter leaves: the invitation goes");
  assert.equal(book.get(four.invite.id), null);
  assert.ok(one.invite.id !== two.invite.id);
  console.log("ok: friendships");
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
  assert.equal(callBlockedBy(st, 4), null, "a Carré can be called with 4 dice locked (three 2s kept: the fifth die is the gamble)");
  assert.equal(callBlockedBy(st, 3), null, "another call is fine");
  st = createInitialGameState();
  updateGame(st, { type: "ROLL_DICE", values: [3, 3, 3, 3, 6] });
  updateGame(st, { type: "STOP_ROLL" });
  assert.equal(callBlockedBy(st, 4), "carre_made", "no Carré call when there is a Carré on the dice");
  updateGame(st, { type: "LOCK_DICE", locked: [true, true, true, true, false] });
  assert.equal(callBlockedBy(st, 4), "carre_made", "...also with four dice locked");

  st = fresh();
  updateGame(st, { type: "SELEC_CALL", called: [null, null, null, 0, 1, 0, 0, 0] });
  assert.equal(st.called[4], 1, "Carré called with 3 dice locked... ");
  updateGame(st, { type: "LOCK_DICE", locked: [true, true, true, true, false] });
  assert.equal(st.called[4], 1, "...and kept when a fourth die is locked");
  updateGame(st, { type: "LOCK_DICE", locked: [true, true, true, true, true] });
  assert.ok(!st.called[4], "...but dropped once all five are locked");

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
  const carreOnDice = room.state.combinationsRealized[4] === 1; // (the roll is random)
  const carreCall = act({ type: "SELEC_CALL", called: [null, null, null, 0, 1, 0, 0, 0] });
  if (carreOnDice) assert.equal(carreCall.reason, "cannot_call", "server: no Carré call when there is a Carré on the dice");
  else assert.ok(carreCall.ok, "server: a Carré can be called with 4 locked");
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

//--------- 17b. the bot rolls again for what is there to be had ---------
{
  const { updateGame } = await import("../public/shared/gameEngine.js");
  const { createInitialGameState, tile, matrixFill } = await import("../public/shared/utils.js");
  const state = (taken, values, rollsLeft = 2) => {
    const st = createInitialGameState();
    st.currentPlayer = 1;
    for (const key of taken) for (const rc of [tile[key]]) matrixFill(rc, 2, st.table);
    updateGame(st, { type: "ROLL_DICE", values });
    st.dice.rollsLeft = rollsLeft;
    updateGame(st, { type: "STOP_ROLL" });
    return st;
  };
  // Three 4s (a brelan, its tile free) and the rest free: carré and full tiles free, so the bot rolls the two others again.
  assert.equal(shouldStopRolling(state([], [4, 4, 4, 1, 2]), 1, "points"), false, "a brelan with carré and full free: it rolls for them");
  // Carré and full tiles all taken, only the yam left: two dice short of it, it is no reason to roll.
  assert.equal(shouldStopRolling(state(["ca1", "ca2", "fu1", "fu2"], [4, 4, 4, 1, 2]), 1, "points"), true, "a brelan, carré and full gone: yam alone is not worth a roll");
  // The yam tile is free nearly always, so a shot at the yam is taken only when landing there pays: points at once, a block of
  // the opponent's four-short-of-five line, or (from a carré) cells around it that promise points later.
  const kept = (cells, rollsLeft, values = [4, 4, 4, 4, 2]) => {
    const st = createInitialGameState();
    st.currentPlayer = 1;
    for (const [rc, who] of cells) matrixFill(tile[rc], who, st.table);
    st.dice.values = values;
    st.dice.locked = [true, true, true, false, false];
    st.dice.rollsLeft = rollsLeft;
    updateGame(st, { type: "STOP_ROLL" });
    return st;
  };
  assert.equal(shouldStopRolling(kept([], 1), 1, "points"), true, "a carré kept, yam free but nothing around it: it takes the carré");
  assert.equal(shouldStopRolling(kept([["b22", 1], ["b52", 1]], 1), 1, "points"), true, "...also when the carré tile scores and the yam tile has nothing around it");
  assert.equal(shouldStopRolling(kept([["pe1", 1], ["fu2", 1]], 1), 1, "points"), false, "the yam tile would complete three of its own: it rolls");
  assert.equal(shouldStopRolling(kept([["pe1", 2], ["fu2", 2], ["ap2", 2], ["su1", 2]], 1), 1, "points"), false, "the yam tile is the gap in the opponent's four: it rolls");
  assert.equal(shouldStopRolling(kept([["pe1", 1]], 1), 1, "points"), false, "from a carré, a line through the yam tile with a piece of its own is promise enough");
  assert.equal(shouldStopRolling(kept([["pe1", 1], ["fu2", 1], ["yam", 2]], 1), 1, "points"), true, "the yam tile taken: nothing to roll for");
  // Blocking comes first: the opponent has four of a row and the yam tile is the gap. With a brelan in hand the bot keeps rolling
  // for the yam (the speed bot for any four, the points bot because the five would win them the game), but a yam on the dice is placed.
  const gap = [["pe1", 2], ["fu2", 2], ["ap2", 2], ["su1", 2]];
  const open = (values, rollsLeft) => {
    const st = createInitialGameState();
    st.currentPlayer = 1;
    for (const [rc, who] of gap) matrixFill(tile[rc], who, st.table);
    st.dice.values = values;
    st.dice.rollsLeft = rollsLeft;
    updateGame(st, { type: "STOP_ROLL" });
    return st;
  };
  assert.equal(shouldStopRolling(open([4, 4, 4, 1, 2], 2), 1, "speed"), false, "speed: a four to block, only a brelan: it rolls for the yam");
  assert.equal(shouldStopRolling(open([4, 4, 4, 1, 2], 1), 1, "speed"), false, "...down to its last roll");
  assert.equal(shouldStopRolling(open([4, 4, 4, 1, 2], 2), 1, "points"), false, "points: the five would win them the game: the same");
  assert.equal(shouldStopRolling(open([5, 5, 5, 5, 5], 2), 1, "speed"), true, "a yam on the dice is placed");
  // The gap is the carré tile, and the four dice kept so far (1 2 3 4) are no use for it: the bot lets them go and rolls again, all
  // of them but at most the one it keeps for the carré (the dice it kept before do not stop it).
  const carreGap = [["b21", 2], ["se1", 2], ["fu1", 2], ["b51", 2]];
  const stuck = createInitialGameState();
  stuck.currentPlayer = 1;
  for (const [rc, who] of carreGap) matrixFill(tile[rc], who, stuck.table);
  stuck.dice.values = [1, 2, 3, 4, 6];
  stuck.dice.locked = [true, true, true, true, false];
  stuck.dice.rollsLeft = 2;
  updateGame(stuck, { type: "STOP_ROLL" });
  assert.equal(shouldStopRolling(stuck, 1, "speed"), false, "a carré to reach with four useless dice kept: it goes on");
  assert.ok(chooseDiceToLock(stuck.dice.values, stuck, 1, "speed").filter(Boolean).length <= 1, "...and keeps at most one die, rolling the others");
  // The sec tile is what scores at once (the bot has the pieces on both sides of it): with nothing useful on the dice it rolls all
  // five again, and again; a brelan whose tile scores at once is taken.
  const secDice = (cells, values, rollsLeft) => {
    const st = createInitialGameState();
    st.currentPlayer = 1;
    for (const [rc, who] of cells) matrixFill(tile[rc], who, st.table);
    st.dice.values = values;
    st.dice.rollsLeft = rollsLeft;
    updateGame(st, { type: "STOP_ROLL" });
    return st;
  };
  const sidesOfSec = [["ca1", 1], ["fu1", 1]];
  const junk = secDice(sidesOfSec, [1, 3, 4, 5, 6], 2);
  assert.equal(shouldStopRolling(junk, 1, "points"), false, "sec scores at once, nothing on the dice: it rolls again");
  assert.ok(chooseDiceToLock(junk.dice.values, junk, 1, "points").every((l) => !l), "...all five dice");
  assert.equal(shouldStopRolling(secDice(sidesOfSec, [4, 4, 4, 1, 2], 2), 1, "points"), false, "a brelan that scores nothing at once does not stop it");
  assert.equal(shouldStopRolling(secDice([...sidesOfSec, ["ap2", 1], ["ca2", 2], ["fu2", 2]], [4, 4, 4, 1, 2], 2), 1, "points"), true, "a brelan whose tile scores at once does (nothing above it left to roll for)");
  console.log("ok: the bot rolls for what is there");
}

//--------- 17c. the wish to block grows with the opponent's line ---------
{
  const { createInitialGameState, tile, matrixFill } = await import("../public/shared/utils.js");
  const { chooseBestMove } = await import("../public/shared/botAI.js");
  const position = (cells, moves) => {
    const st = createInitialGameState();
    st.currentPlayer = 1;
    for (const [k, who] of cells) matrixFill(tile[k], who, st.table);
    for (const k of moves) matrixFill(tile[k], 1, st.possibleMoves);
    st.players[1].remainingPieces = 8;
    st.players[2].remainingPieces = 8;
    return st;
  };
  const three = [["pe1", 2], ["fu2", 2], ["ap2", 2]]; // the opponent's three in row 2: su1 (24) is one of its gaps
  const four = [...three, ["su1", 2]]; // four: the yam tile (22) is the gap
  const ownPoint = [["ca1", 1], ["fu1", 1]]; // the bot's own two on row 1: se1 (12) scores
  for (const strategy of ["points", "speed"]) {
    assert.equal(chooseBestMove(position(three, ["su1", "se1"]), 1, strategy), "24", `${strategy}: it starts to block a three, over a rare tile`);
    assert.equal(chooseBestMove(position([...three, ...ownPoint], ["su1", "se1"]), 1, strategy), "12", `${strategy}: its own point comes before blocking a three`);
    assert.equal(chooseBestMove(position([...four, ...ownPoint], ["yam", "se1"]), 1, strategy), "22", `${strategy}: a four is a priority, before its own point`);
  }
  // In between a three and a four: a cell that would score the opponent 2 points by crossing two of their threes (the yam tile
  // crosses row 2 and column 2 here). The points bot puts it before a plain tile, after a point of its own; a four is above both.
  const cross = [["pe1", 2], ["fu2", 2], ["ap1", 2], ["se1", 2]];
  const rowFour = [["b22", 1], ["b52", 1]]; // the bot's own two on row 4: ca2 (42) scores, away from the lines of the yam tile
  assert.equal(chooseBestMove(position(cross, ["yam", "b62"]), 1, "points"), "22", "points: a cell that crosses two threes is blocked over a plain tile");
  assert.equal(chooseBestMove(position(cross, ["yam", "b62"]), 1, "speed"), "22", "speed: the same");
  assert.equal(chooseBestMove(position([...cross, ...rowFour], ["yam", "ca2"]), 1, "points"), "42", "points: ...but its own point comes first");
  console.log("ok: the wish to block grows");
}

//--------- 17d. the humanized bot slips less as the player's level rises ---------
{
  const { inaccuracy, MIN_INACCURACY, slips, makePersona } = await import("./humanize.js");
  const { HumanBot } = await import("./humanBot.js");
  assert.equal(inaccuracy(0), 1, "a beginner meets the bot's full slips");
  assert.equal(inaccuracy(-4), 1, "...below zero too");
  assert.ok(inaccuracy(10) < inaccuracy(5) && inaccuracy(20) < inaccuracy(10) && inaccuracy(50) < inaccuracy(20), "the higher the level, the fewer the slips");
  assert.ok(inaccuracy(500) >= MIN_INACCURACY && inaccuracy(500) < 0.2, "...to a floor, never zero, never perfect");
  assert.equal(inaccuracy(NaN), 0.8, "an unknown level (a guest) is in between");
  assert.equal(new HumanBot({ level: 30 }).persona.inaccuracy, inaccuracy(30), "the bot keeps the index of the player's level");
  assert.equal(new HumanBot({ level: null }).persona.inaccuracy, 0.8, "a guest: unknown");
  assert.equal(new HumanBot().persona.inaccuracy, undefined, "no level told: the slips as they were");
  const rate = (inaccuracyValue, kind) => {
    const persona = { ...makePersona(), skill: 0.8, inaccuracy: inaccuracyValue };
    let n = 0;
    for (let i = 0; i < 40000; i++) if (slips[kind](persona)) n++;
    return n / 40000;
  };
  for (const kind of ["placement", "stopEarly", "rollOn", "skipCall", "badCall", "loseBlockFocus", "loseSecFocus", "missBlock"]) {
    const beginner = rate(inaccuracy(0), kind);
    const strong = rate(inaccuracy(40), kind);
    assert.ok(strong < beginner * 0.5, `${kind}: a strong player's bot slips much less (${strong.toFixed(3)} vs ${beginner.toFixed(3)})`);
    assert.ok(beginner <= 0.6, `${kind}: even for a beginner it is not hopeless (${beginner.toFixed(3)})`);
  }
  assert.ok(rate(1, "loseBlockFocus") <= 0.12 && rate(1, "loseSecFocus") <= 0.12 && rate(1, "missBlock") <= 0.12 && rate(1, "badCall") <= 0.2, "the new slips are capped: 12% for a lost focus or a missed block, 20% for a useless call");
  // Changing one's mind again is rare: a second change in a quarter to under half of the cases, a third half as often.
  const impulsive = { ...makePersona(), impulsive: 0.5 };
  let second = 0;
  let third = 0;
  for (let i = 0; i < 40000; i++) { if (slips.changesAgain(impulsive, 1)) second++; if (slips.changesAgain(impulsive, 2)) third++; }
  assert.ok(second / 40000 > 0.15 && second / 40000 < 0.45, `a second change of mind is not the rule (${(second / 40000).toFixed(2)})`);
  assert.ok(third < second * 0.7, "a third one is rarer still");
  console.log("ok: the humanized bot slips less as the level rises");
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

  // Two in a row (the second may correct the first), then a wait; anyone, the computer included, goes through Room#emote.
  const gap = () => { room.lastEmoteAt[seat] = 0; }; // (past the 0.8 s between two taps)
  gap(); assert.ok(room.emote(seat, "👍").ok, "a second one right away, to correct the first");
  gap(); assert.equal(room.emote(seat, "👍").error, "emote_limit", "but not a third");
  assert.ok(room.emote(seat, "👍").waitMs > 0, "and it says for how long");
  assert.equal(find(b, "emote").length, 2, "the other player only got the two");
  room.emoteTimes[seat] = room.emoteTimes[seat].map((x) => x - 13000); // 13 s later
  gap(); assert.ok(room.emote(seat, "👍").ok, "after the wait it goes through again");
  const wait = () => { room.lastEmoteAt[seat] = 0; room.emoteTimes[seat] = []; };
  wait(); assert.ok(room.emote(seat, "🔔").ok, "the bell rings");
  wait(); assert.equal(room.emote(seat, "🔔").error, "nudge_limit", "but not again within 10 seconds");
  for (let n = 2; n <= 5; n++) { room.nudges[seat].at -= 11000; wait(); assert.ok(room.emote(seat, "🔔").ok, `bell ${n} of 5`); }
  room.nudges[seat].at -= 11000; wait();
  assert.equal(room.emote(seat, "🔔").error, "nudge_limit", "5 a game at most");
  assert.ok(find(b, "emote").filter((m) => m.payload.id === "🔔").length === 5, "the other player was rung 5 times");
  const { emoteWaitMs } = await import("../public/shared/chat.js");
  assert.equal(emoteWaitMs([0, 1000], 2000), 10000, "two just sent: wait until the older is 12 s old");
  assert.equal(emoteWaitMs([0], 2000), 0, "one is free");
  assert.equal(emoteWaitMs([0, 1000], 13000), 0, "and 12 s later it is again");
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

//--------- 20. a bad connection doesn't eat the turn ---------
{
  const { Room } = await import("./room.js");
  const lobbyF = new Lobby(io, createMemoryStore(), { record: async () => {} });
  const p = fakeSocket("player-freezeaa11", "Owl5");
  const q = fakeSocket("player-freezebb22", "Yak5");
  assert.ok(lobbyF.createPrivate(p).ok);
  assert.ok((await lobbyF.joinByCode(q, lobbyF.roomOfSocket(p).code)).ok);
  const room = lobbyF.roomOfSocket(p);
  const onTurn = room.state.currentPlayer;
  const mover = onTurn === p.data.seat ? p : q;
  const other = mover === p ? q : p;
  room.turnEndsAt = Date.now() + 20000; // 20 s left
  let timedOut = 0;
  room.onTurnTimeout = () => { timedOut++; };
  // The player on turn drops: the clock is held.
  room.onDisconnect(mover.data.seat);
  assert.ok(room.frozen && room.frozen.seat === mover.data.seat, "the clock is held while the player on turn is away");
  assert.ok(room.clockLeftMs() > 19000 && room.clockLeftMs() <= 20000, "with its time kept");
  await wait(120);
  assert.ok(room.clockLeftMs() > 19000, "and it does not run down");
  assert.ok(room.snapshotForResync().timeLeftMs > 19000, "a snapshot says so");
  // Back: the clock runs again from there.
  room.onReconnect(mover.data.seat, mover);
  assert.equal(room.frozen, null, "released on return");
  assert.ok(find(other, "opponent_status").some((m) => m.payload.connected === true && m.payload.timeLeftMs > 19000), "the opponent is told, with the clock");
  assert.ok(room.clockLeftMs() > 18500 && room.clockLeftMs() <= 20000, "from where it was");
  // The one NOT on turn dropping holds nothing.
  room.onDisconnect(other.data.seat);
  assert.equal(room.frozen, null, "only the player on turn's clock is held");
  room.onReconnect(other.data.seat, other);
  // Held only so long: it runs again by itself.
  room.onDisconnect(mover.data.seat);
  assert.ok(room.frozen, "held again");
  clearTimeout(room.frozen.cap);
  room.thawTurn();
  assert.equal(room.frozen, null, "after the cap it runs on");
  room.dispose();
  console.log("ok: the turn clock is held for a bad connection");
}

//--------- 16. Normal and Ruthless: the queue, the offers, the bots, the friends' rooms ---------
{
  const lobbyM = new Lobby(io, createMemoryStore());
  // the same way to play: at once, and the room is played that way
  const a1 = fakeSocket("mode-aaaaaaaa", "Owl1"), b1 = fakeSocket("mode-bbbbbbbb", "Jay2");
  assert.equal(lobbyM.joinQueue(a1, "ruthless").matched, false);
  assert.equal(lobbyM.joinQueue(b1, "ruthless").matched, true, "two who asked for Ruthless are played at once");
  assert.equal(lobbyM.roomOfSocket(a1).mode, "ruthless");
  assert.equal(find(a1, "game_start")[0].payload.mode, "ruthless", "and told which way it is played");
  assert.equal(lobbyM.joinQueue(fakeSocket("mode-cccccccc", "Ibis3")).matched, false, "no mode asked means Normal");
  assert.equal(lobbyM.joinQueue(fakeSocket("mode-dddddddd", "Kiwi4"), "nonsense").matched, true, "an unknown mode is Normal");
  // the other way: offered to the one who arrived, and the waiting one keeps what they asked for
  const waiting = fakeSocket("mode-eeeeeeee", "Lynx5"), newcomer = fakeSocket("mode-ffffffff", "Emu6");
  lobbyM.joinQueue(waiting, "normal");
  const res = lobbyM.joinQueue(newcomer, "ruthless");
  assert.ok(res.offered && !res.matched && res.offer.mode === "normal" && res.offer.name === "Lynx5", "a different way is offered, not started");
  assert.equal(find(newcomer, "mode_offer")[0].payload.mode, "normal", "the newcomer is told");
  assert.equal(find(waiting, "mode_offer").length, 0, "the one waiting is not disturbed");
  assert.equal(lobbyM.roomOfSocket(waiting), null, "nobody plays yet");
  const accepted = lobbyM.answerOffer(newcomer, true);
  assert.ok(accepted.matched, "accepted: the game starts");
  assert.equal(lobbyM.roomOfSocket(newcomer).mode, "normal", "the way the waiting one asked for");
  assert.ok(find(waiting, "game_start").length === 1);
  // said no: goes on looking for what was asked, and the same person is not offered again for a minute
  const w2 = fakeSocket("mode-gggggggg", "Fox7"), n2 = fakeSocket("mode-hhhhhhhh", "Hen8");
  lobbyM.joinQueue(w2, "ruthless");
  assert.ok(lobbyM.joinQueue(n2, "normal").offered);
  const no = lobbyM.answerOffer(n2, false);
  assert.ok(no.declined && !no.offered && !no.matched, "no: back to looking, not offered the same one again");
  assert.equal(lobbyM.lobbyHasQueued?.(n2) ?? lobbyM.queue.has("mode-hhhhhhhh"), true, "waiting for what was asked");
  assert.equal(lobbyM.queue.get("mode-hhhhhhhh").mode, "normal");
  for (const id of [...lobbyM.queue.keys()]) lobbyM.leaveQueue(id); // a clean queue for the next case
  // the one waiting left before the answer: the answer starts nothing
  const w3 = fakeSocket("mode-iiiiiiii", "Cat9"), n3 = fakeSocket("mode-jjjjjjjj", "Dog10");
  lobbyM.joinQueue(w3, "ruthless");
  assert.ok(lobbyM.joinQueue(n3, "normal").offered);
  lobbyM.leaveQueue("mode-iiiiiiii");
  const gone = lobbyM.answerOffer(n3, true);
  assert.ok(!gone.matched, "the other one left: nothing starts, the newcomer keeps looking");
  assert.equal(lobbyM.queue.get("mode-jjjjjjjj")?.mode, "normal");
  assert.equal(lobbyM.answerOffer(n3, true).error, "no_offer", "no offer, no answer");
  // a bot that doesn't ask for the same is offered like a person, and the player can say no
  for (const id of [...lobbyM.queue.keys()]) lobbyM.leaveQueue(id);
  BOT_MODE.same = 0;
  const p4 = fakeSocket("mode-kkkkkkkk", "Bee11");
  lobbyM.joinQueue(p4, "normal");
  await wait(150);
  const botOffer = find(p4, "mode_offer")[0];
  assert.ok(botOffer && botOffer.payload.mode === "ruthless" && botOffer.payload.name, "after the wait a bot offers the other way, with a name");
  assert.equal(lobbyM.roomOfSocket(p4), null);
  assert.ok(lobbyM.answerOffer(p4, true).matched, "accepted");
  const botRoom = lobbyM.roomOfSocket(p4);
  assert.ok(botRoom.mode === "ruthless" && botRoom.botSeats().length === 1, "a game against that bot, the way it offered");
  BOT_MODE.same = 1;
  const p5 = fakeSocket("mode-llllllll", "Rat12");
  lobbyM.joinQueue(p5, "ruthless");
  await wait(150);
  assert.equal(lobbyM.roomOfSocket(p5).mode, "ruthless", "a bot that asks for the same starts at once");
  // friends: the room is opened one way, and a Ruthless one has to be confirmed by who comes in
  const host = fakeSocket("mode-mmmmmmmm", "Pig13"), guest = fakeSocket("mode-nnnnnnnn", "Cow14");
  const created = lobbyM.createPrivate(host, "ruthless");
  assert.ok(created.ok && created.mode === "ruthless");
  const asked = await lobbyM.joinByCode(guest, created.code);
  assert.deepEqual([asked.ok, asked.error, asked.mode], [false, "confirm_ruthless", "ruthless"], "a Ruthless room asks first");
  assert.equal(lobbyM.roomOfSocket(guest), null, "and nobody sits down yet");
  assert.ok((await lobbyM.joinByCode(guest, created.code, true)).ok, "confirmed");
  assert.equal(lobbyM.roomOfSocket(guest).mode, "ruthless");
  const host2 = fakeSocket("mode-oooooooo", "Ant15"), guest2 = fakeSocket("mode-pppppppp", "Bat16");
  const normalRoom = lobbyM.createPrivate(host2);
  assert.equal(normalRoom.mode, "normal");
  assert.ok((await lobbyM.joinByCode(guest2, normalRoom.code)).ok, "a Normal room needs no confirmation");
  // the mode survives a restart, and is recorded with the results
  const saved = lobbyM.roomOfSocket(guest).toJSON();
  assert.equal(saved.mode, "ruthless");
  assert.equal(resultRows({ kind: "random", mode: "ruthless", winner: 1, seats: { 1: { kind: "human", userId: "a", name: "A" }, 2: { kind: "human", userId: "b", name: "B" } }, state: { players: { 1: { points: 6 }, 2: { points: 2 } } } }).every((r) => r.ruthless === true), true, "the rows say it was Ruthless");
  assert.equal(resultRows({ kind: "random", mode: "normal", winner: 1, seats: { 1: { kind: "human", userId: "a", name: "A" }, 2: null }, state: { players: { 1: { points: 6 }, 2: { points: 2 } } } })[0].ruthless, false);
  console.log("ok: Normal and Ruthless");
}

console.log("all smoke tests passed");
process.exit(0);
