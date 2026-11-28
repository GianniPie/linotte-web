// Whether things may move at all: the player's switch (Options > Animations), a low battery, the phone's "reduce motion".
// The state is kept in theme-core.js (setReduced); this is where it comes from.
import { setReduced } from "./theme-core.js";

let preference = true;
let batteryLow = false;
let onChange = () => {};
const reduceQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

export const reducedMotion = () => !preference || batteryLow || Boolean(reduceQuery?.matches);
export const motionPreference = () => preference;

/** What stops things for a reason outside the player's hands: "battery" (low, not charging), "reduce" (the phone's reduce
 *  motion setting), or null. The switch of the options is not lit while one holds, and comes back by itself when it ends. */
export const outsideBlock = () => (batteryLow ? "battery" : reduceQuery?.matches ? "reduce" : null);
export const batteryIsLow = () => batteryLow;
const blockListeners = new Set();
/** `fn` is called when an outside cause starts or ends. */
export function onOutsideBlockChange(fn) { blockListeners.add(fn); }

function apply() {
    setReduced(reducedMotion());
    onChange();
    blockListeners.forEach((fn) => fn());
}

/** Starts: `preference` is the player's switch, `change` is called when motion goes on or off (the themes are mounted again). */
export function initMotion({ preference: on, change }) {
    preference = on;
    onChange = change;
    setReduced(reducedMotion());
    reduceQuery?.addEventListener?.("change", apply); // the phone's setting turned on or off
    // off by itself while the battery is low (20% or less, not charging), where the browser or the app tells it
    navigator.getBattery?.().then((battery) => {
        const check = () => {
            const low = !battery.charging && battery.level <= 0.2;
            if (low === batteryLow) return;
            batteryLow = low;
            apply();
        };
        check();
        battery.addEventListener("levelchange", check);
        battery.addEventListener("chargingchange", check);
    }).catch(() => { /* no battery information */ });
}

/** The player's switch was turned. */
export function setMotionPreference(on) {
    preference = on;
    apply();
}
