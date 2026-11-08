//----------- ENTITLEMENTS (PRO) ---------------
// Linotte Pro belongs to an account: the store apps log RevenueCat in with
// the Supabase account id, so a purchase made on one phone is Pro on every
// device signed in to that account (and on the web). The server only trusts
// the account id it verified itself (server/accounts.js), never an id the
// client claims.
//
// Pro today: creating private friend rooms (once ROOMS_NEED_PRO is on), the
// PRO badge the opponent sees, and later no ads and exclusive new designs.

import { REVENUECAT_SECRET_KEY, PRO_ENTITLEMENT_ID, ALLOW_DEV_PRO } from "./config.js";

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map(); // userId -> { pro, at }

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

// `userId`: the verified account id, or null for a guest (never Pro).
// `devToken`: "dev-pro" unlocks Pro for testing outside production.
// `key` / `fetch` are only passed by the smoke test.
export async function isPro({ userId = null, devToken = "" } = {}, { key = REVENUECAT_SECRET_KEY, fetch: fetchImpl = fetch } = {}) {
  if (ALLOW_DEV_PRO && devToken === "dev-pro") return true;
  if (!key || typeof userId !== "string" || !userId) return false;

  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.pro;

  try {
    const pro = await askRevenueCat(userId, key, fetchImpl);
    cache.set(userId, { pro, at: Date.now() });
    return pro;
  } catch (err) {
    console.error("RevenueCat check failed:", err.message);
    return hit ? hit.pro : false; // a short outage shouldn't lock out paying players
  }
}

// After a purchase the app asks again at once: the 5-minute cache would
// otherwise keep saying "not Pro".
export function forgetPro(userId) {
  cache.delete(userId);
}
