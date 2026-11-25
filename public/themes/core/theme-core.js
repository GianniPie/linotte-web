// The global rules for everything that moves in a theme (see themes/README.md). A theme's elements never decide when
// they may move: they ask this module for their timers, layers and animations, and the rules below apply to all of them.
//
//  - Effects are off when the player switched them off, when the battery is low, when the phone asks for less motion.
//  - Nothing moves while the page is in the background, while the home or the options cover the game, or while the
//    table turns (FLIP, same table).
//  - Between two movements nothing runs: a timer starts a short animation, and that is all.

const state = { reduced: false, covered: false, flipping: false };
const flag = (name, on) => document.body.classList.toggle(name, on);

/** May something move right now? The sky is shown by the home and the options too, so being covered does not stop it. */
export const motionAllowed = (sky = false) => !document.hidden && !state.reduced && !state.flipping && (sky || !state.covered);
export const isReduced = () => state.reduced;
export const isFlipping = () => state.flipping;

/** Effects off (the switch, a low battery, the phone's "reduce motion"): the still drawings stay, nothing moves. */
export function setReduced(on) {
    state.reduced = Boolean(on);
    flag("fx-off", state.reduced);
}

/** The game is out of sight under the home or the options. */
export function setCovered(on) {
    state.covered = Boolean(on);
    flag("game-covered", state.covered);
}

// While the table turns: the moving layers are hidden (CSS, core.css) and what is still moving is brought to its end.
let flipTimer = 0;
export function startFlip(ms = 750) {
    state.flipping = true;
    flag("flipping", true);
    // a short movement still going (a flipper, a lid) rests where it ends instead of stopping half way
    document.querySelectorAll("[data-fx-live]").forEach((el) => el.getAnimations({ subtree: true }).forEach((a) => { try { a.finish(); } catch { /* an endless one */ } }));
    clearTimeout(flipTimer);
    flipTimer = setTimeout(() => { state.flipping = false; flag("flipping", false); }, ms);
}

const between = (min, max) => min + Math.random() * (max - min);

/**
 * The scope of one element (`sky`: the sky, which keeps moving under the home and the options): its timers and layers, all stopped together. `scope.every(min, max, fn, { first })` runs `fn` every
 * `min` to `max` milliseconds, but only when motion is allowed (otherwise that turn is skipped, the timer goes on). `fn` may
 * return the number of ms to wait for the next one (a second flash right after the first). `first` is the wait before the
 * first one (default: the same as the others).
 */
export function scope({ sky = false } = {}) {
    const timers = new Set();
    const api = {
        every(min, max, fn, { first } = {}) {
            const entry = { id: 0 };
            const tick = () => {
                let next = between(min, max);
                if (motionAllowed(sky)) { const r = fn(); if (typeof r === "number") next = r; }
                entry.id = setTimeout(tick, next);
            };
            entry.id = setTimeout(tick, first ?? between(min, max));
            timers.add(entry);
            return { stop() { clearTimeout(entry.id); timers.delete(entry); } };
        },
        /** a short animation of one element, only when motion is allowed (null otherwise) */
        animate(el, keyframes, options) {
            return motionAllowed(sky) ? el.animate(keyframes, options) : null;
        },
        /** a layer for the element's moving parts: marked data-fx, so the global rules (core.css) reach it */
        layer(host, tag, className) {
            const el = document.createElement(tag);
            el.className = className;
            el.dataset.fx = "";
            host.append(el);
            return el;
        },
        stop() { timers.forEach((t) => clearTimeout(t.id)); timers.clear(); },
    };
    return api;
}
