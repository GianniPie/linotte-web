// The Spring board: a lawn of tiles with small flowers on it. Every minute or so a gust of wind runs over the board and the
// flowers lean, shiver and settle back; now and then a butterfly or a bee flies over the lawn.

let ctx = null;

//----- the flowers, moved now and then by a gust of wind -----
// The flowers are small drawings of their own (blooms.svg, x and y of the centre and size in % of the board, and the kind:
// daisy, buttercup, pink flower, clover, leaf), on a layer over the tiles and under the pieces: never stretched, whatever the
// board's proportions. Each one, as the wind reaches it, leans, shivers and settles back, the leaves and clover more than
// the flowers. Between two gusts nothing runs; the GPU does it (transform).
const BLOOMS_URL = new URL("blooms.svg", import.meta.url).pathname;
const SPRING_BLOOMS = [[17.77,4.08,4.16,"d"],[50.91,40.93,4.54,"d"],[62.15,13.61,4.21,"b"],[97.69,50.98,3.91,"p"],[82.11,4.78,5.13,"c"],[2.19,55.57,3.97,"l"],[22.11,64.5,4.8,"d"],[75.4,1.17,3.94,"d"],[46.41,57.27,3.43,"b"],[57.77,34.24,3.57,"p"],[28.46,82.07,4.87,"c"],[58.2,91.59,3.38,"l"],[27.04,57.06,4.01,"d"],[15.95,61.26,4.6,"d"],[45.79,96.8,4.07,"b"],[34.78,36.76,3.82,"p"],[82.25,96.13,4.9,"c"],[67.36,17.41,3.54,"l"],[17.74,32.68,4.01,"d"],[37.92,4.54,4.31,"d"],[57.9,53.8,4.19,"b"],[15.57,20.91,3.35,"p"],[42.41,87.05,3.92,"c"],[78.05,36.4,3.42,"l"],[63.27,81.52,4.19,"d"],[17.94,95.81,4.18,"d"],[2.14,1.05,4.29,"b"],[61.63,22.48,3.36,"p"],[77.95,84.62,4.82,"c"],[42.07,37.49,3.38,"l"],[72.35,20.9,4.88,"d"],[21.74,50.2,3.98,"d"],[37.94,64.48,4.14,"b"],[56.75,77.24,3.55,"p"],[57.8,28.98,5.08,"c"],[69.93,97.75,3.59,"l"],[93.88,36.68,4.24,"d"],[77.49,47.31,3.84,"d"]];
let blooms = [];
function buildFlowers() {
    const layer = ctx.layer(ctx.grid, "div", "board-flowers");
    blooms = [];
    SPRING_BLOOMS.forEach(([x, y, size, kind], i) => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "bloom");
        svg.setAttribute("viewBox", `${x - size / 2} ${y - size / 2} ${size} ${size}`);
        svg.style.cssText = `left:${x - size / 2}%;top:${y - size / 2}%;width:${size}%`;
        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", `${BLOOMS_URL}#f${i}`);
        svg.append(use);
        layer.append(svg);
        blooms.push({ el: svg, x, kind });
    });
}
function gustOnce() {
    if (!blooms.length) return;
    const fromLeft = Math.random() < 0.5;
    const flipped = document.body.classList.contains("table-flipped"); // the layer turns with the table: its left is the screen's right
    const way = (fromLeft ? 1 : -1) * (flipped ? -1 : 1);
    const reach = 1500 + Math.random() * 600; // how long the wind takes across the board
    for (const b of blooms) {
        const near = ((fromLeft !== flipped) ? b.x : 100 - b.x) / 100; // 0 where the wind comes in
        const delay = near * reach + Math.random() * 160;
        const lift = b.kind === "c" || b.kind === "l" ? 1 : 0.55; // leaves and clover move more
        const dur = 1300 + Math.random() * 500;
        b.el.animate([
            { transform: "translate(0, 0) rotate(0deg) scale(1)", offset: 0 },
            { transform: `translate(${way * 22 * lift}%, ${-5 * lift}%) rotate(${way * 17 * lift}deg) scale(${1 + 0.07 * lift})`, offset: 0.32, easing: "ease-in-out" },
            { transform: `translate(${-way * 8 * lift}%, ${2 * lift}%) rotate(${-way * 9 * lift}deg) scale(1)`, offset: 0.62, easing: "ease-in-out" },
            { transform: `translate(${way * 3 * lift}%, 0) rotate(${way * 3 * lift}deg) scale(1)`, offset: 0.82, easing: "ease-in-out" },
            { transform: "translate(0, 0) rotate(0deg) scale(1)", offset: 1 },
        ], { duration: dur, delay, easing: "ease-in-out" });
    }
}

//----- the insects -----
// A butterfly or a bee flies over the lawn now and then (sometimes two): a wandering path from one side of the board to
// another, turned the way it flies, drawn by the GPU on a layer of its own. Between two of them nothing runs.
function flyOnce() {
    const layer = document.querySelector(".board-fly");
    if (!layer) return;
    const count = Math.random() < 0.25 ? 2 : 1;
    for (let n = 0; n < count; n++) setTimeout(() => flyInsect(layer), n * 1800);
}
// A point on the smooth curve (Catmull-Rom) through the points, for t from 0 to 1.
function curveAt(points, t) {
    const n = points.length - 1, x = Math.min(n - 1e-9, Math.max(0, t * n)), i = Math.floor(x), f = x - i;
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)];
    const cr = (k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f);
    return [cr(0), cr(1)];
}
function flyInsect(layer) {
    const size = layer.getBoundingClientRect().width;
    if (!size) return;
    const bee = Math.random() < 0.35;
    const kind = bee ? "bee" : Math.random() < 0.5 ? "butterfly-a" : "butterfly-b";
    const px = size * (bee ? 0.058 : 0.075);
    const duration = bee ? 2300 + Math.random() * 1100 : 9000 + Math.random() * 4000;
    const rnd = () => Math.random();
    // from a random edge to the opposite one: a bee darts almost straight, a butterfly wanders in wide, slow curves
    const side = Math.floor(rnd() * 4);
    const edge = (s, v) => [[-px, v * size], [size + px, v * size], [v * size, -px], [v * size, size + px]][s];
    const a = edge(side, rnd() * 0.8 + 0.1), b = edge(side ^ 1, rnd() * 0.8 + 0.1);
    const controls = [a], count = bee ? 3 : 5, wander = bee ? 0.22 : 0.5;
    for (let k = 1; k <= count; k++) {
        const f = k / (count + 1);
        controls.push([a[0] + (b[0] - a[0]) * f + (rnd() - 0.5) * size * wander, a[1] + (b[1] - a[1]) * f + (rnd() - 0.5) * size * wander]);
    }
    controls.push(b);
    const phase = rnd() * 6.28, phase2 = rnd() * 6.28;
    const frames = Math.round(duration / 70);
    const pos = [], head = [];
    for (let k = 0; k <= frames; k++) {
        const t = k / frames;
        // a butterfly beats and glides: its progress speeds up and slows down; a bee buzzes (a quick small tremble)
        const progress = bee ? t : Math.min(1, Math.max(0, t + 0.011 * Math.sin(phase + t * (duration / 1000) * 5.6)));
        const [x, y] = curveAt(controls, progress);
        const ahead = curveAt(controls, Math.min(1, progress + 0.01)), behind = curveAt(controls, Math.max(0, progress - 0.01));
        const dx = ahead[0] - behind[0], dy = ahead[1] - behind[1], len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len; // across the path
        const wave = phase + t * (duration / 1000) * 5.6 + 1.2;
        const bob = bee ? size * 0.006 * Math.sin(phase + t * duration / 1000 * 38) + size * 0.004 * Math.sin(phase2 + t * duration / 1000 * 23)
            : size * 0.03 * Math.sin(wave);
        pos.push([x + nx * bob, y + ny * bob]);
        // it faces where the path goes (not the bobbing), and a butterfly banks a little with each beat
        head.push((Math.atan2(dy, dx) * 180) / Math.PI + 90 + (bee ? 0 : 11 * Math.cos(wave)));
    }
    let angle = head[0];
    const steps = pos.map((p, k) => {
        angle += ((((head[k] - angle) % 360) + 540) % 360 - 180) * (bee ? 0.5 : 0.35);
        const edgeFade = k < 4 ? k / 4 : k > frames - 4 ? (frames - k) / 4 : 1;
        return { offset: k / frames, opacity: edgeFade, transform: `translate(${p[0] - px / 2}px, ${p[1] - px / 2}px) rotate(${angle}deg)` };
    });
    const fly = document.createElement("div");
    fly.className = "fly" + (bee ? " bee" : "");
    fly.style.width = fly.style.height = px + "px";
    fly.style.setProperty("--flap", (bee ? 0.05 + rnd() * 0.02 : 0.26 + rnd() * 0.16) + "s");
    fly.style.setProperty("--flap-to", bee ? 0.5 : 0.25 + rnd() * 0.15);
    const wings = document.createElement("i");
    wings.style.backgroundImage = `url("${new URL(`fly-${kind}.svg`, import.meta.url).pathname}")`;
    fly.append(wings);
    layer.append(fly);
    fly.animate(steps, { duration, easing: "linear" }).onfinish = () => fly.remove();
}

export default {
    skin: "spring",
    mount(c) {
        ctx = c;
        buildFlowers();
        ctx.every(40000, 80000, gustOnce, { first: 7000 + Math.random() * 5000 });
        ctx.layer(ctx.grid, "div", "board-fly");
        ctx.every(7000, 17000, flyOnce, { first: 3500 + Math.random() * 3000 });
    },
    unmount() {
        ctx?.stop();
        document.querySelectorAll(".board-flowers, .board-fly").forEach((el) => el.remove());
        blooms = [];
        ctx = null;
    },
};
