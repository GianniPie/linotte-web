//----------- WHAT THE PAGE LOGGED ---------------
// The last few errors the page raised, kept in memory so that a problem report (the form in the app) can
// carry them without the player seeing or typing anything. Started as the page loads, before anything else.

const KEEP = 20;
const errors = [];

function note(text) {
  errors.push(`${new Date().toISOString().slice(11, 19)} ${String(text).slice(0, 500)}`);
  if (errors.length > KEEP) errors.shift();
}

window.addEventListener("error", (e) => note(`${e.message} (${(e.filename || "").split("/").pop()}:${e.lineno || 0})`));
window.addEventListener("unhandledrejection", (e) => note(`unhandled: ${e.reason?.message || e.reason}`));
const original = console.error;
console.error = (...args) => {
  try { note(args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" ")); } catch { /* never in the way */ }
  original.apply(console, args);
};

export const recentErrors = () => [...errors];
