//----------- ENTITLEMENTS (PRO) ---------------
// Linotte Pro belongs to an account: the store apps log RevenueCat in with
// the Supabase account id, so a purchase made on one phone is Pro on every
// device signed in to that account (and on the web). The server only trusts
// the account id it verified itself (server/accounts.js), never an id the
// client claims.
//
// Pro today: creating private friend rooms, choosing one's piece, the level
// badge the opponent sees, and later no ads and exclusive new designs.
//
// Who an account is, from the bottom (docs/ROLES.md): guest (no account), member (signed in), pro (bought
// Pro in a store), tester and special (given Pro's things, but not Pro: they can buy it), collaborator and
// admin (Pro). The star, the mark of Pro, is for a purchase and for the collaborators and the admin. The
// four roles above Pro are given by hand in Supabase's account_roles table
// (supabase/roles.sql), and an account in the older pro_grants table counts as a tester. Read with
// the project's secret key. isPro() still answers the question the game asks most: does this account
// have Pro's things (no ads, private rooms, its own piece, the Pro looks)? Everyone from pro up does;
// only "pro" has the star, the mark of a purchase that opponents see.

import { REVENUECAT_SECRET_KEY, PRO_ENTITLEMENT_ID, ALLOW_DEV_PRO } from "./config.js";
import { SUPABASE_URL } from "../public/shared/accounts.js";

const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map(); // userId -> { role, purchased, at }

export const ROLES = ["guest", "member", "pro", "tester", "special", "collaborator", "admin"];
const GIVEN_ROLES = ["tester", "special", "collaborator", "admin"]; // what account_roles may hold
export const roleRank = (role) => Math.max(0, ROLES.indexOf(role));
export const atLeast = (role, min) => roleRank(role) >= roleRank(min);

// What a role has. New things for the upper roles hang here (their own looks, tools, powers): `special`
// is everyone from the close circle up, `staff` the collaborators and the admin, `admin` the admin alone.
export function accessOf(role, purchased = false) {
  return {
    role,
    pro: atLeast(role, "pro"), // Pro's things: no ads, private rooms, own piece, the Pro looks
    purchased, // bought Pro in a store (RevenueCat)
    star: purchased || role === "pro" || atLeast(role, "collaborator"), // is Pro: the star by the name
    special: atLeast(role, "special"),
    staff: atLeast(role, "collaborator"),
    admin: role === "admin",
  };
}

async function askRevenueCat(userId, key, fetchImpl) {
  const res = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`RevenueCat answered ${res.status}`);
  const body = await res.json();
  const ent = body?.subscriber?.entitlements?.[PRO_ENTITLEMENT_ID];
  if (!ent) return false;
  // A lifetime purchase has no expiry date.
  return ent.expires_date == null || new Date(ent.expires_date).getTime() > Date.now();
}

async function givenRole(userId, key, url, fetchImpl) {
  const res = await fetchImpl(`${url}/rest/v1/account_roles?user_id=eq.${encodeURIComponent(userId)}&select=role`, {
    headers: { apikey: key },
  });
  if (!res.ok) return null; // the table isn't there yet: the older grants still work
  const rows = await res.json();
  const role = Array.isArray(rows) ? rows[0]?.role : null;
  return GIVEN_ROLES.includes(role) ? role : null;
}

async function hasGrant(userId, key, url, fetchImpl) {
  const res = await fetchImpl(`${url}/rest/v1/pro_grants?user_id=eq.${encodeURIComponent(userId)}&select=user_id`, {
    headers: { apikey: key },
  });
  if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// The role of an account: given by hand (account_roles, or the older pro_grants: a tester), else
// pro if it bought Pro, else member; a guest has none.
async function resolveRole(userId, key, grantKey, url, fetchImpl) {
  const purchased = key ? await askRevenueCat(userId, key, fetchImpl) : false;
  if (grantKey && url) {
    const given = await givenRole(userId, grantKey, url, fetchImpl);
    if (given) return { role: given, purchased };
    if (await hasGrant(userId, grantKey, url, fetchImpl)) return { role: "tester", purchased };
  }
  return { role: purchased ? "pro" : "member", purchased };
}

// `userId`: the verified account id, or null for a guest.
// `devToken`: "dev-pro" unlocks Pro, "dev-admin" everything, for testing outside production.
// `key` / `grantKey` / `url` / `fetch` are only passed by the smoke test.
export async function accessFor({ userId = null, devToken = "" } = {}, {
  key = REVENUECAT_SECRET_KEY, grantKey = SUPABASE_SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch,
} = {}) {
  if (ALLOW_DEV_PRO && devToken === "dev-pro") return accessOf("pro");
  if (ALLOW_DEV_PRO && devToken === "dev-admin") return accessOf("admin"); // to try the themes and the special things
  if (typeof userId !== "string" || !userId) return accessOf("guest");
  if (!key && !grantKey) return accessOf("member");

  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return accessOf(hit.role, hit.purchased);

  try {
    const { role, purchased } = await resolveRole(userId, key, grantKey, url, fetchImpl);
    cache.set(userId, { role, purchased, at: Date.now() });
    return accessOf(role, purchased);
  } catch (err) {
    console.error("Pro check failed:", err.message);
    return hit ? accessOf(hit.role, hit.purchased) : accessOf("member"); // a short outage shouldn't lock out paying players
  }
}

// For testing outside production, the "dev-admin" token also gives the points of the top level (50), so every look
// (dice, backgrounds) is open on the app and on the server alike, whatever the signed-in account really has: before,
// the app was at the account's own level and the looks stayed locked. Only what is read is changed, nothing is written.
export const DEV_ADMIN_XP = 2275; // level 50, see levelOf in public/shared/level.js
export const devXp = (devToken) => (ALLOW_DEV_PRO && devToken === "dev-admin" ? DEV_ADMIN_XP : null);

// Does the account have Pro's things? (From pro up, the star or not.)
export async function isPro(who, options) {
  return (await accessFor(who, options)).pro;
}

// After a purchase the app asks again at once: the 5-minute cache would
// otherwise keep saying "not Pro".
export function forgetPro(userId) {
  cache.delete(userId);
}
