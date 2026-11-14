//----------- WHAT THE BOT NOTICES ON THE BOARD ---------------
// A person glancing at the board sees things the move generator doesn't need:
// a line one piece away from scoring, a line that has just been blocked, two
// placements that are about as good as each other. These helpers read that
// from a plain 5x5 table (0 empty, 1 and 2 the players) and from botAI's
// ranked candidates. Pure functions, so they can be tested alone.

const SIZE = 5;

// Every triple that scores (the same ones gameEngine's countPoints counts),
// as indexes into the flat 25-cell table.
export const TRIPLES = (() => {
  const out = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < 3; x++) out.push([y * 5 + x, y * 5 + x + 1, y * 5 + x + 2]);
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < 3; y++) out.push([y * 5 + x, y * 5 + x + 5, y * 5 + x + 10]);
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) out.push([y * 5 + x, y * 5 + x + 6, y * 5 + x + 12]);
  for (let x = 2; x < SIZE; x++) for (let y = 0; y < 3; y++) out.push([y * 5 + x, y * 5 + x + 4, y * 5 + x + 8]);
  return out;
})();

export const flat = (table) => table.flat();
export const indexOfRc = (rc) => Number(String(rc)[0]) * 5 + Number(String(rc)[1]);

// The empty cells where `owner` would score by putting a piece (a triple with
// two of its pieces and one empty cell), with how many triples each would make.
export function scoringCells(table, owner) {
  const t = Array.isArray(table[0]) ? flat(table) : table;
  const cells = new Map();
  for (const tri of TRIPLES) {
    let mine = 0, empty = -1, other = 0;
    for (const i of tri) {
      if (t[i] === owner) mine++;
      else if (t[i] === 0) empty = i;
      else other++;
    }
    if (mine === 2 && other === 0 && empty >= 0) cells.set(empty, (cells.get(empty) || 0) + 1);
  }
  return cells;
}

// The cell `owner` filled between two boards (-1 when none).
export function newPieceCell(before, after, owner) {
  const a = Array.isArray(before[0]) ? flat(before) : before;
  const b = Array.isArray(after[0]) ? flat(after) : after;
  for (let i = 0; i < 25; i++) if (a[i] !== owner && b[i] === owner) return i;
  return -1;
}

// Is the cell touching at least `n` of `owner`'s pieces (a cell that would
// have helped them, even if it scored nothing yet)?
export function touches(table, owner, index, n = 2) {
  const t = Array.isArray(table[0]) ? flat(table) : table;
  const r = Math.floor(index / 5), c = index % 5;
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5 && t[rr * 5 + cc] === owner) count++;
  }
  return count >= n;
}

// How clear the choice between the two best placements is: 1 when one is
// plainly better, towards 0 when they are about as good (a person hesitates).
export function placementMargin(ranked) {
  if (!ranked || ranked.length < 2) return 1;
  const value = (c) => (c.pointsGained || 0) * 4 + (c.wouldWinGame ? 20 : 0) + (c.deniedPoints || 0) * 3
    + (c.urgentBlock ? 3 : 0) + (c.criticalBlock ? 6 : 0) + (c.longestLineAfter || 0) + (c.lineConnection || 0) + (c.clusterScore || 0) * 0.3;
  const gap = value(ranked[0]) - value(ranked[1]);
  if (gap <= 0.5) return 0;
  if (gap <= 1.5) return 0.35;
  if (gap <= 3) return 0.7;
  return 1;
}

// How near the dice are to making what the bot is going for. "near" when one
// die is missing or the chance of making it is good; "far" when it is a long
// shot. `target` is botAI's explainTarget.
export function nearness(target, state) {
  if (state?.combinationsRealized?.some((v, i) => v && i !== 1 && i !== 2)) return "made"; // a combination is already there
  if (!target) return "far";
  if (target.need <= 1 || target.probability >= 0.5) return "near";
  if (target.probability < 0.2) return "far";
  return "middle";
}
