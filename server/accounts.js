//----------- ACCOUNTS ---------------
// A signed-in player sends their Supabase access token in "hello" (or later
// in "auth"); this checks it really comes from Linotte's Supabase project and
// returns the account id, which is what Pro and purchases will hang on.
// Guests send nothing and stay guests.
//
// The token is checked locally against the project's public signing keys
// (fetched once and cached by jose). A project still on the older shared-
// secret tokens has no public keys: then Supabase itself is asked.

import { createRemoteJWKSet, jwtVerify } from "jose";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../public/shared/accounts.js";
import { cleanPlayerName, isCountry } from "../public/shared/playerNames.js";
import { isAvatar } from "../public/shared/assets.js";

let remoteKeys = null;

// keys / url are only passed by the smoke test.
export async function userIdFromToken(token, { keys = null, url = SUPABASE_URL } = {}) {
  if (!url || typeof token !== "string" || token.length < 20 || token.length > 4096) return null;
  if (!keys) keys = remoteKeys ??= createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  try {
    const { payload } = await jwtVerify(token, keys, { issuer: `${url}/auth/v1`, audience: "authenticated" });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch (err) {
    if (err?.code === "ERR_JWKS_NO_MATCHING_KEY" && url === SUPABASE_URL) return askSupabase(token);
    return null; // expired, forged, another project's...
  }
}

async function askSupabase(token) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.id === "string" ? user.id : null;
  } catch (err) {
    console.error("account check failed:", err.message);
    return null;
  }
}

// The player's own profile (supabase/profiles.sql), read with their own token
// so the database's row-level security applies. Only what passes the same
// checks as the app is kept: a bad name, picture or country is dropped (and
// the random animal name is used instead).
export async function profileOf(token, { url = SUPABASE_URL, fetch: fetchImpl = fetch } = {}) {
  const none = { name: "", avatar: "", country: "" };
  if (!url || !token) return none;
  try {
    const res = await fetchImpl(`${url}/rest/v1/profiles?select=name,avatar,country&limit=1`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return none; // e.g. the table isn't there yet
    const [row] = await res.json();
    if (!row) return none;
    return {
      name: cleanPlayerName(row.name),
      avatar: isAvatar(row.avatar) ? row.avatar : "",
      country: isCountry(row.country) ? row.country : "",
    };
  } catch (err) {
    console.error("profile read failed:", err.message);
    return none;
  }
}
