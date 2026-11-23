//----------- PUSH NOTIFICATIONS (the app's side) ---------------
// In the store apps (Capacitor + Firebase Cloud Messaging) a phone that is locked, or an app that was closed, can
// still be alerted: the game server sends a notification when a friend tries to join the player's waiting room
// (server/push.js; setup in docs/PUSH.md). It is opt-in, per account: the player says yes (on the waiting sheet, or
// with the switch in the options), the system asks its own permission, and only then is the device's token sent to
// the server. Nothing is ever asked or sent from a browser, nor for a guest.
//
// The choice is kept per account on this device ("linotte-push:<account id>"), so an account that signs in on a
// phone where another said yes is not signed up by it. Signing out takes the token back from the server.

import { LANG, t } from "./i18n.js";
import { currentUser } from "./auth.js";

const CHOICE_KEY = "linotte-push:"; // + account id: "1" yes, "0" no (said no in the options or at the system's question)
const TOKEN_KEY = "linotte-push-token";
const CHANNEL = "friends"; // the notification channel (the server names it too, server/push.js)

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* not remembered */ } }

const plugin = () => (window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.PushNotifications || null : null);
const accountId = () => currentUser()?.id || null;

// Is there anything to offer? Only inside the store app (the plugin is there), and only to a signed-in player.
export const pushAvailable = () => Boolean(plugin());
export const pushOffered = () => pushAvailable() && Boolean(accountId());
// Said yes (and not undone), for the account that is signed in.
export const pushEnabled = () => Boolean(accountId()) && read(CHOICE_KEY + accountId()) === "1";
// Never answered yet: the waiting sheet may still ask.
export const pushUndecided = () => pushOffered() && read(CHOICE_KEY + accountId()) === null;

// The device's token, from Firebase. Rejects when it can't be had (no Google services, offline...).
function deviceToken(P) {
    return new Promise((resolve, reject) => {
        const handles = [];
        const done = (fn, value) => { clearTimeout(timer); handles.forEach((h) => h.then?.((x) => x.remove?.())); fn(value); };
        const timer = setTimeout(() => done(reject, new Error("no token")), 15000);
        handles.push(P.addListener("registration", (tok) => done(resolve, tok.value)));
        handles.push(P.addListener("registrationError", (err) => done(reject, new Error(err?.error || "registration"))));
        P.register().catch((err) => done(reject, err));
    });
}

async function allowed(P, { ask }) {
    let perm = await P.checkPermissions();
    if (perm.receive !== "granted" && ask && perm.receive !== "denied") perm = await P.requestPermissions();
    return perm.receive === "granted";
}

// Gives the server this device's token for the signed-in account. `client` is the OnlineClient.
// -> { ok } or { ok: false, reason: "denied" | "offline" | "unavailable" | "error" }
async function sendToken(client, P) {
    let token;
    try { token = await deviceToken(P); } catch { return { ok: false, reason: "unavailable" }; }
    const res = await client.callWhenReady("push_register", { token, lang: LANG, platform: window.Capacitor?.getPlatform?.() === "ios" ? "ios" : "android" }, 12000);
    if (!res?.ok) return { ok: false, reason: res?.error === "offline" || res?.error === "timeout" ? "offline" : "error" };
    write(TOKEN_KEY, token);
    return { ok: true };
}

// The player said yes: the system asks its permission (Android 13+), the token goes to the server.
export async function enablePush(client) {
    const P = plugin();
    if (!P || !accountId()) return { ok: false, reason: "unavailable" };
    const id = accountId();
    try {
        if (!(await allowed(P, { ask: true }))) { write(CHOICE_KEY + id, "0"); return { ok: false, reason: "denied" }; }
        P.createChannel?.({ id: CHANNEL, name: t("Friends"), description: t("A friend wants to play with you"), importance: 4, visibility: 1, vibration: true }).catch?.(() => {});
        const sent = await sendToken(client, P);
        if (sent.ok) write(CHOICE_KEY + id, "1");
        return sent;
    } catch (err) {
        console.error("push:", err);
        return { ok: false, reason: "error" };
    }
}

// The player said no (the switch), or signs out: the server forgets this device, and so does the phone's own token.
export async function disablePush(client, { remember = true } = {}) {
    const id = accountId();
    const token = read(TOKEN_KEY);
    if (id && remember) write(CHOICE_KEY + id, "0");
    if (token) {
        const res = client ? await client.call("push_unregister", { token }) : null;
        if (res?.ok) write(TOKEN_KEY, null);
    }
    // Firebase's own token goes too: even a server that couldn't be reached just now has nothing left to send to.
    try { await plugin()?.unregister?.(); } catch { /* it was not registered */ }
    forgetPushSync();
}

// Each time the app is connected as a signed-in player who said yes: the token is given again (it can have changed, and
// this account takes the phone over from whoever had it). Quietly: no question is asked here. Once per account and run.
let syncedFor = null;
export async function syncPush(client) {
    const P = plugin();
    const id = accountId();
    if (!P || !id || !pushEnabled() || syncedFor === id || !client?.helloOk) return;
    syncedFor = id;
    try {
        if (!(await allowed(P, { ask: false }))) return; // the system's switch was turned off since: nothing to send
        const sent = await sendToken(client, P);
        if (!sent.ok) syncedFor = null; // tried again at the next connection
    } catch { syncedFor = null; }
}
export const forgetPushSync = () => { syncedFor = null; };

// A tap on a notification (the app was closed or in the background): `onTap(data)` with what the server put in it.
export function listenForPushTaps(onTap) {
    const P = plugin();
    if (!P) return;
    P.addListener("pushNotificationActionPerformed", (action) => onTap(action?.notification?.data || {}));
}
