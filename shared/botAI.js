// Bot AI for Linotte — pure decision functions.
// These take game state and return decisions only; they never touch the
// DOM or dispatch actions themselves. That's left to whoever orchestrates
// the bot's turn (currently public/linotte.js), so this file can also be
// reused server-side later without changes.
//
// ---------------------------------------------------------------------
// Shared rules for BOTH strategies, in priority order, for every cell
// the bot considers placing on:
//   1. Does it realize a point (complete a 3/4/5-in-a-row)?
//   2. Is the tile itself rarer/harder to roll (see boardProbabilities)?
//   3. Does it block the opponent (sits in a line they're building)?
//   4. General bias: place close to the bot's own existing pieces.
//
// The ONLY difference between the two named strategies:
//   - "speed" races to complete an actual 5-in-a-row as fast as possible
//     (that's how you can win/end the game immediately).
//   - "points" tries to accumulate as many total points as possible
//     before the game ends, so it avoids rushing into a 5-in-a-row while
//     there's still plenty of board/pieces left to score with instead.
// ---------------------------------------------------------------------

import { tile } from "../shared/utils.js";

export const STRATEGIES = ["points", "speed"];

// Every combo type mapped to its fixed board cell(s), as "rc" strings.
const COMBO_CELLS = {
  brelan1: [tile.b11, tile.b12],
  brelan2: [tile.b21, tile.b22],
  brelan3: [tile.b31, tile.b32],
  brelan4: [tile.b41, tile.b42],
  brelan5: [tile.b51, tile.b52],
  brelan6: [tile.b61, tile.b62],
  full: [tile.fu1, tile.fu2],
  carre: [tile.ca1, tile.ca2],
  petit: [tile.pe1, tile.pe2],
  suite: [tile.su1, tile.su2],
  yam: [tile.yam],
  sec: [tile.se1, tile.se2],
  appel: [tile.ap1, tile.ap2],
};

// Probability (%) of each board cell coming up at all in a throw of 5
// dice — a 5x5 matrix in row-major order, matching the board layout.
// Lower = rarer/harder to get = more valuable to grab when it appears.
const boardProbabilities = [
  35.48, 35.48, 0.00, 35.48, 35.48,
  35.48, 29.08, 9.21, 36.29, 35.48,
  18.69, 36.29, 4.60, 0.00, 26.11,
  35.48, 9.21, 26.11, 18.69, 35.48,
  35.48, 35.48, 29.08, 35.48, 35.48,
];

function probabilityAt(r, c) {
  return boardProbabilities[r * 5 + c];
}

function faceCounts(diceValues) {
  const counts = [0, 0, 0, 0, 0, 0, 0]; // index 1..6
  diceValues.forEach((v) => counts[v]++);
  return counts;
}

// Which distinct values `diceValues` already covers from whichever
// straight (1-5 or 2-6) it's closer to completing. A straight needs the
// full SET of 5 specific values, not a contiguous run rolled out in
// order — a die showing 2 is exactly as worth keeping as one showing 5
// even with 3 and 4 still missing, since the gap gets filled by
// rerolling the *other* dice, not by these being adjacent.
function bestStraightMatch(diceValues) {
  const present = new Set(diceValues);
  const runs = [
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 6],
  ];
  let best = [];
  for (const run of runs) {
    const have = run.filter((v) => present.has(v));
    if (have.length > best.length) best = have;
  }
  return best;
}

// ---------- Core board evaluation (shared by both strategies) ----------

// Total point count on the board for a player, using the same "any
// 3-length window fully theirs" rule the real scoring uses.
function totalPoints(table, player) {
  const flat = table.flat();
  let points = 0;
  const mark = String(player).repeat(3);

  for (let y = 0; y < 25; y += 5) {
    for (let x = 0; x < 3; x++) {
      if ([flat[y + x], flat[y + x + 1], flat[y + x + 2]].join("") === mark) points++;
    }
  }
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 25; y += 5) {
      if ([flat[y + x], flat[y + x + 5], flat[y + x + 10]].join("") === mark) points++;
    }
  }
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 15; y += 5) {
      if ([flat[y + x], flat[y + x + 6], flat[y + x + 12]].join("") === mark) points++;
    }
  }
  for (let x = 2; x < 5; x++) {
    for (let y = 0; y < 15; y += 5) {
      if ([flat[y + x], flat[y + x + 4], flat[y + x + 8]].join("") === mark) points++;
    }
  }
  return points;
}

function hasFiveInARow(table, player) {
  const flat = table.flat();
  const mark = String(player).repeat(5);
  for (let i = 0; i < 25; i += 5) {
    if ([flat[i], flat[i + 1], flat[i + 2], flat[i + 3], flat[i + 4]].join("") === mark) return true;
  }
  for (let i = 0; i < 5; i++) {
    if ([flat[i], flat[i + 5], flat[i + 10], flat[i + 15], flat[i + 20]].join("") === mark) return true;
  }
  if ([flat[0], flat[6], flat[12], flat[18], flat[24]].join("") === mark) return true;
  if ([flat[4], flat[8], flat[12], flat[16], flat[20]].join("") === mark) return true;
  return false;
}

// Longest run of consecutive same-player cells through (r,c), across
// all 4 directions, AFTER placing there. Used by "speed" to measure
// progress toward an actual 5-in-a-row.
function longestLineThrough(table, r, c, player) {
  const original = table[r][c];
  table[r][c] = player;

  const lines = [];
  lines.push([[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]]); // row
  lines.push([[0, c], [1, c], [2, c], [3, c], [4, c]]); // col
  if (r === c) lines.push([0, 1, 2, 3, 4].map((i) => [i, i])); // main diag
  if (r + c === 4) lines.push([0, 1, 2, 3, 4].map((i) => [i, 4 - i])); // anti diag

  let best = 1;
  for (const line of lines) {
    let run = 0;
    let maxRun = 0;
    for (const [rr, cc] of line) {
      if (table[rr][cc] === player) {
        run++;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 0;
      }
    }
    best = Math.max(best, maxRun);
  }

  table[r][c] = original;
  return best;
}

function countInLine(table, r, c, player, direction) {
  let count = 0;
  if (direction === "row") {
    for (let cc = 0; cc < 5; cc++) if (cc !== c && table[r][cc] === player) count++;
  } else if (direction === "col") {
    for (let rr = 0; rr < 5; rr++) if (rr !== r && table[rr][c] === player) count++;
  } else if (direction === "diag") {
    if (r === c) {
      for (let i = 0; i < 5; i++) if (i !== r && table[i][i] === player) count++;
    }
    if (r + c === 4) {
      for (let i = 0; i < 5; i++) if (i !== r && table[i][4 - i] === player) count++;
    }
  }
  return count;
}

// Does this empty cell sit as the sole remaining gap in a row/col/diag
// where the opponent already holds every other cell — i.e. one placement
// away from their own 5-in-a-row. Used to make "speed" block urgently
// instead of treating this like any other opponent-occupied line.
function blocksOpponentFour(table, r, c, opponent) {
  const lines = [];
  lines.push([[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]]);
  lines.push([[0, c], [1, c], [2, c], [3, c], [4, c]]);
  if (r === c) lines.push([0, 1, 2, 3, 4].map((i) => [i, i]));
  if (r + c === 4) lines.push([0, 1, 2, 3, 4].map((i) => [i, 4 - i]));

  return lines.some((line) =>
    line.every(([rr, cc]) => (rr === r && cc === c) || table[rr][cc] === opponent)
  );
}

function countAdjacentOwn(table, r, c, player) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr > 4 || cc < 0 || cc > 4) continue;
      if (table[rr][cc] === player) count++;
    }
  }
  return count;
}

// Does any 3-length window through (r,c), in any direction, still have
// zero opponent pieces in it? If every window through this cell already
// has an opponent piece blocking it, this cell can never be part of a
// completed row/col/diag for this player — a "dead" placement.
function hasFutureLinePotential(table, r, c, player, opponent) {
  const lines = [];
  lines.push({ cells: [0, 1, 2, 3, 4].map((cc) => [r, cc]) }); // row
  lines.push({ cells: [0, 1, 2, 3, 4].map((rr) => [rr, c]) }); // col
  if (r === c) lines.push({ cells: [0, 1, 2, 3, 4].map((i) => [i, i]) });
  if (r + c === 4) lines.push({ cells: [0, 1, 2, 3, 4].map((i) => [i, 4 - i]) });

  for (const { cells } of lines) {
    const idx = cells.findIndex(([rr, cc]) => rr === r && cc === c);
    for (let start = Math.max(0, idx - 2); start <= Math.min(idx, cells.length - 3); start++) {
      const window = cells.slice(start, start + 3);
      const blocked = window.some(([rr, cc]) => table[rr][cc] === opponent);
      if (!blocked) return true;
    }
  }
  return false;
}

// Does (r,c) share a row, column, or (main/anti) diagonal with any of the
// player's existing pieces — i.e. could it still join a line with one of
// them, gap or no gap? This is the same connectivity a piece 2 tiles away
// with an empty cell between has: no immediate 8-neighbor adjacency, but
// a completely real, live line-building move.
function sharesLineWithOwn(table, r, c, player) {
  for (let rr = 0; rr < 5; rr++) {
    for (let cc = 0; cc < 5; cc++) {
      if (table[rr][cc] !== player) continue;
      if (rr === r || cc === c) return true;
      if (r === c && rr === cc) return true;
      if (r + c === 4 && rr + cc === 4) return true;
    }
  }
  return false;
}

// Is this cell disconnected from every row/col/diag the player already
// has a piece on? Only meaningful once the player has an actual cluster
// going (fewer than 3 pieces placed = no real "assembly" to be far from).
function isTooFarFromAssembly(table, r, c, player) {
  const ownPieceCount = table.flat().filter((v) => v === player).length;
  if (ownPieceCount < 3) return false; // too early to judge "far"
  return !sharesLineWithOwn(table, r, c, player);
}

// Should the bot voluntarily decline an available, non-scoring placement?
// Per the shared rules: skip if the tile has no future line potential,
// if it's isolated from the bot's main cluster, or if pieces are scarce
// and this tile isn't even worth much on its own.
function shouldSkipPlacement(state, candidate, player, opponent) {
  if (candidate.pointsGained > 0) return false; // always take a scoring placement

  if (!hasFutureLinePotential(state.table, candidate.r, candidate.c, player, opponent)) return true;
  if (isTooFarFromAssembly(state.table, candidate.r, candidate.c, player)) return true;

  const piecesLeft = state.players[player].remainingPieces;
  // clusterScore only sees immediate 8-neighbor adjacency, so on its own
  // it would wrongly call a piece 2 tiles away (gap in between, same
  // row/col/diag) "low value" — sharesLineWithOwn catches that real
  // connection even without direct adjacency.
  const lowValue =
    candidate.rarity < 65 &&
    candidate.clusterScore === 0 &&
    !sharesLineWithOwn(state.table, candidate.r, candidate.c, player);
  if (piecesLeft <= 3 && lowValue) return true;

  return false;
}

// Point-diff and other per-cell metrics, evaluated via a cheap clone
// (5x5 board, negligible cost) for clarity over cleverness.
function cloneTable(table) {
  return table.map((row) => row.slice());
}

// Would leaving this cell open let the opponent place there next and
// complete their own 5-in-a-row with at least as many points as the bot
// currently has — i.e. would it hand them the win outright? This is a
// stronger, strategy-independent condition than plain urgentBlock (which
// only checks they have 4 in a row here, regardless of who'd end up ahead).
function wouldGiveOpponentTheWin(state, r, c, opponent, botPoints) {
  const trial = cloneTable(state.table);
  trial[r][c] = opponent;
  if (!hasFiveInARow(trial, opponent)) return false;
  return totalPoints(trial, opponent) >= botPoints;
}

function evaluateCandidate(state, r, c, player, opponent, piecesLeftAfter) {
  const before = totalPoints(state.table, player);

  const trial = cloneTable(state.table);
  trial[r][c] = player;
  const after = totalPoints(trial, player);
  const pointsGained = after - before;

  const wouldBeFive = hasFiveInARow(trial, player);
  const longestLineAfter = longestLineThrough(cloneTable(state.table), r, c, player);
  const rarity = 100 - probabilityAt(r, c);
  const blockScore =
    countInLine(state.table, r, c, opponent, "row") +
    countInLine(state.table, r, c, opponent, "col") +
    countInLine(state.table, r, c, opponent, "diag");
  const urgentBlock = blocksOpponentFour(state.table, r, c, opponent);
  const criticalBlock = wouldGiveOpponentTheWin(state, r, c, opponent, before);
  const clusterScore = countAdjacentOwn(state.table, r, c, player);

  return {
    r,
    c,
    pointsGained,
    wouldBeFive,
    longestLineAfter,
    rarity,
    blockScore,
    urgentBlock,
    criticalBlock,
    clusterScore,
    piecesLeftAfter,
  };
}

// Comparator implementing the shared priority ladder: points > rarity >
// blocking > clustering. "avoidEarlyFive" softly discourages POINTS from
// ending the game via 5-in-a-row while there's still plenty of game left.
// criticalBlock overrides all of that: letting the opponent win outright
// is worse than any amount of points optimization, in either strategy.
function comparePoints(a, b) {
  if (a.criticalBlock !== b.criticalBlock) return a.criticalBlock ? -1 : 1;

  const PIECES_LEFT_THRESHOLD = 2;
  const aPenalty = a.wouldBeFive && a.piecesLeftAfter > PIECES_LEFT_THRESHOLD ? 1 : 0;
  const bPenalty = b.wouldBeFive && b.piecesLeftAfter > PIECES_LEFT_THRESHOLD ? 1 : 0;
  const aScore = a.pointsGained - aPenalty;
  const bScore = b.pointsGained - bPenalty;

  if (bScore !== aScore) return bScore - aScore;
  if (b.rarity !== a.rarity) return b.rarity - a.rarity;
  if (b.blockScore !== a.blockScore) return b.blockScore - a.blockScore;
  return b.clusterScore - a.clusterScore;
}

// Comparator for "speed": progress toward 5-in-a-row dominates, then
// falls back to the same shared ladder.
function compareSpeed(a, b) {
  if (a.wouldBeFive !== b.wouldBeFive) return a.wouldBeFive ? -1 : 1; // own win first — the opponent never gets another turn
  if (a.criticalBlock !== b.criticalBlock) return a.criticalBlock ? -1 : 1;
  if (a.urgentBlock !== b.urgentBlock) return a.urgentBlock ? -1 : 1;
  if (b.longestLineAfter !== a.longestLineAfter) return b.longestLineAfter - a.longestLineAfter;
  if (b.pointsGained !== a.pointsGained) return b.pointsGained - a.pointsGained;
  if (b.rarity !== a.rarity) return b.rarity - a.rarity;
  if (b.blockScore !== a.blockScore) return b.blockScore - a.blockScore;
  return b.clusterScore - a.clusterScore;
}

// A single scalar used only to compare *combo targets* while deciding
// which dice to chase (see chooseTarget below) — same priorities, just
// collapsed into weighted terms with big gaps so higher tiers dominate.
function candidateWeight(cand, strategy) {
  if (strategy === "speed") {
    return (
      (cand.wouldBeFive ? 1_000_000 : 0) +
      (cand.criticalBlock ? 900_000 : 0) +
      (cand.urgentBlock ? 400_000 : 0) +
      cand.longestLineAfter * 10_000 +
      cand.pointsGained * 1_000 +
      cand.rarity * 10 +
      cand.blockScore * 3 +
      cand.clusterScore
    );
  }
  const earlyFivePenalty = cand.wouldBeFive && cand.piecesLeftAfter > 2 ? 5_000 : 0;
  return (
    (cand.criticalBlock ? 900_000 : 0) +
    cand.pointsGained * 100_000 -
    earlyFivePenalty +
    cand.rarity * 100 +
    cand.blockScore * 10 +
    cand.clusterScore
  );
}

// ---------- Whether/what to call (appel) ----------
// state.called is indexed the same way as state.combinationsRealized:
// 3=full, 4=carre, 5=petit, 6=suite, 7=yam. Those are the only five
// combinations that can ever be called.
const CALL_INDEX = { full: 3, carre: 4, petit: 5, suite: 6, yam: 7 };

function anyCellFree(table, cells) {
  return cells.some((rc) => rc && table[Number(rc[0])][Number(rc[1])] === 0);
}

// Calling declares intent to chase one of the five main combinations.
// It's always free and, if the called combination is realized on a
// later roll this turn, it also opens the appel tiles (ap1/ap2) as an
// extra placement option on top of the combo's own tiles. Only one
// call can be active at a time, only after the first throw, and never
// with all 5 dice fixed. Returns the call index (3-7), or null to make
// no call / clear the current one.
//
// A combo's own tiles are always placeable once realized regardless of
// any call, so calling only ever adds value in three cases: the combo's
// own tiles are already taken (appel becomes the *only* way to place
// it), the appel tiles sit somewhere urgently needed to block the
// opponent, or the appel tiles simply beat the best own tile available.
// The call does NOT have to match whichever combo the bot is actually
// locking dice toward — that combo's own tiles already cover it, call
// or not, so the call is better spent as a hedge on a *different*
// plausible outcome from the same dice (e.g. locking for full but
// calling carre, so a carre landing instead still has somewhere to go).
export function chooseCallToMake(state, player, strategy) {
  if (state.dice.rollsLeft === 3) return null; // only possible after the first throw
  if (state.dice.locked.every(Boolean)) return null; // not possible to fix 5 dice and call

  const freeAppelCells = COMBO_CELLS.appel.filter(
    (rc) => rc && state.table[Number(rc[0])][Number(rc[1])] === 0
  );
  if (freeAppelCells.length === 0) return null; // nothing left to unlock by calling

  const opponent = player === 1 ? 2 : 1;
  const needed = neededDiceEstimate(state.dice.values);
  const appelRarity = Math.max(
    ...freeAppelCells.map((rc) => 100 - probabilityAt(Number(rc[0]), Number(rc[1])))
  );
  const appelIsUrgentBlock = freeAppelCells.some((rc) =>
    blocksOpponentFour(state.table, Number(rc[0]), Number(rc[1]), opponent)
  );

  let best = null;
  for (const comboKey of Object.keys(CALL_INDEX)) {
    // Not possible to call carre if a carre is already realized this throw.
    if (comboKey === "carre" && state.combinationsRealized[4] === 1) continue;

    // Live chance of this combo actually landing, given the dice truly
    // still free to reroll toward it and the rolls truly left — not the
    // static first-throw table, and not a flat need-vs-rollsLeft cutoff.
    const probability = liveProbability(comboKey, state, needed);
    if (probability <= 0) continue; // no realistic chance from here

    const freeOwnCells = COMBO_CELLS[comboKey].filter(
      (rc) => rc && state.table[Number(rc[0])][Number(rc[1])] === 0
    );
    const ownRarity = freeOwnCells.length
      ? Math.max(...freeOwnCells.map((rc) => 100 - probabilityAt(Number(rc[0]), Number(rc[1]))))
      : -1; // no own tile left at all — the call is the only way this combo could ever be placed

    // Calling only helps when appel beats (or replaces) the best own tile.
    if (ownRarity >= 0 && !appelIsUrgentBlock && appelRarity <= ownRarity) continue;

    const urgencyBonus = appelIsUrgentBlock ? 100_000 : 0;
    const noFallbackBonus = ownRarity < 0 ? 10_000 : 0;
    const score = (urgencyBonus + noFallbackBonus + appelRarity * 10) * probability;

    if (!best || score > best.score) best = { callIndex: CALL_INDEX[comboKey], score };
  }

  return best ? best.callIndex : null;
}

// ---------- Which combo to chase this roll ----------
function chooseTarget(state, player, strategy) {
  const opponent = player === 1 ? 2 : 1;
  const piecesLeftAfter = Math.max(0, state.players[player].remainingPieces - 1);
  const needed = neededDiceEstimate(state.dice.values);

  let best = null;
  for (const comboKey of Object.keys(COMBO_CELLS)) {
    if (comboKey === "appel") continue; // not chaseable via locking (needs the call mechanic)
    if (comboKey === "sec") {
      if (state.dice.locked.some(Boolean)) continue; // any lock already made loses sec for this turn
      // Sec isn't something to build toward across throws — it's only true
      // when a combo lands raw, with nothing locked. Treating it as always
      // "cheapest" (see needed.sec) would have the bot gambling with all 5
      // dice unlocked turn after turn instead of reacting to what actually
      // came up. Only take it once it's already real on this throw.
      if (needed.sec > 0) continue;
    }
    // If this combo is the one currently called, a later realization also
    // opens the appel tiles — chase those too, and actively pursue them
    // when they're the better (or only) placement, e.g. to block a
    // near-complete opponent line. An uncalled combo's own tiles are
    // placeable regardless, so no other comboKey gets this bonus.
    const callIndex = CALL_INDEX[comboKey];
    const cells =
      callIndex !== undefined && state.called[callIndex] && anyCellFree(state.table, COMBO_CELLS.appel)
        ? COMBO_CELLS[comboKey].concat(COMBO_CELLS.appel)
        : COMBO_CELLS[comboKey];

    let bestCellWeight = null;
    for (const rc of cells) {
      if (!rc) continue;
      const r = Number(rc[0]);
      const c = Number(rc[1]);
      if (state.table[r][c] !== 0) continue; // already occupied

      const cand = evaluateCandidate(state, r, c, player, opponent, piecesLeftAfter);
      const w = candidateWeight(cand, strategy);
      if (bestCellWeight === null || w > bestCellWeight) bestCellWeight = w;
    }
    if (bestCellWeight === null) continue; // combo is dead, both cells taken

    const need = needed[comboKey] ?? 3;
    // Expected value of chasing this combo: full weight once it's already
    // realized (probability 1), scaled down by the actual live chance of
    // getting there — e.g. yam naturally comes out far less attractive
    // than carre from a bare brelan, since it genuinely needs one more
    // matching die, without needing a hand-tuned "yam is risky" penalty.
    const probability = liveProbability(comboKey, state, needed);
    const attractiveness = bestCellWeight * probability;

    if (!best || attractiveness > best.attractiveness) {
      best = { comboKey, attractiveness, need };
    }
  }
  return best;
}

// ---------- Live achievability probability ----------
// The static boardProbabilities table above is only accurate for a
// fresh, all-5-dice-free throw. From the second throw on, some dice are
// already locked, so the real odds of completing a combo depend on how
// many dice are actually still free to reroll and how many rolls are
// actually left — this computes that directly instead of reusing the
// first-throw-only numbers or a flat per-die guess.
function nChooseK(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

// Probability of at least `k` successes across `n` independent trials,
// each with success probability `p`.
function binomialAtLeast(n, k, p) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let prob = 0;
  for (let i = k; i <= n; i++) {
    prob += nChooseK(n, i) * p ** i * (1 - p) ** (n - i);
  }
  return prob;
}

// Chance (0-1) that a single still-free die shows one of `successFaces`
// target faces at least once across the rolls remaining.
function perDieHitChance(successFaces, rollsLeft) {
  const missChancePerRoll = 1 - successFaces / 6;
  return 1 - missChancePerRoll ** Math.max(0, rollsLeft);
}

// Probability (0-1) of `comboKey` becoming achievable from here, given
// the dice actually still available to reroll toward it — excluding any
// die that's already locked in (from an earlier throw this turn) and
// can never change again — and the rolls actually left.
function liveProbability(comboKey, state, needed) {
  const need = needed[comboKey] ?? 3;
  if (need <= 0) return 1;
  if (state.dice.rollsLeft <= 0) return 0;

  const wouldLock = lockForTarget(state.dice.values, comboKey);
  const freeDice = wouldLock.filter((locked, i) => !locked && !state.dice.locked[i]).length;
  if (need > freeDice) return 0;

  // "petit" just needs low values, a 3-in-6 shot (rolling 1-3) per die
  // per roll; every other combo needs one specific face, a 1-in-6 shot.
  const successFaces = comboKey === "petit" ? 3 : 1;
  const p = perDieHitChance(successFaces, state.dice.rollsLeft);
  return binomialAtLeast(freeDice, need, p);
}

function neededDiceEstimate(diceValues) {
  const counts = faceCounts(diceValues);
  const sorted = counts.slice(1).sort((a, b) => b - a);

  const needed = {};
  for (let face = 1; face <= 6; face++) {
    needed[`brelan${face}`] = Math.max(0, 3 - counts[face]);
  }
  needed.carre = Math.max(0, 4 - sorted[0]);
  needed.yam = Math.max(0, 5 - sorted[0]);

  if (sorted[0] >= 3 && sorted[1] >= 2) needed.full = 0;
  else if (sorted[0] >= 3) needed.full = 1;
  else if (sorted[0] === 2 && sorted[1] === 2) needed.full = 1;
  else if (sorted[0] === 2) needed.full = 2;
  else needed.full = 3;

  const sum = diceValues.reduce((a, b) => a + b, 0);
  needed.petit = sum < 9 ? 0 : diceValues.filter((v) => v >= 4).length;

  needed.suite = Math.max(0, 5 - bestStraightMatch(diceValues).length);

  needed.sec = Math.min(needed.yam, needed.carre, needed.full, needed.suite, needed.petit);

  return needed;
}

// ---------- Which dice to lock before the next roll ----------
export function chooseDiceToLock(diceValues, state, player, strategy) {
  const target = chooseTarget(state, player, strategy);
  if (!target) return diceValues.map(() => false);
  return lockForTarget(diceValues, target.comboKey);
}

function lockForTarget(diceValues, comboKey) {
  if (comboKey === "sec") {
    // Only way to realize sec: throw all 5 dice unlocked and hope one of
    // yam/carre/full/suite/petit comes up naturally. Locking anything
    // forfeits sec for the rest of the turn, so lock nothing.
    return diceValues.map(() => false);
  }

  if (comboKey.startsWith("brelan") || comboKey === "carre" || comboKey === "yam") {
    const face = comboKey.startsWith("brelan") ? Number(comboKey.slice(6)) : null;
    if (face) return diceValues.map((v) => v === face);
    const counts = faceCounts(diceValues);
    const topFace = counts.indexOf(Math.max(...counts.slice(1)));
    return diceValues.map((v) => v === topFace);
  }

  if (comboKey === "full") {
    const counts = faceCounts(diceValues);
    const facesByCount = [1, 2, 3, 4, 5, 6].sort((a, b) => counts[b] - counts[a]);
    const targets = new Set([facesByCount[0]]);
    if (counts[facesByCount[1]] >= 2) targets.add(facesByCount[1]);
    return diceValues.map((v) => targets.has(v));
  }

  if (comboKey === "petit") {
    const sortedIdx = diceValues
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v)
      .slice(0, 2)
      .map((x) => x.i);
    return diceValues.map((_, i) => sortedIdx.includes(i));
  }

  if (comboKey === "suite") {
    const run = new Set(bestStraightMatch(diceValues));
    const used = new Set();
    return diceValues.map((v) => {
      if (run.has(v) && !used.has(v)) {
        used.add(v);
        return true;
      }
      return false;
    });
  }

  return diceValues.map(() => false);
}

// ---------- Whether to stop rolling early ----------
export function shouldStopRolling(state, player, strategy) {
  const hasAnyLegalMove = state.possibleMoves.some((row) => row.some((v) => v === 1));
  if (!hasAnyLegalMove) return false; // keep rolling, nothing to place yet

  const target = chooseTarget(state, player, strategy);
  if (!target) return true; // nothing left worth chasing, take what we have

  if (target.need === 0) {
    // The target is already realized, but brelan/carre only constrain a
    // subset of the dice (the matching face) — the rest are free. Locking
    // just that subset, like chooseDiceToLock already does, can never lose
    // the combo already in hand: rerolling the free dice is pure upside
    // (a shot at full/carre/yam/petit) with no way to undo what's secured.
    // Take that free roll whenever one is actually left to spend.
    const isSubsetCombo = target.comboKey.startsWith("brelan") || target.comboKey === "carre";
    const hasFreeDice = lockForTarget(state.dice.values, target.comboKey).some((locked) => !locked);
    if (isSubsetCombo && hasFreeDice && state.dice.rollsLeft > 0) return false;
    return true;
  }

  // Every throw can create a different useful combination by chance. Compare
  // the best one now available with the value of continuing the old chase;
  // when the new opportunity is at least as good, use it instead of rerolling.
  const opponent = player === 1 ? 2 : 1;
  const piecesLeftAfter = Math.max(0, state.players[player].remainingPieces - 1);
  const available = bestAvailableCandidate(state, player, opponent, piecesLeftAfter, strategy);
  if (
    available &&
    !shouldSkipPlacement(state, available, player, opponent) &&
    candidateWeight(available, strategy) >= target.attractiveness
  ) {
    return true;
  }

  // Do not spend a whole turn repeatedly fishing for the same tile from a
  // poor opening throw.  A target that still needs more dice than there are
  // throws remaining is a long shot, while a legal tile is already available
  // on the board.  Take the reliable opportunity instead.  This deliberately
  // leaves the bot rolling when it has no current placement at all.
  return target.need > state.dice.rollsLeft;
}

function bestAvailableCandidate(state, player, opponent, piecesLeftAfter, strategy) {
  const candidates = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (state.possibleMoves[r][c] === 1) {
        candidates.push(evaluateCandidate(state, r, c, player, opponent, piecesLeftAfter));
      }
    }
  }
  if (candidates.length === 0) return null;

  candidates.sort(strategy === "speed" ? compareSpeed : comparePoints);
  return candidates[0];
}

// ---------- Which tile to place a piece on ----------
// Returns a "rc" coordinate string (matching the app's existing format,
// e.g. "23"), or null if no legal placement exists.
export function chooseBestMove(state, player, strategy) {
  const opponent = player === 1 ? 2 : 1;
  const piecesLeftAfter = Math.max(0, state.players[player].remainingPieces - 1);
  const best = bestAvailableCandidate(state, player, opponent, piecesLeftAfter, strategy);
  if (!best) return null;

  if (shouldSkipPlacement(state, best, player, opponent)) return null;

  return `${best.r}${best.c}`;
}
