//----------- ACCOUNTS (SUPABASE) ---------------
// The Supabase project that holds Linotte's accounts. Shared by the app
// (public/auth.js signs players in) and the game server (server/accounts.js
// checks who a signed-in player is).
//
// Both values are public by design: they ship inside every copy of the app.
// What protects the accounts is Supabase itself (and, later, the database's
// row-level security), not keeping these secret.
//
// Empty: there are no accounts yet, and "Sign in" only says it's coming soon.
export const SUPABASE_URL = "https://bduljtytdwoviszvilrw.supabase.co"; // project "Linotte", Frankfurt
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Gc2mIY3xBT2z-LJ3kmV9vw_M_Ym_Ss7";

// Whether the sign-in email carries a code to type in the app. Supabase's
// built-in mailer has a fixed email with only a link (and only sends to the
// project's own team): set this to true once our own mail service (SMTP) is
// connected and the "Magic link or OTP" template has {{ .Token }} in it.
export const EMAIL_HAS_CODE = false;

export const ACCOUNTS_AVAILABLE = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";
