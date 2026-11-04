// Where the online game server lives.
//
//  - "" (empty): same origin as the page. This is what `npm start` uses, and
//    what a web deploy served by the Node server uses.
//  - "https://your-server.example": required for the store apps (iOS/Android
//    load their files locally, so there is no "same origin") and for a static
//    web deploy (Vercel can't hold WebSockets -- the server must be on an
//    always-on Node host). The server has to list the web origin in its
//    ALLOWED_ORIGINS (the native app origins are already allowed).
export const SERVER_URL = "";

// Shown in the help page's credits, for rights holders of a piece design and
// for commercial enquiries. Empty: the text just says "contact the developer".
export const CONTACT_EMAIL = "";

// Public pages the consent screen links to.
export const TERMS_URL = "legal/terms.html";
export const PRIVACY_URL = "legal/privacy.html";
