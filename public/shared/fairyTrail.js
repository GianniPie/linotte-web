// "Fairy trail" — the sparkle effect that plays over a newly-completed
// 3-in-a-row: a big glowing head travels along the line's three tiles,
// throwing off a dense trail of sparkles and 4-point stars behind it, plus
// a radial burst at every tile it passes through. Everything then falls
// under a light gravity and fades out. Pure canvas + rAF, no dependencies,
// so it works the same for the human player's placements and the bot's,
// and several lines can play at once (e.g. a placement that completes both
// a row and a column) without competing animation loops.
//
// Usage: playFairyTrail([[r1,c1],[r2,c2],[r3,c3]]) — cells in order from
// one end of the line to the other (the head travels cell1 -> cell2 ->
// cell3). Looks up each tile's on-screen position itself (ids "t"+r+c,
// matching index.html), so it stays correct across any board layout,
// board skin, or window resize.

let canvas = null;
let ctx = null;
let dpr = 1;
let rafId = null;

let particles = []; // falling/fading sparks + stars, independent of any one trail
let heads = []; // active traveling heads, one per in-progress trail

// All spread/size numbers below are FRACTIONS OF TILE SIZE, not px -- a
// board is ~130px per tile on a desktop window (where this was originally
// tuned) but can be well under half that on a phone, and a burst sized in
// fixed px looks tiny on one and comically oversized on the other. tick()
// resolves these to actual px per head via `activeTileSize` (set from that
// head's own on-screen tile size, see cellCenter) right before spawning,
// so the same tunables produce a proportionally identical-looking effect
// on any screen. Only per-head TIME values (travelMs, emitStep) and
// genuinely tile-relative ones already (burstMinRFactor) are exempt.
let activeTileSize = 100; // fallback only; tick() always sets this before spawning

// A caller (e.g. fairy-playground.html) can live-tune these via
// setTunables() -- new values take effect on the next playFairyTrail() call
// (a head already in flight keeps the travelMs/emitStep it was launched
// with, so it doesn't jump mid-animation). These defaults were tuned live
// in fairy-playground.html (on a desktop-sized board, ~130px/tile) and
// converted from that session's px values to tile-size fractions here;
// real gameplay (linotte.js) never calls setTunables itself.
export const tunables = {
  // ms per SEGMENT (the gap between two consecutive cells), not for the
  // whole line -- a head's actual travelMs (see playFairyTrail) is this
  // times the line's segment count, so a 5-cell line (4 segments) takes
  // twice as long start-to-end as a 3-cell line (2 segments) instead of
  // covering twice the distance in the same fixed time and looking rushed.
  // 160 here reproduces the old fixed 320ms for the common 3-cell case.
  travelMsPerSegment: 160,
  emitStep: 0.01, // travel-progress fraction between each trail emission batch
  emitOrbCount: 2, // orbs spawned per trail emission batch
  emitStarCount: 5, // stars spawned per trail emission batch
  emitSpread: 0.23, // x tile size = spawn jitter radius for trail-emission particles

  burstCount: 30, // particles in the radial burst at each of the 3 waypoints
  burstSpread: 0.13, // x tile size = spawn jitter radius (on top of burstMinRFactor) for the burst
  burstMinRFactor: 0.5, // x tile size = inner radius so the burst starts past the opaque piece

  orbLifeMin: 1200, orbLifeMax: 2000, // ms
  orbSizeMin: 0.015, orbSizeMax: 0.05, // x tile size
  orbGravityMin: 0.0022, orbGravityMax: 0.0034,

  starLifeMin: 650, starLifeMax: 2000, // ms
  starSizeMin: 0.027, starSizeMax: 0.104, // x tile size
  starGravityMin: 0.002, starGravityMax: 0.0032,

  flashLifeMin: 380, flashLifeMax: 550, // ms, the one bright "core" particle per burst
  flashSizeMin: 0.046, flashSizeMax: 0.077, // x tile size

  glintLife: 220, // ms, the white glow dot emitted alongside every trail batch
  glowBlur: 0.17, // x tile size = shadowBlur on glow particles only (see tick()'s perf note)
};

export function setTunables(partial) {
  Object.assign(tunables, partial);
}

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  // Sits above the plain (non-positioned) tile background/art, but below
  // the piece tokens themselves (see .piece's z-index:2 in linotte.css) --
  // so the burst plays underneath whichever piece just landed instead of
  // covering it.
  canvas.style.zIndex = "1";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function cellCenter(r, c) {
  const el = document.getElementById(`t${r}${c}`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: Math.min(rect.width, rect.height) };
}

// Warm gold/white core plus cool pink/lilac/sky accents — a proper magic
// fairy-dust palette instead of a single hue.
const SPARK_COLORS = [
  "#fff6c8", "#ffe27a", "#ffd24d", "#ffffff", "#ffb84d",
  "#ff9ee6", "#c9a8ff", "#8fe3ff", "#fff0ff",
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// Spawn position is polar (angle + radius in [minR, minR+spread]) rather
// than a square jitter, so a caller can push the whole spawn ring outward
// past some fixed inner radius -- see burstAt, which uses this to start
// particles already clear of the opaque piece token they'd otherwise spawn
// directly behind.
function spawnOrb(x, y, spread, big, minR = 0) {
  const angle = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * spread;
  const speed = big ? rand(0.05, 0.35) : rand(0.05, 0.7);
  particles.push({
    kind: "orb",
    x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - rand(0.05, 0.25),
    size: (big ? rand(tunables.flashSizeMin, tunables.flashSizeMax) : rand(tunables.orbSizeMin, tunables.orbSizeMax)) * activeTileSize,
    color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
    born: performance.now(),
    life: big ? rand(tunables.flashLifeMin, tunables.flashLifeMax) : rand(tunables.orbLifeMin, tunables.orbLifeMax),
    gravity: big ? 0.0014 : rand(tunables.orbGravityMin, tunables.orbGravityMax),
    spin: 0,
    twinkle: Math.random() * Math.PI * 2,
  });
}

function spawnStar(x, y, spread, minR = 0) {
  const angle = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * spread;
  const speed = rand(0.1, 0.9);
  particles.push({
    kind: "star",
    x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - rand(0.1, 0.3),
    size: rand(tunables.starSizeMin, tunables.starSizeMax) * activeTileSize,
    color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
    born: performance.now(),
    life: rand(tunables.starLifeMin, tunables.starLifeMax),
    gravity: rand(tunables.starGravityMin, tunables.starGravityMax),
    spin: rand(-0.01, 0.01),
    rot: Math.random() * Math.PI,
    twinkle: Math.random() * Math.PI * 2,
  });
}

function spawnHeadGlint(x, y) {
  particles.push({
    kind: "orb",
    x, y,
    vx: rand(-0.05, 0.05),
    vy: -0.02,
    size: rand(0.054, 0.092) * activeTileSize,
    color: "#ffffff",
    born: performance.now(),
    life: tunables.glintLife,
    gravity: 0,
    glow: true,
    glowBlurPx: tunables.glowBlur * activeTileSize,
    spin: 0,
    twinkle: 0,
  });
}

// A big radial firework-style burst, used at each tile the head visits.
// This plays UNDER the now-opaque piece that just landed there (see canvas
// z-index note in ensureCanvas), so every particle is spawned with minR
// pushing it past the piece's own on-screen radius -- starting a burst
// centered on the piece but ringed just outside it, instead of hidden
// directly beneath it until its own outward velocity (if any, for the
// short-lived ones it may never be enough in time) carries it clear.
function burstAt(x, y, pieceRadius) {
  const minR = pieceRadius || 0;
  const spread = tunables.burstSpread * activeTileSize;
  for (let i = 0; i < tunables.burstCount; i++) {
    if (i % 2 === 0) spawnStar(x, y, spread, minR);
    else spawnOrb(x, y, spread, false, minR);
  }
  spawnOrb(x, y, 0, true, minR); // one bright flash core, still just outside the piece
}

function drawStar(cx, cy, outerR, innerR, rot) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = rot + (Math.PI / 4) * i;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function startLoopIfNeeded() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}

// Pixel position of a head at travel-progress tt (0..1), following the
// same clamped-segment math tick() uses for the live head position.
function pointAtProgress(h, tt) {
  const segCount = h.points.length - 1;
  const segT = tt * segCount;
  const segIdx = Math.min(Math.floor(segT), Math.max(segCount - 1, 0));
  const localT = segT - segIdx;
  const p0 = h.points[segIdx];
  const p1 = h.points[Math.min(segIdx + 1, h.points.length - 1)];
  return { x: p0.x + (p1.x - p0.x) * localT, y: p0.y + (p1.y - p0.y) * localT };
}

function tick(now) {
  // Collected instead of called from inside the heads.filter() predicate
  // below, and fired only once `heads` has actually been reassigned to
  // the filtered array (see the very end of this function). A caller's
  // onDone commonly starts the NEXT line by calling playFairyTrail() again
  // (see playLinesSequentially() in linotte.js) -- which pushes a new head
  // onto the CURRENT `heads` array. Doing that synchronously from inside
  // the filter predicate pushes onto the array filter() is iterating, but
  // that new head is never visited by this already-in-progress pass (a
  // JS array's length for .filter() is captured up front) and then
  // vanishes entirely the moment `heads = heads.filter(...)` completes and
  // overwrites the module binding with a result that never included it --
  // silently dropping every chained line after the first.
  const finishedCallbacks = [];
  // Advance every active traveling head, emitting a dense trail as it
  // goes and a big burst whenever it crosses a waypoint (one of the 3
  // cells) for the first time.
  heads = heads.filter((h) => {
    // Clamped on BOTH ends: a freshly-scheduled requestAnimationFrame's
    // timestamp is occasionally a hair earlier than a performance.now()
    // captured moments before in the same synchronous call that started
    // this head (the two clocks aren't guaranteed strictly ordered across
    // that boundary) -- an unclamped lower bound let `t` go slightly
    // negative on that first frame, producing a negative segIdx and an
    // out-of-bounds (undefined) point lookup below.
    const t = Math.max(0, Math.min(1, (now - h.start) / h.travelMs));
    const segCount = h.points.length - 1;
    const segT = t * segCount;
    const { x: headX, y: headY } = pointAtProgress(h, t);
    // Every spawn call below reads tunables as fractions of tile size (see
    // the tunables comment) and resolves them against THIS head's own
    // on-screen tile size, so the effect looks proportionally the same on
    // a phone's small board as on a wide desktop one.
    activeTileSize = h.tileSize;

    // Fire a burst -- and let the caller know (so it can make that
    // tile's piece hop, see linotte.js) -- the first time the head
    // reaches (or starts at) each waypoint cell.
    const waypointIdx = Math.round(segT);
    if (waypointIdx !== h.lastWaypoint && waypointIdx < h.points.length) {
      h.lastWaypoint = waypointIdx;
      const wp = h.points[waypointIdx];
      burstAt(wp.x, wp.y, wp.size * tunables.burstMinRFactor);
      if (h.onWaypoint) h.onWaypoint(h.cells[waypointIdx], waypointIdx);
    }

    // Catch up on every emission step the progress has crossed since the
    // last tick (usually just one, at a steady frame rate). Emitting on
    // PROGRESS instead of wall-clock time keeps the total spark count for
    // a trail constant no matter the actual frame rate -- if frames are
    // skipped or coalesced (a throttled background tab, a slow device),
    // this just catches up by emitting every step it skipped in one pass,
    // instead of silently emitting fewer sparks overall.
    while (h.lastEmitT + h.emitStep <= t) {
      h.lastEmitT += h.emitStep;
      const { x: ex, y: ey } = pointAtProgress(h, h.lastEmitT);
      const emitSpreadPx = tunables.emitSpread * activeTileSize;
      for (let i = 0; i < tunables.emitOrbCount; i++) spawnOrb(ex, ey, emitSpreadPx, false);
      for (let i = 0; i < tunables.emitStarCount; i++) spawnStar(ex, ey, emitSpreadPx * 0.85);
      spawnHeadGlint(ex, ey);
    }

    if (t >= 1) {
      if (h.onDone) finishedCallbacks.push(h.onDone);
      return false; // this head's travel is done; its sparks live on in `particles`
    }
    return true;
  });

  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  // shadowBlur is a real cost per shape (the browser re-blurs on every
  // draw) -- with a few hundred particles on screen at once it was enough
  // to drop frames and make everything on the page look janky, including
  // unrelated CSS animations like the piece jump. Only the rare, one-per-
  // emission "glow" head-glint pays for it now; the many small trail
  // sparks/stars just get a plain, fast fill.
  particles = particles.filter((p) => {
    const age = now - p.born;
    if (age > p.life) return false;
    p.vy += p.gravity * 16;
    p.x += p.vx * 16;
    p.y += p.vy * 16;
    if (p.rot !== undefined) p.rot += p.spin * 16;
    const lifeT = age / p.life;
    const twinkle = p.twinkle ? 0.7 + 0.3 * Math.sin(age * 0.02 + p.twinkle) : 1;
    const alpha = Math.max(0, (1 - lifeT) * twinkle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.glow) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.glowBlurPx;
    } else {
      ctx.shadowBlur = 0;
    }
    const size = Math.max(0.1, p.size * (1 - lifeT * 0.35));
    if (p.kind === "star") {
      drawStar(p.x, p.y, size, size * 0.42, p.rot || 0);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    return true;
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  if (heads.length > 0 || particles.length > 0) {
    rafId = requestAnimationFrame(tick);
  } else {
    rafId = null;
  }

  // Now safe: `heads` is the real, settled array, so a callback that
  // pushes a new head via playFairyTrail() (directly, or indirectly by
  // scheduling startLoopIfNeeded()) lands correctly, whether or not this
  // tick already scheduled the next frame above.
  finishedCallbacks.forEach((cb) => cb());
}

// cells: [[r,c], [r,c], [r,c]] in order along the line.
// options.onDone: fired once this trail's head finishes traveling (sparks
// it already emitted keep falling/fading independently after that).
// options.onWaypoint(cell, index): fired the instant the head reaches
// each of the 3 cells in turn -- e.g. to make that tile's piece hop right
// as the spark arrives at it (see linotte.js).
//
// A cells entry is normally a [r, c] board coordinate, resolved against
// its tile's live position via cellCenter -- but it can also be a literal
// {x, y, size} point instead, for a trail that travels off the board
// entirely (e.g. from the last board cell onward to some UI element's
// on-screen position; see linotte.js's celebratePoints).
//
// options.travelMs overrides the usual per-segment-count duration (see
// tunables.travelMsPerSegment) -- meant for exactly that off-board case,
// where "number of board tiles crossed" no longer means anything and the
// caller knows better how long that hop should visually take.
export function playFairyTrail(cells, options) {
  if (!Array.isArray(cells) || cells.length < 2) return;
  const { onDone, onWaypoint, travelMs } = options || {};
  ensureCanvas();
  const points = cells.map((cell) => (Array.isArray(cell) ? cellCenter(cell[0], cell[1]) : cell)).filter(Boolean);
  if (points.length < 2) return;
  const tileSize = points.reduce((sum, p) => sum + p.size, 0) / points.length;

  heads.push({
    points,
    cells,
    tileSize,
    start: performance.now(),
    travelMs: travelMs ?? (tunables.travelMsPerSegment * (points.length - 1)),
    emitStep: tunables.emitStep,
    lastEmitT: 0,
    lastWaypoint: -1,
    onDone,
    onWaypoint,
  });
  startLoopIfNeeded();
}
