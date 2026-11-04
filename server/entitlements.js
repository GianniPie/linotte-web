//----------- ENTITLEMENTS (PRO) ---------------
// Who may create a private friend room. There are no accounts: the client
// sends the anonymous app-user id RevenueCat gave this install, and the
// server asks RevenueCat whether that id currently owns the Pro entitlement.
// Joining a friend's room is always free, so only creation is gated.

import { REVENUECAT_SECRET_KEY, PRO_ENTITLEMENT_ID, ALLOW_DEV_PRO } from "./config.js";

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map(); // appUserId -> { pro, at }

async function askRevenueCat(appUserId) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` },
  });
  if (!res.ok) return false;
  const body = await res.json();
  const ent = body?.subscriber?.entitlements?.[PRO_ENTITLEMENT_ID];
  if (!ent) return false;
  return ent.expires_date === null || new Date(ent.expires_date).getTime() > Date.now();
}

// `entitlement` is whatever the client sent in its hello: { appUserId } in the
// store builds, { devToken } while developing.
export async function isPro(entitlement) {
  if (!entitlement || typeof entitlement !== "object") return false;

  if (ALLOW_DEV_PRO && entitlement.devToken === "dev-pro") return true;

  const id = typeof entitlement.appUserId === "string" ? entitlement.appUserId.slice(0, 128) : "";
  if (!REVENUECAT_SECRET_KEY || !id) return false;

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.pro;

  let pro = false;
  try {
    pro = await askRevenueCat(id);
  } catch (err) {
    console.error("RevenueCat check failed:", err.message);
    return hit ? hit.pro : false; // a short outage shouldn't lock out paying users
  }
  cache.set(id, { pro, at: Date.now() });
  return pro;
}
