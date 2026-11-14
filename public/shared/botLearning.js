// Learning for the "speed" bot's placement, from the corrections made in the
// bot lab (public/botlab.html). Pure functions, used by the lab page, the
// server and the tests alike.
//
// A case is one decision the bot made and what a person said about it:
//   { candidates: labCandidates(...), correct: "23" }
// `correct` is the cell the piece should have gone to (the bot's own pick for
// a validated turn).
//
// The bot ranks the cells that can compete (same hard tier, see hardTier)
// by a weighted sum of a few signals (see speedFeatures). Training starts
// from the weights that copy the bot's built-in ladder and nudges them, case
// by case, just enough for the cell the person chose to come out first
// (passive-aggressive updates, a few passes over all the cases). It cannot
// fix a choice the bot's filters throw out before ranking (a "dead" cell, or
// a low-priority one while a better-behaved one is available) or one in a
// lower hard tier than a competitor (not blocking an urgent threat): those
// come back as "filtered" and "tier" in the report.

import {
  SPEED_PRIOR, SPEED_FEATURES, speedFeatures, hardTier, pickSpeedPlacement,
  AIM_PRIOR, aimFeatures, pickTarget, CALL_PRIOR, callFeatures, pickCall, STOP_PRIOR,
} from "./botAI.js";

const MARGIN = 1; // the chosen cell must win by this much of the weighted score
const EPOCHS = 40;

// The cells that really compete with `correct`: usable, in the preferred pool
// if there is one, and in its hard tier. null: the cell can't be learned.
function competitors(candidates, correct) {
  const target = candidates.find((c) => c.rc === correct);
  if (!target) return { status: "missing" };
  if (target.tag === "dead") return { status: "filtered" };
  const usable = candidates.filter((c) => c.tag !== "dead");
  const preferred = usable.filter((c) => c.tag === "preferred");
  const pool = preferred.length ? preferred : usable;
  if (!pool.includes(target)) return { status: "filtered" };
  // a cell of a higher hard tier would always come first, whatever the weights
  const better = pool.some((c) => compareTiers(c, target) < 0);
  if (better) return { status: "tier" };
  return { status: "ok", target, others: pool.filter((c) => c !== target && hardTier(c) === hardTier(target)) };
}

// Same order as compareSpeed's first four lines: win, no loss, critical, urgent.
function compareTiers(a, b) {
  if (a.wouldWinGame !== b.wouldWinGame) return a.wouldWinGame ? -1 : 1;
  if (a.wouldLoseGame !== b.wouldLoseGame) return a.wouldLoseGame ? 1 : -1;
  if (a.criticalBlock !== b.criticalBlock) return a.criticalBlock ? -1 : 1;
  if (a.urgentBlock !== b.urgentBlock) return a.urgentBlock ? -1 : 1;
  return 0;
}

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

export function trainSpeedWeights(cases, { epochs = EPOCHS } = {}) {
  const usable = [];
  const report = cases.map((c) => {
    const info = competitors(c.candidates, c.correct);
    if (info.status === "ok") usable.push({ ...info, id: c.id });
    return { id: c.id, status: info.status === "ok" ? "learnable" : info.status };
  });

  const w = SPEED_PRIOR.slice();
  for (let e = 0; e < epochs; e++) {
    let changed = false;
    for (const u of usable) {
      const fp = speedFeatures(u.target);
      for (const q of u.others) {
        const d = fp.map((x, i) => x - speedFeatures(q)[i]);
        const loss = MARGIN - dot(w, d);
        if (loss <= 0) continue;
        const norm = dot(d, d);
        if (norm === 0) continue;
        const step = loss / norm;
        for (let i = 0; i < w.length; i++) w[i] = Math.max(0, w[i] + step * d[i]);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Which cases the weights now get right
  let agree = 0;
  for (const r of report) {
    const c = cases.find((x) => x.id === r.id);
    const pick = pickSpeedPlacement(c.candidates, w);
    r.picks = pick ? pick.rc : null;
    r.agrees = pick?.rc === c.correct;
    if (r.agrees) agree++;
    if (r.status === "learnable") r.status = r.agrees ? "learned" : "conflict";
  }
  return { weights: w, report, agreement: cases.length ? agree / cases.length : 1, features: SPEED_FEATURES };
}

// ---------------------------------------------------------------------------
// The three decisions taken while the dice are in the air. Same recipe as the
// placement (start from the built-in behaviour, nudge just enough, a few passes
// over every case), only the signals differ — see AIM_PRIOR, CALL_PRIOR,
// STOP_PRIOR in botAI.js.
//
//   aim  case: { id, options: [{combo, cellWeight, probability, ...}], correct: "carre" }
//   call case: { id, options: [{combo, eligible, score, probability}], correct: "full" | "none" }
//   stop case: { id, x: [signals], correct: "stop" | "roll" }
// ---------------------------------------------------------------------------

// Pairwise passive-aggressive ranking: `win` must score at least `margin` above each of `lose`.
function fitRanking(items, prior, { margin, epochs = EPOCHS, floor = null, ceil = null, rates = null }) {
  const w = prior.slice();
  for (let e = 0; e < epochs; e++) {
    let changed = false;
    for (const it of items) {
      for (const other of it.lose) {
        const d = it.win.map((x, i) => x - other[i]);
        const loss = margin - dot(w, d);
        if (loss <= 0) continue;
        // `rates` makes the general weights (value, chance) stiff and the tastes for a
        // single combo supple: a correction mostly becomes "I prefer this one here".
        const rate = (i) => (rates ? rates[i] : 1);
        const norm = d.reduce((n, x, i) => n + rate(i) * x * x, 0);
        if (norm === 0) continue;
        const step = loss / norm;
        for (let i = 0; i < w.length; i++) {
          let v = w[i] + step * rate(i) * d[i];
          if (floor && floor[i] !== null && v < floor[i]) v = floor[i];
          if (ceil && ceil[i] !== null && v > ceil[i]) v = ceil[i];
          w[i] = v;
        }
        changed = true;
      }
    }
    if (!changed) break;
  }
  return w;
}

export function trainAim(cases) {
  const items = [];
  const report = cases.map((c) => {
    // a keep (which dice to hold) can be reached through several combos that hold
    // the same dice: then any of them is right, and the likeliest is the one taught
    const right = Array.isArray(c.correct) ? c.correct : [c.correct];
    const targets = c.options.filter((o) => right.includes(o.combo));
    const kind = c.kind || "aim";
    if (!targets.length) return { id: c.id, kind, status: Array.isArray(c.correct) ? "unreachable" : "missing" };
    const target = targets.reduce((best, o) => (o.value > best.value ? o : best));
    items.push({ id: c.id, win: aimFeatures(target), lose: c.options.filter((o) => !targets.includes(o)).map(aimFeatures) });
    return { id: c.id, kind, status: "learnable" };
  });
  if (!items.length) return { weights: null, report, agreement: report.some((r) => r.status === "unreachable" || r.status === "missing") ? 0 : 1 };
  // the weights on value and on chance stay positive; a taste for a combo is capped
  const floor = AIM_PRIOR.map((_, i) => (i < 2 ? 0 : -6));
  const ceil = AIM_PRIOR.map((_, i) => (i < 2 ? null : 6));
  const weights = fitRanking(items, AIM_PRIOR, { margin: 0.5, floor, ceil, rates: AIM_PRIOR.map((_, i) => (i < 2 ? 0.05 : 1)) });
  return settle(report, cases, weights, (c) => pickTarget(c.options.map((o) => ({ ...o, comboKey: o.combo, attractiveness: o.value })), weights).comboKey);
}

export function trainCall(cases) {
  const items = [];
  const report = cases.map((c) => {
    const none = { combo: "none", score: 0, probability: 0 };
    const pool = c.options.filter((o) => o.eligible || o.soft).concat([none]);
    const target = pool.find((o) => o.combo === c.correct);
    if (!target) return { id: c.id, kind: "call", status: "filtered" };
    items.push({ id: c.id, win: callFeatures(target), lose: pool.filter((o) => o !== target).map(callFeatures) });
    return { id: c.id, kind: "call", status: "learnable" };
  });
  if (!items.length) return { weights: null, report, agreement: report.length ? 0 : 1 };
  const last = CALL_PRIOR.length - 1;
  const floor = CALL_PRIOR.map((_, i) => (i < 2 ? 0 : i === last ? -20 : -6));
  const ceil = CALL_PRIOR.map((_, i) => (i < 2 ? null : i === last ? 2 : 6));
  const weights = fitRanking(items, CALL_PRIOR, { margin: 0.5, floor, ceil, rates: CALL_PRIOR.map((_, i) => (i < 2 ? 0.05 : i === last ? 3 : 0.3)) });
  return settle(report, cases, weights, (c) => pickCall(c.options, weights) ?? "none");
}

export function trainStop(cases) {
  const report = cases.map((c) => ({ id: c.id, kind: "stop", status: "learnable" }));
  const w = STOP_PRIOR.slice();
  for (let e = 0; e < EPOCHS; e++) {
    let changed = false;
    for (const c of cases) {
      const y = c.correct === "stop" ? 1 : -1;
      const loss = MARGIN - y * dot(w, c.x);
      if (loss <= 0) continue;
      // what the built-in rules said is trusted most: the correction goes mostly to the other signals
      const rate = (i) => (i === 0 ? 0.1 : 1);
      const norm = c.x.reduce((n, x, i) => n + rate(i) * x * x, 0);
      if (norm === 0) continue;
      const step = loss / norm;
      for (let i = 0; i < w.length; i++) w[i] += y * step * rate(i) * c.x[i];
      changed = true;
    }
    if (!changed) break;
  }
  return settle(report, cases, w, (c) => (dot(w, c.x) > 0 ? "stop" : "roll"));
}

function settle(report, cases, weights, pick) {
  let agree = 0;
  for (const r of report) {
    const c = cases.find((x) => x.id === r.id);
    r.picks = pick(c);
    r.agrees = Array.isArray(c.correct) ? c.correct.includes(r.picks) : r.picks === c.correct;
    if (r.agrees) agree++;
    if (r.status === "learnable") r.status = r.agrees ? "learned" : "conflict";
  }
  return { weights, report, agreement: cases.length ? agree / cases.length : 1 };
}

// Every review the lab holds -> the weights for the phone and a report. A case
// without a kind is a placement (the first kind there was).
export function trainAll(cases) {
  const of = (kind) => cases.filter((c) => (c.kind || "place") === kind);
  const run = (kind, train) => {
    const mine = of(kind);
    return mine.length ? { result: train(mine), n: mine.length } : null;
  };
  const placement = run("place", (m) => trainSpeedWeights(m.map((c) => ({ id: c.id, candidates: c.candidates, correct: c.correct }))));
  // a keep is an aim in disguise: the combos that would keep exactly these dice are all right
  const aimCases = of("aim").map((c) => ({ id: c.id, kind: "aim", options: c.candidates, correct: c.correct }))
    .concat(of("lock").map((c) => ({ id: c.id, kind: "lock", options: c.candidates, correct: c.candidates.filter((o) => o.mask === c.correct).map((o) => o.combo) })));
  const aim = aimCases.length ? { result: trainAim(aimCases), n: aimCases.length } : null;
  const call = run("call", (m) => trainCall(m.map((c) => ({ id: c.id, options: c.candidates, correct: c.correct }))));
  const stop = run("stop", (m) => trainStop(m.map((c) => ({ id: c.id, x: c.x, correct: c.correct }))));
  const parts = [placement, aim, call, stop].filter(Boolean);
  if (placement) for (const r of placement.result.report) r.kind = "place";
  const agreeing = parts.reduce((sum, p) => sum + p.result.agreement * p.n, 0);
  return {
    weights: placement ? placement.result.weights : null,
    aim: aim ? aim.result.weights : null,
    call: call ? call.result.weights : null,
    stop: stop ? stop.result.weights : null,
    report: parts.flatMap((p) => p.result.report),
    agreement: cases.length ? agreeing / cases.length : 1,
  };
}
