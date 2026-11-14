// The bot lab, phone side (see server/botlab.js and public/botlab.html).
// Off unless the app was opened once with ?botlab=1 (or ?botlab=KEY when the
// server asks for one); ?botlab=0 turns it off again. Then every "speed" bot
// turn is sent to the server for the lab page, and what the lab learns from
// its corrections (where to place, what to aim for and call, when to stop) comes
// back and changes how that bot plays.

import { SERVER_URL } from "./config.js";

const FLAG = "linotte-botlab";

(function readParam() {
    try {
        const param = new URL(location.href).searchParams.get("botlab");
        if (param === null) return;
        if (param === "0") localStorage.removeItem(FLAG); else localStorage.setItem(FLAG, param);
    } catch { /* no storage: off */ }
})();

export function labOn() {
    try { return localStorage.getItem(FLAG); } catch { return null; }
}

const url = (path) => `${SERVER_URL}/api/botlab/${path}` + (labOn() && labOn() !== "1" ? `?key=${encodeURIComponent(labOn())}` : "");

// One turn, or the turn so far (the same id again replaces it).
export function labSend(turn) {
    if (!labOn()) return;
    fetch(url("turn"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turn }), keepalive: true })
        .catch(() => { /* the lab is not there: the game goes on */ });
}

// Calls onLearned({ weights, aim, call, stop }) now and whenever the lab learns something.
export function labListen(onLearned) {
    if (!labOn() || typeof EventSource === "undefined") return;
    const source = new EventSource(url("stream"));
    source.addEventListener("weights", (e) => {
        try {
            const l = JSON.parse(e.data);
            onLearned({ weights: l.weights ?? null, aim: l.aim ?? null, call: l.call ?? null, stop: l.stop ?? null });
        } catch { /* ignore */ }
    });
}
