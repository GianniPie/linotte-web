// Where the online game server lives.
//
// PUBLIC_SERVER_URL is the hosted server (Render, see render.yaml), used by
// the published web site and the store apps. Empty until it exists: then
// Online and Friend only say "coming soon" there.
export const PUBLIC_SERVER_URL = "";

// A page served by the Node server itself -- `npm start` on this machine, or
// the same through an ngrok tunnel -- talks to that server (same origin).
// The store apps load from capacitor://localhost or https://localhost, so
// "http:" alone can't be mistaken for them.
const SERVED_BY_NODE = location.protocol === "http:" ||
    /\.ngrok(-free)?\.(app|dev|io)$/.test(location.hostname);

export const SERVER_URL = SERVED_BY_NODE ? "" : PUBLIC_SERVER_URL;

// Online play is offered whenever there is a server to talk to.
export const ONLINE_AVAILABLE = SERVED_BY_NODE || PUBLIC_SERVER_URL !== "";

// Shown in the help page's credits, for rights holders of a piece design and
// for commercial enquiries. Empty: the text just says "contact the developer".
export const CONTACT_EMAIL = "";

// Public pages the consent screen links to.
export const TERMS_URL = "legal/terms.html";
export const PRIVACY_URL = "legal/privacy.html";
