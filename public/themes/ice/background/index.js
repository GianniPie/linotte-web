// The Ice sky: an aurora of tall thin rays that drifts and now and then swells, the mountains over it, a snowflake that
// falls, a glint that twinkles on the snow, and a shooting star across the upper sky.
import { fxHosts } from "../../core/background.js";
import { twinkle } from "../../core/effects.js";

// A single snowflake falls, swaying, now and then (a falling snow all the time was too heavy to draw).
function flakeOnce() {
    const W = window.innerWidth, H = window.innerHeight;
    const size = 14 + Math.random() * 14, x0 = Math.random() * W, sway = 18 + Math.random() * 30, phase = Math.random() * 6.28;
    const turns = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 240), ms = 7500 + Math.random() * 5000;
    const steps = Array.from({ length: 13 }, (_, k) => {
        const t = k / 12;
        return { offset: t, opacity: k === 0 || k === 12 ? 0 : 0.9, transform: `translate(${x0 + sway * Math.sin(phase + t * 7)}px, ${-30 + (H * 0.9 + 30) * t}px) rotate(${turns * t}deg)` };
    });
    fxHosts().forEach((fx) => {
        const el = document.createElement("i");
        el.className = "fx-flake";
        el.style.width = el.style.height = size + "px";
        fx.append(el);
        el.animate(steps, { duration: ms, easing: "linear" }).onfinish = () => el.remove();
    });
}

// A shooting star crosses the upper sky now and then (a streak of light, on the GPU, gone in about a second).
function starOnce() {
    const W = window.innerWidth, H = window.innerHeight;
    const x0 = W * (0.08 + Math.random() * 0.6), y0 = H * (0.04 + Math.random() * 0.2);
    const dx = W * (0.22 + Math.random() * 0.14) * (Math.random() < 0.8 ? 1 : -1), dy = Math.abs(dx) * 0.32;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    fxHosts().forEach((fx) => {
        const el = document.createElement("i");
        el.className = "fx-star";
        fx.append(el);
        el.animate([
            { opacity: 0, transform: `translate(${x0}px, ${y0}px) rotate(${angle}deg)`, offset: 0 },
            { opacity: 1, offset: 0.2 },
            { opacity: 0, transform: `translate(${x0 + dx}px, ${y0 + dy}px) rotate(${angle}deg)`, offset: 1 },
        ], { duration: 900 + Math.random() * 400, easing: "ease-in" }).onfinish = () => el.remove();
    });
}

// The aurora swells now and then: its curtains rise behind the peaks and sink back (the scale, not the opacity or the
// drift, which the CSS animation already moves).
function auroraSurgeOnce() {
    const rise = 1.06 + Math.random() * 0.1;
    document.querySelectorAll(".fx-aurora").forEach((el) => {
        if (!el.getClientRects().length) return;
        el.animate([
            { scale: "1 1", offset: 0 },
            { scale: `1.04 ${rise}`, offset: 0.45 },
            { scale: "1 1", offset: 1 },
        ], { duration: 8000 + Math.random() * 4000, easing: "ease-in-out" });
    });
}

// A glint twinkles on the ice now and then (one or two at a time, on the mountains and the snow).
function glintOnce() {
    const count = Math.random() < 0.4 ? 2 : 1;
    for (let n = 0; n < count; n++) {
        const x = 4 + Math.random() * 92, y = 68 + Math.random() * 29, size = 16 + Math.random() * 22, ms = 900 + Math.random() * 900;
        fxHosts().forEach((fx) => {
            const el = document.createElement("i");
            el.className = "fx-glint";
            el.style.cssText = `left:${x}%;top:${y}%;width:${size}px;height:${size}px`;
            fx.append(el);
            twinkle(el, ms);
        });
    }
}

export default {
    ink: "ice",
    // bottom to top: the aurora, then the mountains over it
    layers: ["fx-aurora", "fx-range"],
    start(ctx) {
        ctx.every(1300, 3700, glintOnce, { first: 1200 + Math.random() * 1500 });
        ctx.every(4000, 11000, flakeOnce, { first: 2500 + Math.random() * 3000 });
        ctx.every(22000, 48000, starOnce, { first: 9000 + Math.random() * 9000 });
        ctx.every(11000, 25000, auroraSurgeOnce, { first: 6000 + Math.random() * 6000 });
    },
};
