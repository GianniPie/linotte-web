// The Storm board: frosted glass tiles with drops of water on them. Now and then a drop swells and slides down a margin
// of the tiles (rain), and when a piece lands the drops of its tile slide away, leaving a trail (drops).
import { isReduced } from "../../core/theme-core.js";

let ctx = null;

//----- the water that slides now and then -----
// A drop swells, slides down a margin of the tiles leaving a thin trail, slows down as it shrinks, stops and fades. Drawn
// by the GPU on a layer of its own; between two of them nothing runs.
const RAIN_LANES = [[2.9, 8, 34], [77.3, 46, 30], [42.9, 22, 38], [17.2, 50, 30], [62.8, 12, 32]]; // x, y, how far (% of the board)
function rainOnce() {
    const layer = document.querySelector(".board-rain");
    if (!layer) return;
    const [x, y, dist] = RAIN_LANES[Math.floor(Math.random() * RAIN_LANES.length)];
    const drop = document.createElement("i");
    drop.className = "rdrop";
    drop.style.cssText = `left:${x - 2.1}%;top:${y - 2.1}%`;
    const trail = document.createElement("i");
    trail.className = "rtrail";
    trail.style.cssText = `left:${x - 0.375}%;top:${y + 0.8}%;height:${dist}%`;
    layer.append(trail, drop);
    const total = 11300; // fade in .6, wait 1.2, slide 5.5, hold 1.2, fade out 2.8 (seconds)
    const at = (s) => s / (total / 1000);
    const far = dist / 4.2 * 100; // the drop's own heights
    const slide = drop.animate([
        { opacity: 0, transform: "translateY(0) scale(1)", offset: 0 },
        { opacity: 1, transform: "translateY(0) scale(1)", offset: at(0.6) },
        { opacity: 1, transform: "translateY(0) scale(1.08)", offset: at(1.8), easing: "ease-in-out" },
        { opacity: 1, transform: `translateY(${far}%) scale(.62)`, offset: at(7.3) },
        { opacity: 1, transform: `translateY(${far}%) scale(.6)`, offset: at(8.5) },
        { opacity: 0, transform: `translateY(${far}%) scale(.55)`, offset: 1 },
    ], { duration: total });
    trail.animate([
        { opacity: 0, transform: "scaleY(0)", offset: 0 },
        { opacity: 0.55, transform: "scaleY(0)", offset: at(1.8), easing: "ease-in-out" },
        { opacity: 0.5, transform: "scaleY(1)", offset: at(7.3) },
        { opacity: 0.45, transform: "scaleY(1)", offset: at(8.5) },
        { opacity: 0, transform: "scaleY(1)", offset: 1 },
    ], { duration: total });
    slide.onfinish = () => { drop.remove(); trail.remove(); };
}

//----- the drops that slide away when a piece lands on their tile -----
// The drops on the board are small elements (x, y of the centre and width, in % of the board) on a layer of their own,
// over the tiles and under the pieces. When a piece lands, the drops of its tile slide down, leaving a trail; one that meets
// another on its way merges into it, which swells a little. A game starting (or any redraw of the board) puts back the drops
// of the empty tiles. Only the GPU moves them (transform, opacity), and only at that moment.
const STORM_DROPS = [[24.7, 2.3, 3.4], [49.1, 38.0, 3.2], [86.1, 17.5, 2.8], [82.4, 7.0, 3.2], [29.8, 42.2, 3.0], [77.9, 2.8, 3.6], [87.9, 37.5, 2.9], [3.7, 57.8, 2.8], [74.1, 38.0, 3.2], [16.0, 81.8, 3.2], [76.1, 57.6, 3.0], [37.9, 85.1, 3.5], [95.7, 18.1, 3.5], [62.1, 28.2, 3.2], [15.1, 2.3, 2.8], [82.2, 96.0, 3.2], [2.4, 34.7, 3.0], [35.2, 22.4, 2.7], [63.0, 62.4, 2.8], [18.1, 72.0, 2.8], [10.9, 57.9, 3.2], [82.0, 25.5, 3.6], [17.8, 53.0, 3.6], [52.0, 77.9, 3.4], [61.7, 9.3, 2.7], [97.0, 77.5, 2.9], [29.4, 37.8, 3.2], [41.9, 64.8, 3.2], [30.8, 78.2, 2.9], [93.4, 62.3, 3.5], [77.7, 44.6, 3.0], [6.4, 18.2, 3.2], [97.6, 69.3, 3.0], [82.2, 90.8, 2.9], [42.1, 88.9, 3.4], [82.1, 74.2, 3.4], [6.7, 62.4, 2.9], [68.5, 62.1, 3.6], [49.4, 61.7, 2.7], [26.6, 62.4, 3.2], [38.3, 73.8, 3.0], [21.7, 9.6, 2.8], [38.0, 14.7, 3.5], [50.0, 22.2, 2.9]];
let drops = []; // { el, x, y, w, gone, grow }
// the tile (row, column) a drop is on (the layer does not turn with the table: the drops stay as they are)
const tileOfDrop = (d) => [Math.min(4, Math.floor(d.y / 20)), Math.min(4, Math.floor(d.x / 20))];

function buildDrops() {
    document.querySelectorAll(".board-drops").forEach((el) => el.remove());
    drops = [];
    const table = ctx.table();
    const layer = ctx.layer(ctx.grid, "div", "board-drops");
    for (const [x, y, w] of STORM_DROPS) {
        const d = { x, y, w, gone: false, grow: 1 };
        const [r, c] = tileOfDrop(d);
        if (table?.[r]?.[c]) continue; // a piece is already there: its drops have slid away
        d.el = document.createElement("i");
        d.el.className = "sdrop";
        d.el.style.cssText = `left:${x - w / 2}%;top:${y - w / 2}%;width:${w}%`;
        layer.append(d.el);
        drops.push(d);
    }
}

function slideAway(r, c) {
    const layer = document.querySelector(".board-drops");
    if (!layer) return;
    const here = drops.filter((d) => !d.gone && tileOfDrop(d).join() === `${r},${c}`);
    for (const d of here) {
        d.gone = true;
        const el = d.el;
        // Another drop below it, in its way: it runs into it and merges. Else it slides a bit and fades.
        const reach = 8 + Math.random() * 14;
        const meet = drops.filter((o) => !o.gone && Math.abs(o.x - d.x) < 3.2 && o.y > d.y + d.w && o.y < d.y + reach + 4)
            .sort((a, b) => a.y - b.y)[0];
        const dist = Math.min(meet ? meet.y - d.y : reach, 99 - d.y);
        if (isReduced() || dist <= 0) { el.remove(); continue; }
        const run = dist / d.w * 100; // translateY is in % of the drop's own height
        const ms = 1500 + dist * 95; // 2.3 to 3.6 seconds: slower than a touch, like the water that slides by itself
        const trail = document.createElement("i");
        trail.className = "dtrail";
        trail.style.cssText = `left:${d.x - 0.2}%;top:${d.y}%;height:${dist}%`;
        layer.append(trail);
        const wait = Math.random() * 120;
        el.animate([
            { transform: "translateY(0) scale(1)", offset: 0 },
            { transform: "translateY(0) scale(1.12)", offset: 0.18, easing: "ease-in" },
            { transform: `translateY(${run}%) scale(${meet ? 1 : 0.7})`, offset: 1 },
        ], { duration: ms, delay: wait, easing: "ease-in-out", fill: "both" });
        trail.animate([
            { opacity: 0, transform: "scaleY(0)", offset: 0 },
            { opacity: 0.55, transform: "scaleY(0)", offset: 0.18, easing: "ease-in" },
            { opacity: 0.5, transform: "scaleY(1)", offset: 1 },
        ], { duration: ms, delay: wait, easing: "ease-in-out", fill: "both" });
        setTimeout(() => {
            if (meet && !meet.gone) { // swells, as if it had taken the other's water
                meet.grow = Math.min(1.4, meet.grow + 0.2);
                meet.el.animate([{ transform: `scale(${meet.grow - 0.2})` }, { transform: `scale(${meet.grow + 0.12})`, offset: 0.4 }, { transform: `scale(${meet.grow})` }], { duration: 420, fill: "forwards" });
                el.remove();
            } else {
                el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" }).onfinish = () => el.remove();
            }
            trail.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: 900, fill: "forwards" }).onfinish = () => trail.remove();
        }, ms + wait);
    }
}

export default {
    skin: "storm",
    mount(c) {
        ctx = c;
        ctx.layer(ctx.grid, "div", "board-rain");
        ctx.every(25000, 55000, rainOnce, { first: 6000 + Math.random() * 4000 });
        buildDrops();
    },
    unmount() {
        ctx?.stop();
        document.querySelectorAll(".board-rain, .board-drops").forEach((el) => el.remove());
        drops = [];
        ctx = null;
    },
    /** a piece landed on this tile */
    onPlace(row, col) { slideAway(row, col); },
    /** the board was drawn again (a game starting): the drops of the empty tiles are back */
    onRedraw() { if (ctx) buildDrops(); },
};
