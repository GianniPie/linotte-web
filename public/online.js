//----------- ONLINE CLIENT ---------------
// Everything about talking to the game server, with none of the game's own
// UI: identity (no accounts -- a random id kept on the device), the consent
// record, the socket, and promise-based calls for the lobby. linotte.js turns
// the events this emits into screens and replays the opponent's moves.

import { io } from "./vendor/socket.io.esm.min.js";
import { SERVER_URL, SITE_URL } from "./config.js";
import { accessToken, currentUser } from "./auth.js";

// Must equal CONSENT_VERSION in server/config.js. Bump both whenever the
// Terms / Privacy / bot notice text changes: everyone is asked again.
export const CONSENT_VERSION = 1;

const PLAYER_ID_KEY = "linotte-player-id";
const CONSENT_KEY = "linotte-consent";
const DEV_PRO_KEY = "linotte-dev-pro";

// localStorage can throw or be empty (private windows, blocked storage): the
// game must still run, it just forgets between visits.
const memory = {};
function read(key) {
    try { return localStorage.getItem(key); } catch { return memory[key] ?? null; }
}
function write(key, value) {
    try { localStorage.setItem(key, value); } catch { memory[key] = value; }
}

export function getPlayerId() {
    let id = read(PLAYER_ID_KEY);
    if (!id) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        write(PLAYER_ID_KEY, id);
    }
    return id;
}

// True from the moment a game (or a waiting friend room) exists until it ends:
// on the next launch -- after a crash, a swiped-away app, a reload -- that is
// what makes the client reconnect and rejoin by itself instead of leaving the
// opponent waiting for a player who's actually still there.
const SESSION_KEY = "linotte-online-session";
export function setOnlineSession(active) {
    write(SESSION_KEY, active ? "1" : "");
}
export function wasInOnlineSession() {
    return read(SESSION_KEY) === "1";
}

export function hasConsent() {
    const stored = Number(read(CONSENT_KEY));
    return stored >= CONSENT_VERSION;
}

export function saveConsent() {
    write(CONSENT_KEY, String(CONSENT_VERSION));
}

// ?devpro=1 once on a non-production server makes this device Pro for
// testing. Real Pro comes from the account (the server checks it itself).
// ?devpro=0 turns it off again (to see the free version, ads included).
function devProToken() {
    const param = new URLSearchParams(location.search).get("devpro");
    if (param === "0") write(DEV_PRO_KEY, "");
    else if (param !== null) write(DEV_PRO_KEY, "dev-pro");
    return read(DEV_PRO_KEY) || "";
}
function entitlement() {
    const dev = devProToken();
    return dev ? { devToken: dev } : {};
}

// Is the signed-in player Pro? Asked over plain HTTP (no game connection),
// at start-up and after signing in; `fresh` right after a purchase. The last
// answer is kept so the badge shows at once next time, even offline.
const PRO_KEY = "linotte-pro";
const STAR_KEY = "linotte-star"; // the mark of a bought Pro (a gifted one has Pro's things and no star)
const XP_KEY = "linotte-xp";
const RECORD_KEY = "linotte-record"; // { played, won } online, for the player card
const TODAY_KEY = "linotte-today"; // { day, dailyDone, adsLeft } for the account
export function lastKnownPro() {
    return read(PRO_KEY) === "1";
}
// Pro's star, on the badge: only for a Pro that was bought. Without a saved answer, as Pro.
export function lastKnownStar() {
    const saved = read(STAR_KEY);
    return saved === null || saved === "" ? lastKnownPro() : saved === "1";
}
// What the server said about the account (hello, auth, /api/me): kept for the next launch.
function rememberAccess(me) {
    write(PRO_KEY, me.pro ? "1" : "");
    write(STAR_KEY, me.pro && me.star !== false ? "1" : "0");
}
// The account's experience points (its level is the number on its badge,
// see shared/level.js); null as a guest.
export function lastKnownXp() {
    const v = read(XP_KEY);
    return v === null || v === "" ? null : Number(v) || 0;
}
// The account's online record as the server last said, null as a guest.
export function lastKnownRecord() {
    try { return JSON.parse(read(RECORD_KEY) || "null"); } catch { return null; }
}
export async function fetchPro({ fresh = false } = {}) {
    const token = await accessToken();
    const dev = devProToken();
    if (!token && !dev) {
        // No account: nothing to remember. With one but no token right now (the
        // library is still starting, or offline), keep what is saved.
        if (currentUser()) return lastKnownPro();
        write(PRO_KEY, ""); write(XP_KEY, ""); write(RECORD_KEY, "");
        return false;
    }
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (dev) headers["X-Linotte-Dev"] = dev;
    try {
        const res = await fetch(`${SERVER_URL}/api/me?tz=${tzMinutes()}${fresh ? "&fresh=1" : ""}`, { headers, cache: "no-store" });
        const me = await res.json();
        // The app has an account but the server says "nobody": it couldn't check
        // the token just now. Keep what is saved rather than show a guest.
        if (!me.signedIn && currentUser() && !dev) return lastKnownPro();
        const pro = Boolean(me.pro);
        rememberAccess(me);
        // xp null: the server couldn't read the points just now; keep the last ones.
        if (!me.signedIn) { write(XP_KEY, ""); write(RECORD_KEY, ""); }
        else if (me.xp !== null && me.xp !== undefined) {
            write(XP_KEY, String(Number(me.xp) || 0));
            write(RECORD_KEY, me.record ? JSON.stringify(me.record) : "");
        } else if (read(XP_KEY) === null || read(XP_KEY) === "") write(XP_KEY, "0");
        // adsLeft null: the server couldn't read today's bonuses; keep what the app had.
        if (me.signedIn && typeof me.adsLeft === "number") write(TODAY_KEY, JSON.stringify({ day: localDay(), dailyDone: Boolean(me.dailyDone), adsLeft: me.adsLeft }));
        return pro;
    } catch {
        return lastKnownPro(); // offline / server asleep: keep the last answer
    }
}

// The day for bonuses and ads is the device's own: it changes at its midnight.
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const tzMinutes = () => new Date().getTimezoneOffset(); // minutes behind UTC, sent to the server

// Today's bonuses for the account, as the server last said (a new UTC day
// starts fresh): has the first win of the day been won, how many rewarded
// ads are left. null as a guest.
export function lastKnownToday() {
    if (read(XP_KEY) === null || read(XP_KEY) === "") return null;
    let t = null;
    try { t = JSON.parse(read(TODAY_KEY) || "null"); } catch { /* none */ }
    if (!t || t.day !== localDay()) return { dailyDone: false, adsLeft: 5 };
    return t;
}

// A rewarded ad watched to the end: the server adds the point (a few a day).
export async function claimAdReward() {
    const token = await accessToken();
    if (!token) return { ok: false };
    try {
        const res = await fetch(`${SERVER_URL}/api/ad-reward?tz=${tzMinutes()}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const r = await res.json();
        if (r.xp !== undefined && r.xp !== null) write(XP_KEY, String(Number(r.xp) || 0));
        const t = lastKnownToday() || {};
        if (typeof r.adsLeft === "number") write(TODAY_KEY, JSON.stringify({ day: localDay(), dailyDone: Boolean(t.dailyDone), adsLeft: r.adsLeft }));
        return r;
    } catch {
        return { ok: false };
    }
}

// A leaderboard (see server/bonuses.js): "week" or "all", with this
// account's place.
export async function fetchLeaderboard(range = "week") {
    const token = await accessToken();
    const res = await fetch(`${SERVER_URL}/api/leaderboard?range=${range === "all" ? "all" : "week"}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
    if (!res.ok) throw new Error(`leaderboard: ${res.status}`);
    return res.json();
}

// A problem report from the form: { message, screenshot (a data URL, or ""), client } -> { ok, error? }.
// The server adds who the player is and its own view of their online game (server/feedback.js).
export async function sendFeedback(payload) {
    try {
        const headers = { "Content-Type": "application/json" };
        const token = await accessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${SERVER_URL}/api/feedback`, { method: "POST", headers, body: JSON.stringify(payload) });
        const body = await res.json().catch(() => ({}));
        return res.ok && body.ok ? { ok: true } : { ok: false, error: body.error || (res.status === 429 ? "slow_down" : "failed") };
    } catch {
        return { ok: false, error: "offline" };
    }
}

// Anyone's card (name, country, level, points, star, record) by account id: null if it can't be had.
export async function fetchPlayer(id) {
    try {
        const res = await fetch(`${SERVER_URL}/api/player/${encodeURIComponent(id)}`, { cache: "no-store" });
        return res.ok ? await res.json() : null;
    } catch { return null; }
}

// The account's friends (server/friends.js): people played in private
// rooms, their points this week and, Pro to Pro, whether they're online.
export async function fetchFriends() {
    const token = await accessToken();
    if (!token) return { pro: false, friends: [] };
    const res = await fetch(`${SERVER_URL}/api/friends`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) throw new Error(`friends: ${res.status}`);
    return res.json();
}

export class OnlineClient {
    // handlers: onGameStart(snapshot), onSnapshot(snapshot), onAction(msg),
    // onEmote(msg), onOpponentStatus(msg), onGameOver(msg), onRoomExpired(),
    // onConnection(connected)
    constructor(handlers) {
        this.h = handlers;
        this.socket = null;
        this.ready = null; // Promise resolved once the server has accepted our hello
        this.name = "";
    }

    available() {
        // Native/static builds with no server configured can't play online.
        return SERVER_URL !== "" || location.protocol.startsWith("http");
    }

    connect() {
        if (this.ready) return this.ready;
        this.socket = io(SERVER_URL || undefined, {
            transports: ["websocket", "polling"],
            reconnectionDelayMax: 4000,
        });
        const s = this.socket;

        this.ready = new Promise((resolve) => {
            s.on("connect", async () => {
                s.emit("hello", {
                    playerId: getPlayerId(),
                    consentVersion: hasConsent() ? CONSENT_VERSION : 0,
                    entitlement: entitlement(),
                    piece: this.h.getPiece?.() ?? -1,
                    background: this.h.getBackground?.(),
                    accessToken: await accessToken(),
                    tz: tzMinutes(),
                    claims: true, // this app plays the points video and asks for the points
                }, (res) => {
                    // (A hello the server took for a guest while the app has an account says
                    // "not Pro": not to be believed, the saved answer stays.)
                    if (res?.ok) { this.name = res.name; if (res.signedIn || !currentUser()) { rememberAccess(res); this.h.onPro?.(Boolean(res.pro)); } }
                    this.helloOk = Boolean(res?.ok);
                    this.h.onConnection?.(true, res);
                    resolve(res);
                    // Back after a drop (or a backgrounded app): ask for our room.
                    this.rejoin();
                });
            });
        });

        s.on("disconnect", () => { this.helloOk = false; this.h.onConnection?.(false); });
        s.on("game_start", (snap) => this.h.onGameStart?.(snap));
        s.on("action", (msg) => this.h.onAction?.(msg));
        s.on("emote", (msg) => this.h.onEmote?.(msg));
        s.on("opponent_status", (msg) => this.h.onOpponentStatus?.(msg));
        s.on("idle", (msg) => this.h.onIdle?.(msg));
        s.on("bonus", (msg) => this.h.onBonus?.(msg));
        s.on("recorded", () => this.h.onRecorded?.());
        s.on("friend_invite", (msg) => this.h.onFriendInvite?.(msg));
        s.on("friend_request", (msg) => this.h.onFriendRequest?.(msg));
        s.on("friend_accepted", (msg) => this.h.onFriendAccepted?.(msg));
        s.on("friend_presence", (msg) => this.h.onFriendPresence?.(msg));
        s.on("invite_expired", (msg) => this.h.onInviteExpired?.(msg || {}));
        s.on("invite_declined", (msg) => this.h.onInviteDeclined?.(msg || {}));
        s.on("game_over", (msg) => this.h.onGameOver?.(msg));
        s.on("room_expired", () => this.h.onRoomExpired?.());
        s.on("rematch_offer", () => this.h.onRematchOffer?.());
        s.on("mode_offer", (msg) => this.h.onModeOffer?.(msg || {}));
        s.on("offer_over", () => this.h.onOfferOver?.()); // an offer nobody answered is gone: back to looking // the other way to play (Normal / Ruthless) is offered
        s.on("rematch_declined", (msg) => this.h.onRematchDeclined?.(msg || {}));

        // A phone coming back from the background often has a dead socket the
        // browser hasn't noticed yet.
        // (In the store apps the system closes the socket in the background, and the page may come back
        // still believing it is connected: so a quick question is asked, and an unanswered one reconnects.)
        const wake = () => {
            const sock = this.socket;
            if (!sock) return;
            if (!sock.connected) return sock.connect();
            sock.timeout(3000).emit("look", {}, (err) => { if (err) { sock.disconnect(); sock.connect(); } });
        };
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") wake(); });
        window.addEventListener("online", wake);
        window.addEventListener("pageshow", (e) => { if (e.persisted) wake(); });
        return this.ready;
    }

    // Signed in or out on this page: tell the server who we are now.
    async reauth() {
        if (!this.socket?.connected) return; // the next hello carries it
        const res = await this.call("auth", { accessToken: await accessToken() });
        if (res?.ok) { this.name = res.name; if (res.signedIn || !currentUser()) { rememberAccess(res); this.h.onPro?.(Boolean(res.pro)); } }
    }

    // Another game against the same opponent: { ok, waiting } -- waiting
    // until they say yes (a "game_start" follows), or { ok: false, error }.
    rematch() {
        return this.call("rematch");
    }
    // The other player asked for one and this one says no.
    declineRematch() {
        return this.call("rematch_decline");
    }

    // The video before the winner card: watched (the game's points count, and
    // the day's first game's bonus comes back: { claimed, daily, points }) or closed.
    claimPoints({ adFree = false } = {}) {
        return this.call("claim_points", adFree ? { adFree: true } : {}); // adFree: no video was owed (a first game), so none was watched
    }
    skipPoints() {
        return this.call("skip_points");
    }

    // The favorite piece changed in the options: used from the next game.
    setPiece(piece) {
        if (this.socket?.connected) this.call("piece", { piece });
    }
    // ...and the background (the table the opponent may see).
    setLook(background) {
        if (this.socket?.connected) this.call("look", { background });
    }

    // For something the player asked for (a friend request): waits for the connection and the server's welcome (a socket that
    // dropped while the app sat idle, or a server waking up) instead of answering "offline" at once.
    async callWhenReady(event, payload = {}, waitMs = 25000) {
        if (!this.socket) await this.connect();
        const end = Date.now() + waitMs;
        while (!(this.socket?.connected && this.helloOk) && Date.now() < end) {
            if (this.socket && !this.socket.connected && !this.socket.active) this.socket.connect();
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        if (this.socket?.connected) await this.ensureConsentSent();
        return this.call(event, payload);
    }

    call(event, payload = {}) {
        return new Promise((resolve) => {
            if (!this.socket?.connected) return resolve({ ok: false, error: "offline" });
            this.socket.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { ok: false, error: "timeout" } : res));
        });
    }

    async rejoin() {
        const res = await this.call("rejoin");
        if (res?.ok && res.status === "playing") this.h.onSnapshot?.(res.snapshot);
        else if (res?.ok && res.status === "waiting") this.h.onWaitingRoom?.(res.code);
        else if (res && !res.ok && !res.error) setOnlineSession(false); // nothing to go back to
        return res;
    }

    //--------- lobby ---------
    async ensureConsentSent() {
        await this.ready;
        return this.call("consent", { consentVersion: hasConsent() ? CONSENT_VERSION : 0 });
    }
    // `mode`: "normal" or "ruthless" (shared/level.js). The answer may be { offered: true }: a different way is offered, see answerMode.
    joinQueue(mode) { return this.call("queue_join", { mode }); }
    answerMode(accept) { return this.call("mode_answer", { accept }); }
    leaveQueue() { return this.call("queue_leave"); }
    createRoom(mode) { return this.call("room_create", { mode }); }
    // Pro to Pro: a private room, and the friend's app is asked to join.
    inviteFriend(friendId, mode) { return this.call("friend_invite", { friendId, mode }); }
    declineInvite(fromId, inviteId) { return this.call("invite_declined", { fromId, inviteId }); }
    acceptInvite(inviteId) { return this.call("invite_accepted", { inviteId }); }

    //--------- friends you choose (server/friendships.js) ---------
    // Where this app is, for the friends who might invite: "home", "bot" or "table".
    setPresence(state) { return this.socket?.connected ? this.call("presence_set", { state }) : Promise.resolve({ ok: false }); }
    // { ok, pro, code, friends: [{ id, name, country, games, weekPoints, pro, state }], incoming, outgoing }
    friendsList() { return this.call("friends_list"); }
    friendCodePeek(code) { return this.callWhenReady("friend_code_peek", { code }); }
    friendAddCode(code) { return this.callWhenReady("friend_add_code", { code }); }
    friendRequest(userId) { return this.callWhenReady("friend_request", { userId }); }
    friendRequestOpponent() { return this.call("friend_request_opponent"); }
    friendRespond(userId, accept) { return this.callWhenReady("friend_respond", { userId, accept }); }
    friendRemove(userId) { return this.callWhenReady("friend_remove", { userId }); }
    friendBlock(userId) { return this.call("friend_block", { userId }); }
    // "Report" on the opponent's card: a reason from name, emoji, other.
    reportOpponent(reason) { return this.call("report_player", { reason }); }
    // `confirmed`: said yes to a Ruthless room (the server asks first: error "confirm_ruthless").
    joinRoom(code, confirmed = false) { return this.call("room_join", { code, confirmed }); }
    leaveRoom() { return this.call("room_leave"); }

    //--------- in game ---------
    // Fire-and-forget with a rejection handler: a refused action means this
    // screen drifted from the server, which sends the truth back to redraw.
    sendAction(action) {
        if (!this.socket?.connected) return false;
        this.socket.emit("action", action, (res) => {
            if (res && !res.ok && res.snapshot) this.h.onSnapshot?.(res.snapshot);
        });
        return true;
    }
    // Is there a connection to the server right now?
    isConnected() {
        return Boolean(this.socket?.connected);
    }
    // A connection that looks stuck (no answer to what was sent): drop it and make
    // a new one, which asks for the game again (rejoin) and redraws it from the server's.
    reconnect() {
        if (!this.socket) return;
        this.socket.disconnect();
        this.socket.connect();
    }
    sendEmote(id) {
        return this.call("emote", { id });
    }
}

// Invite links look like /j/K7QF (redirected to /?join=K7QF) or ?join=K7QF.
export function inviteLink(code) {
    return `${shareOrigin()}/j/${code}`;
}
// What a link to share starts with: this site, or the public one when this is the app (see SITE_URL).
export const shareOrigin = () => (window.Capacitor?.isNativePlatform?.() ? SITE_URL : location.origin);

// A friend code as a link (https://host/f/K7QF3A -> /?friend=K7QF3A).
export function pendingFriendCode() {
    const code = new URLSearchParams(location.search).get("friend");
    return code ? code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) : null;
}

export function pendingJoinCode() {
    const code = new URLSearchParams(location.search).get("join");
    return code ? code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) : null;
}
