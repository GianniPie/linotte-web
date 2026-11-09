//----------- SERVER CONFIG ---------------
// Everything tunable lives here, overridable through environment variables
// so the same code runs locally, on a staging box and in production.

export const PORT = Number(process.env.PORT) || 3000;
// Render sets RENDER=true on every service, so the hosted server is in
// production mode even if NODE_ENV was never set in its dashboard.
export const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

// Bump whenever the Terms / Privacy Policy / bot notice text changes: the
// client shows the consent screen again and the server refuses online play
// from anyone who hasn't accepted this version (see lobby/server.js).
export const CONSENT_VERSION = 1;

// Same 30s the client's turn clock shows (MAX_TIMER in linotte.js), plus slack
// for the animations the clients play between turns (the clock only restarts
// once the previous turn's celebration is done) and for network latency. A
// client auto-submits at its own 0; this is only the backstop for a player
// who is gone.
export const TURN_SECONDS = 30;
// A player who lets this many turns in a row end without rolling once is
// gone in all but name: they lose the game as if they had left (it costs
// level points, see results.js). Their opponent is warned one turn before,
// and may leave meanwhile at no cost.
export const IDLE_TURNS_LIMIT = 3;
export const TURN_SLACK_MS = 5000;
export const TURN_GRACE_MS = 4000;
// The coin flip overlay the clients play before the first turn.
export const COIN_FLIP_MS = 4500;

// How long a seat may stay disconnected (phone locked, app backgrounded to
// share an invite, flaky network) before the game is forfeited.
export const RECONNECT_GRACE_MS = 60 * 1000;

// A private room nobody joined is dropped after this.
export const ROOM_WAIT_TTL_MS = 15 * 60 * 1000;
// Finished rooms are kept briefly so a refresh can still show the result.
export const ROOM_OVER_TTL_MS = 5 * 60 * 1000;
// How often the server's bot turns a rematch down (a person sometimes would).
export const BOT_REMATCH_DECLINE = 0.15;

// When no human is found, a bot seat joins after a random wait in this range.
export const QUEUE_BOT_DELAY_MS = [7000, 15000];

// Multiplies every bot pause (1 = human pace). Tests set it close to 0.
export const BOT_TIME_SCALE = process.env.BOT_TIME_SCALE ? Number(process.env.BOT_TIME_SCALE) : 1;

// The only chat there is: the client's emoji wheel. Anything else is dropped.
export const EMOTES = ["🎲", "❤️", "😮", "🤣", "🙏🏻", "😡", "🥺", "🫤", "👋"];

// Where games are saved so they survive a server restart (see store.js):
// Render Key Value's internal URL, e.g. redis://red-xxxxxxxx:6379. Empty:
// games live in memory only (local runs).
export const REDIS_URL = process.env.REDIS_URL || "";

// RevenueCat (purchases/entitlements). Without a key nobody is Pro in
// production; outside production a dev token unlocks it for testing.
export const REVENUECAT_SECRET_KEY = process.env.REVENUECAT_SECRET_KEY || "";
export const PRO_ENTITLEMENT_ID = process.env.PRO_ENTITLEMENT_ID || "pro";
export const ALLOW_DEV_PRO = !IS_PRODUCTION || process.env.ALLOW_DEV_PRO === "1";

// Creating a friend room needs Pro (joining stays free): the switch lives in
// public/shared/accounts.js so the app's PRO tag and the server agree.
export { ROOMS_NEED_PRO } from "../public/shared/accounts.js";

// Browsers on the same origin are always fine; the native apps (Capacitor)
// load from capacitor://localhost (iOS) / https://localhost (Android), and a
// separately hosted web client has to be listed here.
export const EXTRA_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

// The published web site, always allowed so the hosted server works without
// any setting in its dashboard (ALLOWED_ORIGINS adds others).
const PUBLISHED_SITE = "https://linotte-web.vercel.app";

export function isOriginAllowed(origin) {
  if (!origin) return true; // same-origin / non-browser clients
  if (origin === PUBLISHED_SITE) return true;
  if (origin === "capacitor://localhost" || origin === "ionic://localhost") return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  return EXTRA_ALLOWED_ORIGINS.includes(origin);
}
