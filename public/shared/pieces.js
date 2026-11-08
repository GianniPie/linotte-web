//----------- WHICH PIECES THE TWO PLAYERS GET ---------------
// Shared by the app (offline games) and the game server (online games), so a
// favorite piece works the same everywhere.
//
// A player may choose a favorite piece in the options; otherwise it's picked
// at random. The two pieces must look clearly different: colours are compared
// with the "redmean" distance (cheap, close to how the eye sees it), and 120
// cleanly separates near-duplicates (two identical greens, ~0-50) from
// genuinely different shades of one family (~150+), while leaving every piece
// at least ~27 valid partners. When two favorites clash, player 1's wins and
// player 2 gets a random piece that stands apart from it.

import { pieces } from "./assets.js";

// The first 8 pieces are plain colours, kept for profile pictures only.
export const FIRST_PLAY_PIECE = 8;
export const isPlayPiece = (i) => Number.isInteger(i) && i >= FIRST_PLAY_PIECE && i < pieces.length;

const MIN_COLOR_DISTANCE = 120;
const hexOf = (i) => pieces[i].split("_")[1].slice(0, 6);

export function colorDistance(hexA, hexB) {
  const [r1, g1, b1] = [0, 2, 4].map((k) => parseInt(hexA.slice(k, k + 2), 16));
  const [r2, g2, b2] = [0, 2, 4].map((k) => parseInt(hexB.slice(k, k + 2), 16));
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db);
}

const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

// Pieces that stand apart from piece `i` (any other one if, impossibly, none does).
function partnersOf(i) {
  const others = [];
  for (let k = FIRST_PLAY_PIECE; k < pieces.length; k++) if (k !== i) others.push(k);
  const far = others.filter((k) => colorDistance(hexOf(i), hexOf(k)) >= MIN_COLOR_DISTANCE);
  return far.length ? far : others;
}

// Indexes into `pieces` for players 1 and 2; `want1`/`want2` are their
// favorites (anything else = no favorite).
export function pickPieceIndexes(want1 = -1, want2 = -1) {
  const all = [];
  for (let k = FIRST_PLAY_PIECE; k < pieces.length; k++) all.push(k);
  // Only player 2 has a favorite: theirs first, player 1 fits around it.
  if (!isPlayPiece(want1) && isPlayPiece(want2)) return [randomOf(partnersOf(want2)), want2];
  const p1 = isPlayPiece(want1) ? want1 : randomOf(all);
  const partners = partnersOf(p1);
  const p2 = partners.includes(want2) ? want2 : randomOf(partners);
  return [p1, p2];
}
