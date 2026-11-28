// The Spring meadow: soft clouds in two layers, grass and flowers at the foot that lean in a gust of wind now and then,
// and a petal or a small leaf drifting across on the breeze.
import { fxHosts } from "../../core/background.js";

// A gust of wind over the meadow, now and then. It is a wave: it enters from one side and runs across, so each part of the
// meadow leans a moment after its neighbour, and swings back and forth with less and less force until it settles (the
// layers are still the rest of the time). While it lasts, a layer is cut into SLICES: plain boxes, each one a sixth of the
// layer wide, drawing the same picture in the same place (the picture is moved inside the box, so no mask and no clip is
// needed: a mask made the browser redraw every slice at every frame, 17 times more drawing than the rest of the sky put
// together). The slices lean one after another and are thrown away when the gust ends; the layer itself waits behind them.
// Nothing is the same twice: the force, the speed of the wave, the rhythm of the swings. The back layer follows the front
// one a little later and slower.
const SLICES = 6;
const OVERLAP = 1.5; // px two slices share, so no hairline of the sky shows between them
const pictureSize = new Map(); // url -> natural size, once known
function sizeOf(url) {
    if (pictureSize.has(url)) return pictureSize.get(url);
    pictureSize.set(url, null); // asked: the first gust may come before the answer, and then it is a single sway
    const img = new Image();
    img.onload = () => pictureSize.set(url, { w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.src = url;
    return null;
}
function grassGustOnce() {
    const way = Math.random() < 0.5 ? 1 : -1;
    const jitter = (v, spread) => v * (1 + (Math.random() * 2 - 1) * spread);
    const gust = jitter(1, 0.22); // the force of this gust
    const step = jitter(230, 0.3); // ms between a slice and the next: the speed of the wave
    document.querySelectorAll(".fx-grass:not(.fx-slice)").forEach((el) => {
        if (!el.getClientRects().length || !el.parentNode || el.dataset.gusting) return; // (a slice, or a layer already in a gust, is left alone)
        const front = el.classList.contains("fx-grass-front");
        const a = way * (front ? 8 : 5.5) * gust;
        const lag = front ? 0 : 350 + Math.random() * 350;
        const duration = front ? jitter(2800, 0.2) : jitter(3500, 0.2);
        const swings = () => [1, -0.62, 0.4, -0.22, 0.1].map((v) => jitter(v, 0.2));
        const frames = (power) => {
            const at = [0.15, 0.34, 0.52, 0.7, 0.86].map((t, n) => t + (n ? (Math.random() - 0.5) * 0.05 : 0));
            const f = [{ transform: "skewX(0deg)", offset: 0, easing: "cubic-bezier(.25, 0, .35, 1)" }];
            swings().forEach((v, n) => f.push({ transform: `skewX(${a * power * v}deg)`, offset: at[n], easing: "ease-in-out" }));
            f.push({ transform: "skewX(0deg)", offset: 1 });
            return f;
        };
        const url = getComputedStyle(el).backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1];
        const size = url && sizeOf(url);
        if (!size) { el.animate(frames(1), { duration, delay: lag }); return; } // no picture size yet: the whole layer sways
        el.dataset.gusting = "1";
        const W = el.clientWidth, H = el.clientHeight, drawn = (H * size.w) / size.h; // the picture, as `auto 100%` draws it
        const x0 = (W - drawn) / 2; // `center`: where one copy of it starts in the layer
        const anims = [], slices = [];
        for (let k = 0; k < SLICES; k++) {
            const from = (k * W) / SLICES - (k ? OVERLAP : 0), to = ((k + 1) * W) / SLICES + (k < SLICES - 1 ? OVERLAP : 0);
            const slice = el.cloneNode(false);
            slice.classList.add("fx-slice");
            Object.assign(slice.style, { left: `${el.offsetLeft + from}px`, width: `${to - from}px`, backgroundPosition: `${x0 - from}px 100%` });
            el.parentNode.insertBefore(slice, el.nextSibling);
            slices.push(slice);
            const order = way > 0 ? k : SLICES - 1 - k; // the wave runs the way of the lean
            anims.push(slice.animate(frames(jitter(1, 0.12)), { duration, delay: lag + order * step, fill: "both" }));
        }
        const total = lag + (SLICES - 1) * step + duration + 60;
        const hide = el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: total }); // the layer itself waits behind its slices
        Promise.all([...anims.map((x) => x.finished), hide.finished]).catch(() => {}).finally(() => { slices.forEach((x) => x.remove()); delete el.dataset.gusting; });
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
        ["grass-back.svg", "grass-front.svg"].forEach((f) => sizeOf(new URL(f, import.meta.url).href)); // so the first gust already knows them
        ctx.every(7000, 15000, petalOnce, { first: 2500 + Math.random() * 3000 });
        ctx.every(16000, 36000, grassGustOnce, { first: 4000 + Math.random() * 3000 });
    },
};
