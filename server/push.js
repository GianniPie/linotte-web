//----------- PUSH NOTIFICATIONS ---------------
// A phone that is locked, or an app that was closed, has no connection to the game: nothing can reach it but a
// push notification (Firebase Cloud Messaging, FCM; iOS later through the same service). Today it is sent for one
// thing: a friend who tries to join a private room whose owner isn't there (Lobby#joinByCode), which includes a
// friend who accepts an invitation (that ends in the same join). Setup: docs/PUSH.md.
//
// Three pieces:
//   - the device tokens of each account (supabase/push_tokens.sql; in memory where there is no database). The app
//     sends its token after the player said yes (opt-in) and takes it back when they say no or sign out;
//   - the sender: FCM's HTTP v1 API, authorized with a Firebase service account (FCM_SERVICE_ACCOUNT). Without it
//     nothing is ever sent, and nothing breaks;
//   - what is said: a friend's name and a line, in the language of the device. Never anything else about anybody.
// Nothing here throws: a push that fails must never hurt a game.

import { SignJWT, importPKCS8 } from "jose";
import { SUPABASE_URL } from "../public/shared/accounts.js";
import es from "../public/lang/es.js";
import fr from "../public/lang/fr.js";
import it from "../public/lang/it.js";
import pt from "../public/lang/pt.js";
import zh from "../public/lang/zh.js";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const DICTIONARIES = { es, fr, it, pt, zh };

export const PUSH_PLATFORMS = ["android", "ios"];
export const MAX_TOKENS_PER_ACCOUNT = 5; // phones and tablets of one account: the newest stay
const TOKEN_FORMAT = /^[A-Za-z0-9_:.\-]{20,4096}$/;
export const isPushToken = (v) => typeof v === "string" && TOKEN_FORMAT.test(v);
export const pushLanguage = (v) => (typeof v === "string" && (v === "en" || v in DICTIONARIES) ? v : "en");

//--------- what is said ---------
// The English sentence is the key, as everywhere (public/i18n.js); the language files of the app have the translations.
export function pushText(lang, kind, { name = "" } = {}) {
  const say = (english) => {
    const text = DICTIONARIES[lang]?.[english] ?? english;
    return text.replace(/\{(\w+)\}/g, (all, key) => (key === "name" ? name : all));
  };
  if (kind === "join") return { title: "Linotte", body: say("{name} wants to play with you. Open Linotte to start the game.") };
  return null;
}

//--------- device tokens ---------
// { save(userId, token, { platform, lang }), remove(userId, token), removeToken(token), list(userId) -> [{ token, platform, lang }] }.
// One token belongs to one account: saving it for another one (someone else signed in on the phone) takes it over.
export function createMemoryTokenStore() {
  const rows = new Map(); // token -> { userId, platform, lang, at }
  return {
    label: "memory",
    async save(userId, token, { platform = "android", lang = "en" } = {}) {
      rows.set(token, { userId, platform, lang, at: Date.now() });
      const mine = [...rows].filter(([, r]) => r.userId === userId).sort((a, b) => b[1].at - a[1].at);
      for (const [old] of mine.slice(MAX_TOKENS_PER_ACCOUNT)) rows.delete(old);
      return true;
    },
    async remove(userId, token) { if (rows.get(token)?.userId === userId) rows.delete(token); return true; },
    async removeToken(token) { rows.delete(token); return true; },
    async list(userId) {
      return [...rows].filter(([, r]) => r.userId === userId).sort((a, b) => b[1].at - a[1].at).map(([token, r]) => ({ token, platform: r.platform, lang: r.lang }));
    },
  };
}

// The same in Supabase's push_tokens table, read and written with the project's secret key.
export function createSupabaseTokenStore({ key = SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  const headers = { apikey: key, "Content-Type": "application/json" };
  const table = `${url}/rest/v1/push_tokens`;
  const q = encodeURIComponent;
  let lastWarning = 0;
  const warn = (what) => {
    if (Date.now() - lastWarning > 10 * 60 * 1000) { lastWarning = Date.now(); console.error(`push tokens: ${what} (is supabase/push_tokens.sql run?)`); }
  };
  const call = async (path, options = {}) => {
    try {
      const res = await fetchImpl(`${table}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
      if (!res.ok) warn(`Supabase answered ${res.status}`);
      return res;
    } catch (err) {
      warn(err.message);
      return null;
    }
  };
  return {
    label: "supabase",
    async save(userId, token, { platform = "android", lang = "en" } = {}) {
      const res = await call("?on_conflict=token", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: userId, token, platform, lang, updated_at: new Date().toISOString() }),
      });
      if (!res?.ok) return false;
      // Only the newest few of an account stay.
      const mine = await this.list(userId);
      for (const old of mine.slice(MAX_TOKENS_PER_ACCOUNT)) await this.remove(userId, old.token);
      return true;
    },
    async remove(userId, token) {
      const res = await call(`?user_id=eq.${q(userId)}&token=eq.${q(token)}`, { method: "DELETE" });
      return Boolean(res?.ok);
    },
    async removeToken(token) {
      const res = await call(`?token=eq.${q(token)}`, { method: "DELETE" });
      return Boolean(res?.ok);
    },
    async list(userId) {
      const res = await call(`?user_id=eq.${q(userId)}&select=token,platform,lang&order=updated_at.desc`);
      if (!res?.ok) return [];
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) ? rows.filter((r) => isPushToken(r.token)).map((r) => ({ token: r.token, platform: r.platform, lang: pushLanguage(r.lang) })) : [];
    },
  };
}

export const createTokenStore = ({ key = SECRET_KEY, url = SUPABASE_URL, ...rest } = {}) =>
  (key && url ? createSupabaseTokenStore({ key, url, ...rest }) : createMemoryTokenStore());

//--------- FCM ---------
// FCM_SERVICE_ACCOUNT: the JSON key of a Firebase service account (Project settings > Service accounts > Generate
// new private key), pasted as it is or as base64 (easier in a dashboard's one-line field).
export function parseServiceAccount(raw) {
  if (!raw || typeof raw !== "string") return null;
  const text = raw.trim();
  for (const candidate of [text, () => Buffer.from(text, "base64").toString("utf8")]) {
    try {
      const json = JSON.parse(typeof candidate === "function" ? candidate() : candidate);
      if (json.project_id && json.client_email && json.private_key) {
        return { projectId: String(json.project_id), clientEmail: String(json.client_email), privateKey: String(json.private_key).replace(/\\n/g, "\n") };
      }
    } catch { /* the next way */ }
  }
  return null;
}

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_TIMEOUT_MS = 5000;

// -> { enabled, send(token, { title, body, data, channel, tag, ttlSeconds }) -> "ok" | "gone" | "failed" }.
// "gone": FCM says this token is dead (app uninstalled, token renewed): it should be forgotten.
export function createFcm({ account = parseServiceAccount(process.env.FCM_SERVICE_ACCOUNT), fetch: fetchImpl = fetch, now = Date.now } = {}) {
  if (!account) return { enabled: false, send: async () => "failed" };
  let access = null; // { token, until }
  let signingKey = null;

  async function accessToken() {
    if (access && access.until - now() > 60_000) return access.token;
    signingKey ??= await importPKCS8(account.privateKey, "RS256");
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(account.clientEmail).setSubject(account.clientEmail).setAudience(TOKEN_URL)
      .setIssuedAt().setExpirationTime("1h")
      .sign(signingKey);
    const res = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
      signal: AbortSignal.timeout(FCM_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Google answered ${res.status} to the service account`);
    const body = await res.json();
    access = { token: body.access_token, until: now() + (Number(body.expires_in) || 3000) * 1000 };
    return access.token;
  }

  async function post(message) {
    return fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(FCM_TIMEOUT_MS),
    });
  }

  return {
    enabled: true,
    async send(token, { title, body, data = {}, channel = "friends", tag = "", ttlSeconds = 300 }) {
      const message = {
        token,
        notification: { title, body },
        data, // strings only
        android: {
          priority: "HIGH", // a friend is waiting: wakes a phone in doze
          ttl: `${ttlSeconds}s`, // useless after a while: not kept for a phone that is off
          notification: { channel_id: channel, ...(tag ? { tag } : {}), default_sound: true },
        },
        apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default" } } },
      };
      try {
        let res = await post(message);
        if (res.status === 401) { access = null; res = await post(message); } // the access token went stale
        if (res.ok) return "ok";
        const detail = await res.json().catch(() => ({}));
        const code = detail?.error?.details?.find?.((d) => d.errorCode)?.errorCode || detail?.error?.status || "";
        if (res.status === 404 || code === "UNREGISTERED" || (res.status === 400 && code === "INVALID_ARGUMENT")) return "gone";
        console.error(`push not sent: FCM answered ${res.status} ${code}`);
        return "failed";
      } catch (err) {
        console.error("push not sent:", err.message);
        return "failed";
      }
    },
  };
}

//--------- not too many ---------
// A person who tries again and again must not buzz a phone each time: one push for the same visitor and room a
// minute, and a few an hour for an account (in memory: a restart forgets, which is fine for a brake).
export function createPushBudget({ perHour = 10, sameVisitorMs = 60_000, now = Date.now } = {}) {
  const hours = new Map(); // userId -> [timestamps]
  const visitors = new Map(); // userId|visitor -> timestamp
  return {
    take(userId, visitor = "") {
      const t = now();
      const key = `${userId}|${visitor}`;
      if (t - (visitors.get(key) || 0) < sameVisitorMs) return false;
      const recent = (hours.get(userId) || []).filter((x) => t - x < 3600_000);
      if (recent.length >= perHour) { hours.set(userId, recent); return false; }
      recent.push(t);
      hours.set(userId, recent);
      visitors.set(key, t);
      if (visitors.size > 2000) visitors.delete(visitors.keys().next().value);
      return true;
    },
  };
}

//--------- the whole ---------
// `notifyJoin(userId, { name, visitor })`: tells the devices of an account that a friend is trying to join their room.
// -> how many devices were sent to (0: no account, no device, switched off, or too many already).
export function createPush({ tokens = createTokenStore(), fcm = createFcm(), budget = createPushBudget() } = {}) {
  return {
    enabled: fcm.enabled,
    tokens,
    async notifyJoin(userId, { name = "", visitor = "" } = {}) {
      try {
        if (!fcm.enabled || !userId) return 0;
        const devices = await tokens.list(userId);
        if (!devices.length || !budget.take(userId, visitor)) return 0;
        let sent = 0;
        await Promise.all(devices.map(async (device) => {
          const text = pushText(device.lang, "join", { name: String(name || "").slice(0, 24) });
          const result = await fcm.send(device.token, { ...text, data: { type: "join" }, tag: "room-join" });
          if (result === "ok") sent++;
          else if (result === "gone") await tokens.removeToken(device.token);
        }));
        return sent;
      } catch (err) {
        console.error("push failed:", err.message);
        return 0;
      }
    },
  };
}

export const noPush = { enabled: false, tokens: null, notifyJoin: async () => 0 };
