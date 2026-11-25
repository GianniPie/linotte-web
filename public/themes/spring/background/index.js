// The Spring meadow: soft clouds in two layers, grass and flowers at the foot that lean in a gust of wind now and then,
// and a petal or a small leaf drifting across on the breeze.
import { fxHosts } from "../../core/background.js";

// A gust of wind over the meadow, now and then: the grass and the flowers at the foot lean from their base, the ones in
// front a little more, and settle back (the layers are still the rest of the time).
function grassGustOnce() {
    const way = Math.random() < 0.5 ? 1 : -1;
    document.querySelectorAll(".fx-grass").forEach((el) => {
        if (!el.getClientRects().length) return;
        const front = el.classList.contains("fx-grass-front");
        const a = way * (front ? 3.6 : 2.4);
        el.animate([
            { transform: "skewX(0deg)", offset: 0 },
            { transform: `skewX(${a}deg)`, offset: 0.3 },
            { transform: `skewX(${-a * 0.6}deg)`, offset: 0.6 },
            { transform: `skewX(${a * 0.25}deg)`, offset: 0.82 },
            { transform: "skewX(0deg)", offset: 1 },
        ], { duration: 3000 + Math.random() * 800, delay: front ? 0 : 250, easing: "ease-in-out" });
    });
}

// A petal or a small leaf drifts across the meadow on the breeze now and then.
function petalOnce() {
    const W = window.innerWidth, H = window.innerHeight;
    const kind = Math.random() < 0.65 ? "petal" : "leaf";
    const y0 = H * (0.08 + Math.random() * 0.5), amp = H * (0.05 + Math.random() * 0.08), turns = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360);
    const phase = Math.random() * 6;
    const steps = Array.from({ length: 9 }, (_, k) => {
        const t = k / 8;
        return {
            offset: t,
            opacity: k === 0 || k === 8 ? 0 : 0.92,
            transform: `translate(${-30 + (W + 60) * t}px, ${y0 + amp * Math.sin(phase + t * 6) + H * 0.14 * t}px) rotate(${turns * t}deg)`,
        };
    });
    fxHosts().forEach((fx) => {
        const el = document.createElement("i");
        el.className = "fx-petal";
        el.style.backgroundImage = `url("${new URL(`${kind}.svg`, import.meta.url).pathname}")`;
        fx.append(el);
        el.animate(steps, { duration: 12000 + Math.random() * 5000, easing: "linear" }).onfinish = () => el.remove();
    });
}

export default {
    ink: "spring",
    layers: ["fx-cloud fx-sp-a", "fx-cloud fx-sp-b", "fx-grass fx-grass-back", "fx-grass fx-grass-front"],
    start(ctx) {
        ctx.every(7000, 15000, petalOnce, { first: 2500 + Math.random() * 3000 });
        ctx.every(22000, 50000, grassGustOnce, { first: 5000 + Math.random() * 4000 });
    },
};
