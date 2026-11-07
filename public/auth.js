//----------- SIGN IN ---------------
// Accounts are optional: everyone plays as a guest, and signing in keeps
// Pro, purchases and progress on every device. Supabase does the work
// (Google, Apple, a code by email); this module wraps it for the app.
//
// The library (vendor/supabase.js, supabase-js 2.118.0) is only loaded
// when accounts are switched on in public/shared/accounts.js.

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ACCOUNTS_AVAILABLE, EMAIL_HAS_CODE } from "./shared/accounts.js";

export { ACCOUNTS_AVAILABLE, EMAIL_HAS_CODE };

let client = null;
let starting = null;
let current = null; // { id, email, name, avatar, provider } or null
const listeners = new Set();

function loadLibrary() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "vendor/supabase.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("could not load vendor/supabase.js"));
        document.head.appendChild(s);
    });
}

function toUser(u) {
    if (!u) return null;
    const meta = u.user_metadata || {};
    return {
        id: u.id,
        email: u.email || "",
        name: meta.full_name || meta.name || "",
        avatar: meta.avatar_url || meta.picture || "",
        provider: u.app_metadata?.provider || "email",
    };
}

function setUser(u) {
    const next = toUser(u);
    if (next?.id === current?.id && next?.email === current?.email) return;
    current = next;
    listeners.forEach((f) => f(current));
}

// Back from Google/Apple (or the link in the email), the page URL carries
// ?code=... -- supabase-js turns it into a session; then it's tidied away so
// a reload or a shared link doesn't carry it.
function cleanUrl() {
    const url = new URL(location.href);
    let changed = false;
    for (const k of ["code", "error", "error_code", "error_description"]) {
        if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; }
    }
    if (url.hash.includes("access_token") || url.hash.includes("error")) { url.hash = ""; changed = true; }
    if (changed) history.replaceState(null, "", url.pathname + url.search + url.hash);
}

// Starts Supabase once; resolves to the client, or null without accounts.
export function initAuth() {
    if (!ACCOUNTS_AVAILABLE) return Promise.resolve(null);
    if (starting) return starting;
    starting = (async () => {
        try {
            await loadLibrary();
            client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
            });
            client.auth.onAuthStateChange((_event, session) => setUser(session?.user));
            const { data } = await client.auth.getSession();
            setUser(data.session?.user);
            cleanUrl();
            return client;
        } catch (err) {
            console.error("sign-in unavailable:", err.message);
            starting = null; // try again next time
            return null;
        }
    })();
    return starting;
}

// Which sign-in methods are switched on in the Supabase dashboard
// (Authentication > Sign In / Providers), e.g. { email: true, google: false }.
// A button for a method that is off would only lead to an error page.
let providers = null;
export async function enabledProviders() {
    if (!ACCOUNTS_AVAILABLE) return {};
    if (providers) return providers;
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
        providers = (await res.json()).external || {};
    } catch {
        return { email: true }; // offline: show the email way, it explains itself
    }
    return providers;
}

// Called now with the current user, then on every sign-in / sign-out.
export function onUserChange(fn) {
    listeners.add(fn);
    fn(current);
    return () => listeners.delete(fn);
}

export const currentUser = () => current;

// Where Google/Apple/the email link send the player back: this same page.
const returnUrl = () => location.origin + location.pathname;

async function ready() {
    const c = await initAuth();
    if (!c) throw new Error("unavailable");
    return c;
}

// Leaves the page for Google's or Apple's sign-in and comes back signed in.
export async function signInWith(provider) {
    const c = await ready();
    const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: returnUrl() } });
    if (error) throw error;
}

// Emails a one-time code (the same email also has a sign-in link, which
// works when opened on this same device).
export async function sendEmailCode(email) {
    const c = await ready();
    const { error } = await c.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: returnUrl(), shouldCreateUser: true },
    });
    if (error) throw error;
}

export async function verifyEmailCode(email, code) {
    const c = await ready();
    const { error } = await c.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) throw error;
}

export async function signOut() {
    const c = await ready();
    await c.auth.signOut();
    setUser(null);
}

// Deletes the signed-in account for good (supabase/delete_account.sql must
// have been run in the project), then signs out.
export async function deleteAccount() {
    const c = await ready();
    const { error } = await c.rpc("delete_account");
    if (error) throw error;
    await c.auth.signOut({ scope: "local" });
    setUser(null);
}

// The signed-in player's current token, for the game server; null as a guest.
export async function accessToken() {
    if (!client || !current) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
}
