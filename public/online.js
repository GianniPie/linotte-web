//----------- ONLINE CLIENT ---------------
// Everything about talking to the game server, with none of the game's own
// UI: identity (no accounts -- a random id kept on the device), the consent
// record, the socket, and promise-based calls for the lobby. linotte.js turns
// the events this emits into screens and replays the opponent's moves.

import { io } from "./vendor/socket.io.esm.min.js";
import { SERVER_URL } from "./config.js";
import { accessToken } from "./auth.js";

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
function devProToken() {
    if (new URLSearchParams(location.search).has("devpro")) write(DEV_PRO_KEY, "dev-pro");
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
const XP_KEY = "linotte-xp";
export function lastKnownPro() {
    return read(PRO_KEY) === "1";
}
// The account's experience points (its level is the number on its badge,
// see shared/level.js); null as a guest.
export function lastKnownXp() {
    const v = read(XP_KEY);
    return v === null || v === "" ? null : Number(v) || 0;
}
export async function fetchPro({ fresh = false } = {}) {
    const token = await accessToken();
    const dev = devProToken();
    if (!token && !dev) { write(PRO_KEY, ""); write(XP_KEY, ""); return false; }
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (dev) headers["X-Linotte-Dev"] = dev;
    try {
        const res = await fetch(`${SERVER_URL}/api/me${fresh ? "?fresh=1" : ""}`, { headers, cache: "no-store" });
        const me = await res.json();
        const pro = Boolean(me.pro);
        write(PRO_KEY, pro ? "1" : "");
        write(XP_KEY, me.signedIn ? String(Number(me.xp) || 0) : "");
        return pro;
    } catch {
        return lastKnownPro(); // offline / server asleep: keep the last answer
    }
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
                    accessToken: await accessToken(),
                }, (res) => {
                    if (res?.ok) { this.name = res.name; this.h.onPro?.(Boolean(res.pro)); }
                    this.h.onConnection?.(true, res);
                    resolve(res);
                    // Back after a drop (or a backgrounded app): ask for our room.
                    this.rejoin();
                });
            });
        });

        s.on("disconnect", () => this.h.onConnection?.(false));
        s.on("game_start", (snap) => this.h.onGameStart?.(snap));
        s.on("action", (msg) => this.h.onAction?.(msg));
        s.on("emote", (msg) => this.h.onEmote?.(msg));
        s.on("opponent_status", (msg) => this.h.onOpponentStatus?.(msg));
        s.on("game_over", (msg) => this.h.onGameOver?.(msg));
        s.on("room_expired", () => this.h.onRoomExpired?.());
        s.on("rematch_offer", () => this.h.onRematchOffer?.());
        s.on("rematch_declined", (msg) => this.h.onRematchDeclined?.(msg || {}));

        // A phone coming back from the background often has a dead socket the
        // browser hasn't noticed yet.
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && this.socket && !this.socket.connected) this.socket.connect();
        });
        return this.ready;
    }

    // Signed in or out on this page: tell the server who we are now.
    async reauth() {
        if (!this.socket?.connected) return; // the next hello carries it
        const res = await this.call("auth", { accessToken: await accessToken() });
        if (res?.ok) { this.name = res.name; this.h.onPro?.(Boolean(res.pro)); }
    }

    // Another game against the same opponent: { ok, waiting } -- waiting
    // until they say yes (a "game_start" follows), or { ok: false, error }.
    rematch() {
        return this.call("rematch");
    }

    // The favorite piece changed in the options: used from the next game.
    setPiece(piece) {
        if (this.socket?.connected) this.call("piece", { piece });
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
    joinQueue() { return this.call("queue_join"); }
    leaveQueue() { return this.call("queue_leave"); }
    createRoom() { return this.call("room_create"); }
    joinRoom(code) { return this.call("room_join", { code }); }
    leaveRoom() { return this.call("room_leave"); }

    //--------- in game ---------
    // Fire-and-forget with a rejection handler: a refused action means this
    // screen drifted from the server, which sends the truth back to redraw.
    sendAction(action) {
        if (!this.socket?.connected) return;
        this.socket.emit("action", action, (res) => {
            if (res && !res.ok && res.snapshot) this.h.onSnapshot?.(res.snapshot);
        });
    }
    sendEmote(id) {
        if (this.socket?.connected) this.socket.emit("emote", { id });
    }
}

// Invite links look like /j/K7QF (redirected to /?join=K7QF) or ?join=K7QF.
export function inviteLink(code) {
    return `${location.origin}/j/${code}`;
}

export function pendingJoinCode() {
    const code = new URLSearchParams(location.search).get("join");
    return code ? code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) : null;
}
