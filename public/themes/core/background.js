// The moving part of a theme's background, the same for every theme (the theme gives only its layers and what it plays
// now and then, see themes/README.md).
//
// The still picture is the page's background; the moving layers are drawn once and slid by the GPU (CSS), mounted in
// whatever shows the background (the game, the home, the options and the sheets each have a copy of the picture to cover
// what is under them). Only the copy on top is drawn (.bg-fx.live): the copies under another cost graphics memory for
// nothing, and on a phone they made the menu stutter.
import { scope, setCovered } from "./theme-core.js";

const OVERLAYS = ["home-overlay", "options-overlay", "online-overlay", "consent-overlay"];
let current = null; // { def, scope }

function syncLive() {
    const all = [...document.querySelectorAll(".bg-fx")];
    let top = document.body, z = -Infinity;
    for (const id of OVERLAYS) {
        const el = document.getElementById(id);
        if (!el || el.classList.contains("hidden") || getComputedStyle(el).display === "none") continue;
        const zi = Number(getComputedStyle(el).zIndex) || 0;
        if (zi >= z) { z = zi; top = el; }
    }
    // The game under the home or the options is out of sight: what moves in it stands still meanwhile.
    setCovered(top.id === "home-overlay" || top.id === "options-overlay");
    all.forEach((fx) => fx.classList.toggle("live", top === document.body ? fx.parentElement === document.body : top.contains(fx)));
}
let queued = false;
const queueSync = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; syncLive(); }, 60); };

/** Starts watching the overlays that open and close over the game (once, at start-up). */
export function watchOverlays() {
    const watcher = new MutationObserver(queueSync);
    for (const id of OVERLAYS) {
        const el = document.getElementById(id);
        if (el) watcher.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
    }
    queueSync();
}

/** Puts a theme's moving background on every host (or none, `def` null: a plain background). */
export function mountBackground(def, hosts) {
    unmountBackground();
    if (!def?.layers) { syncLive(); return; }
    for (const host of hosts) {
        const fx = document.createElement("div");
        fx.className = "bg-fx";
        fx.dataset.fx = "";
        for (const cls of def.layers) {
            const layer = document.createElement("i");
            layer.className = cls;
            fx.append(layer);
        }
        host.append(fx);
    }
    syncLive();
    const s = scope({ sky: true });
    current = { def, scope: s };
    def.start?.(s);
}

export function unmountBackground() {
    document.querySelectorAll(".bg-fx").forEach((el) => el.remove());
    if (current) { current.def.stop?.(); current.scope.stop(); current = null; }
}

/** All the copies of the moving background that are drawn (one-shot effects are played on each of them). */
export const fxHosts = () => [...document.querySelectorAll(".bg-fx")].filter((fx) => fx.getClientRects().length);
