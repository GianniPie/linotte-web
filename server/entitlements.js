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
// Pro also comes from a grant: an account listed in Supabase's pro_grants
// table (supabase/pro_grants.sql), given Pro by hand -- the developer's own
// account, testers, prizes. Read with the project's secret key.

import { REVENUECAT_SECRET_KEY, PRO_ENTITLEMENT_ID, ALLOW_DEV_PRO } from "./config.js";
import { SUPABASE_URL } from "../public/shared/accounts.js";

const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

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

async function hasGrant(userId, key, url, fetchImpl) {
  const res = await fetchImpl(`${url}/rest/v1/pro_grants?user_id=eq.${encodeURIComponent(userId)}&select=user_id`, {
    headers: { apikey: key },
  });
  if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// `userId`: the verified account id, or null for a guest (never Pro).
// `devToken`: "dev-pro" unlocks Pro for testing outside production.
// `key` / `grantKey` / `url` / `fetch` are only passed by the smoke test.
export async function isPro({ userId = null, devToken = "" } = {}, {
  key = REVENUECAT_SECRET_KEY, grantKey = SUPABASE_SECRET_KEY, url = SUPABASE_URL, fetch: fetchImpl = fetch,
} = {}) {
  if (ALLOW_DEV_PRO && devToken === "dev-pro") return true;
  if ((!key && !grantKey) || typeof userId !== "string" || !userId) return false;

  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.pro;

  try {
    const pro = (grantKey && url && await hasGrant(userId, grantKey, url, fetchImpl))
      || (key ? await askRevenueCat(userId, key, fetchImpl) : false);
    cache.set(userId, { pro, at: Date.now() });
    return pro;
  } catch (err) {
    console.error("Pro check failed:", err.message);
    return hit ? hit.pro : false; // a short outage shouldn't lock out paying players
  }
}

// After a purchase the app asks again at once: the 5-minute cache would
// otherwise keep saying "not Pro".
export function forgetPro(userId) {
  cache.delete(userId);
}
