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

function longestConsecutiveRun(diceValues) {
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

// Point-diff and other per-cell metrics, evaluated via a cheap clone
// (5x5 board, negligible cost) for clarity over cleverness.
function cloneTable(table) {
  return table.map((row) => row.slice());
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
  const clusterScore = countAdjacentOwn(state.table, r, c, player);

  return { r, c, pointsGained, wouldBeFive, longestLineAfter, rarity, blockScore, clusterScore, piecesLeftAfter };
}

// Comparator implementing the shared priority ladder: points > rarity >
// blocking > clustering. "avoidEarlyFive" softly discourages POINTS from
// ending the game via 5-in-a-row while there's still plenty of game left.
function comparePoints(a, b) {
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
  if (a.wouldBeFive !== b.wouldBeFive) return a.wouldBeFive ? -1 : 1;
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
      cand.longestLineAfter * 10_000 +
      cand.pointsGained * 1_000 +
      cand.rarity * 10 +
      cand.blockScore * 3 +
      cand.clusterScore
    );
  }
  const earlyFivePenalty = cand.wouldBeFive && cand.piecesLeftAfter > 2 ? 5_000 : 0;
  return (
    cand.pointsGained * 100_000 -
    earlyFivePenalty +
    cand.rarity * 100 +
    cand.blockScore * 10 +
    cand.clusterScore
  );
}

// ---------- Which combo to chase this roll ----------
function chooseTarget(state, player, strategy) {
  const opponent = player === 1 ? 2 : 1;
  const piecesLeftAfter = Math.max(0, state.players[player].remainingPieces - 1);
  const needed = neededDiceEstimate(state.dice.values);
  const PENALTY_PER_DIE = strategy === "speed" ? 8_000 : 20_000; // weighted-scale penalty, see candidateWeight scale

  let best = null;
  for (const comboKey of Object.keys(COMBO_CELLS)) {
    if (comboKey === "sec" || comboKey === "appel") continue; // not chaseable via locking
    const cells = COMBO_CELLS[comboKey];

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
    const attractiveness = bestCellWeight - need * PENALTY_PER_DIE;

    if (!best || attractiveness > best.attractiveness) {
      best = { comboKey, attractiveness, need };
    }
  }
  return best;
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

  needed.suite = Math.max(0, 5 - longestConsecutiveRun(diceValues).length);

  return needed;
}

// ---------- Which dice to lock before the next roll ----------
export function chooseDiceToLock(diceValues, state, player, strategy) {
  const target = chooseTarget(state, player, strategy);
  if (!target) return diceValues.map(() => false);
  return lockForTarget(diceValues, target.comboKey);
}

function lockForTarget(diceValues, comboKey) {
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
    const run = new Set(longestConsecutiveRun(diceValues));
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
  return target.need === 0; // the target we're chasing is already achieved
}

// ---------- Which tile to place a piece on ----------
// Returns a "rc" coordinate string (matching the app's existing format,
// e.g. "23"), or null if no legal placement exists.
export function chooseBestMove(state, player, strategy) {
  const opponent = player === 1 ? 2 : 1;
  const piecesLeftAfter = Math.max(0, state.players[player].remainingPieces - 1);

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
  return `${candidates[0].r}${candidates[0].c}`;
}
