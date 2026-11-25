// Whether things may move at all: the player's switch (Options > Animations), a low battery, the phone's "reduce motion".
// The state is kept in theme-core.js (setReduced); this is where it comes from.
import { setReduced } from "./theme-core.js";

let preference = true;
let batteryLow = false;
let onChange = () => {};
const reduceQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

export const reducedMotion = () => !preference || batteryLow || Boolean(reduceQuery?.matches);
export const motionPreference = () => preference;

function apply() {
    setReduced(reducedMotion());
    onChange();
}

/** Starts: `preference` is the player's switch, `change` is called when motion goes on or off (the themes are mounted again). */
export function initMotion({ preference: on, change }) {
    preference = on;
    onChange = change;
    setReduced(reducedMotion());
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
