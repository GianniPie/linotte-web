// The Storm sky: clouds in three layers sliding at three speeds, a glow and a bolt for each of the two places the
// lightning comes from, a light over the whole sky, and a drop that falls across the screen now and then.
// The drawings and the CSS of these layers (.fx-*) are in this folder; the rules about when anything may move are global.
import { fxHosts } from "../../core/background.js";

// A flash: the glow of the sky, the bolt and the light over the whole sky, each with its own flicker (opacity steps: offset,
// opacity). Not the same every time: a single stroke, a quick double, a stutter of three, a slow double and a distant sheet
// of light with no bolt. One is picked at random, never the one just played; now and then a second one follows within a
// second or two.
const FLASH_KINDS = [
    { weight: 3, glow: [1500, [[0, 0], [0.09, 1], [0.4, 0.45], [1, 0]]], bolt: [650, [[0, 0], [0.2, 1], [0.55, 0.2], [1, 0]]], light: [800, [[0, 0], [0.15, 0.5], [1, 0]]] }, // single
    { weight: 3, glow: [1100, [[0, 0], [0.1, 1], [0.25, 0.2], [0.4, 0.9], [1, 0]]], bolt: [600, [[0, 0], [0.16, 1], [0.34, 0], [0.52, 1], [0.8, 0], [1, 0]]], light: [700, [[0, 0], [0.14, 0.5], [0.36, 0.05], [0.55, 0.4], [1, 0]]] }, // quick double
    { weight: 2, glow: [1500, [[0, 0], [0.07, 1], [0.18, 0.15], [0.27, 0.9], [0.38, 0.1], [0.5, 1], [1, 0]]], bolt: [1100, [[0, 0], [0.09, 1], [0.2, 0], [0.3, 0.8], [0.4, 0], [0.5, 1], [0.72, 0], [1, 0]]], light: [1100, [[0, 0], [0.08, 0.5], [0.2, 0], [0.3, 0.4], [0.4, 0], [0.5, 0.5], [1, 0]]] }, // stutter
    { weight: 2, glow: [2860, [[0, 0], [0.091, 1], [0.273, 0.15], [0.409, 0.8], [1, 0]]], bolt: [1560, [[0, 0], [0.1667, 1], [0.4167, 0], [0.667, 1], [1, 0]]], light: [1820, [[0, 0], [0.143, 0.48], [0.429, 0], [0.643, 0.36], [1, 0]]] }, // slow double
    { weight: 2, glow: [2600, [[0, 0], [0.2, 0.9], [0.45, 0.45], [0.65, 0.8], [1, 0]]], bolt: null, light: [2000, [[0, 0], [0.25, 0.3], [0.5, 0.1], [0.7, 0.25], [1, 0]]] }, // distant sheet
];
let lastFlashKind = -1;
const play = (els, [duration, steps]) => els.forEach((el) => el.animate(steps.map(([offset, opacity]) => ({ offset, opacity })), { duration }));
function flashOnce() {
    let kind;
    do {
        let r = Math.random() * FLASH_KINDS.reduce((sum, k) => sum + k.weight, 0);
        kind = FLASH_KINDS.findIndex((k) => (r -= k.weight) < 0);
    } while (kind === lastFlashKind);
    lastFlashKind = kind;
    const f = FLASH_KINDS[kind], which = Math.random() < 0.5 ? "a" : "b";
    play(document.querySelectorAll(".fx-glow-" + which), f.glow);
    if (f.bolt) play(document.querySelectorAll(".fx-bolt-" + which), f.bolt);
    play(document.querySelectorAll(".bg-fx .fx-light"), f.light);
    if (Math.random() < 0.18) return 900 + Math.random() * 1400; // a second one right after
}

// A drop that falls across the screen now and then (sometimes two or three, one after the other).
function fallOne(x) {
    const fall = window.innerHeight + 140;
    fxHosts().forEach((fx) => {
        const drop = document.createElement("i");
        drop.className = "fx-drop";
        drop.style.left = x + "%";
        fx.append(drop);
        drop.animate([
            { opacity: 0, transform: "translate(0, -70px)", offset: 0 },
            { opacity: 0.8, transform: `translate(${fall * 0.06}px, ${fall * 0.12 - 70}px)`, offset: 0.12 },
            { opacity: 0.8, transform: `translate(${fall * 0.13}px, ${fall * 0.9 - 70}px)`, offset: 0.9 },
            { opacity: 0, transform: `translate(${fall * 0.14}px, ${fall - 70}px)`, offset: 1 },
        ], { duration: fall / 0.9, easing: "cubic-bezier(.4,0,.9,.7)" }).onfinish = () => drop.remove();
    });
}
function dropOnce() {
    const count = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 2) : 1;
    for (let i = 0; i < count; i++) setTimeout(() => fallOne(4 + Math.random() * 92), i * (250 + Math.random() * 400));
}

export default {
    ink: "storm",
    // bottom to top
    layers: ["fx-cloud fx-far", "fx-glow fx-glow-a", "fx-glow fx-glow-b", "fx-cloud fx-mid", "fx-bolt fx-bolt-a", "fx-bolt fx-bolt-b", "fx-cloud fx-near", "fx-top", "fx-light"],
    start(ctx) {
        ctx.every(7000, 16000, flashOnce, { first: 4000 + Math.random() * 4000 });
        ctx.every(5000, 12000, dropOnce, { first: 2500 + Math.random() * 3000 });
    },
};
