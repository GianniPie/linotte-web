//----------- COMBINATION DEMOS: THE SCRIPTS ---------------
// One short, scripted turn per combination, played back in the help page's
// demo player (public/demo.js) with the game's own board, strip, dice and
// buttons. Pure data, so test/check-demos.js can run every script through
// the real engine and prove each one really makes its combination.
//
// Steps:
//   { roll: [5 faces] }    tap ROLL; kept dice must keep their face
//   { keep: [indexes] }    tap those dice to keep them
//   { call: index }        tap a combination in the strip to call it (3..7)
//   { place: "rc" }        tap that board tile to put a piece there
//   { done: true }         tap DONE
// Captions, one sentence per line:
//   say   shown BEFORE the action -- what the player is about to do
//   then  shown AFTER it -- what the dice made (a sentence or a list)

import { tile } from "./utils.js";

// Index of each combination in the strip / in state.combinationsRealized.
export const COMBO_INDEX = { brelan: 0, sec: 1, appel: 2, full: 3, carre: 4, petite: 5, suite: 6, yam: 7 };

const DONE = { done: true, say: "Tap DONE to end your turn." };

export const DEMOS = {
  brelan: {
    name: "Brelan",
    steps: [
      { say: "Roll the five dice.", roll: [3, 5, 3, 1, 6], then: "Two 3s." },
      { say: "Keep the two 3s.", keep: [0, 2] },
      { say: "Roll the other three dice.", roll: [3, 2, 3, 3, 4], then: "Three 3s make a Brelan." },
      { say: "A Brelan of 3s goes on a 3 tile.", place: tile.b31 },
      DONE,
    ],
  },
  full: {
    name: "Full",
    steps: [
      { say: "Roll the five dice.", roll: [5, 2, 5, 1, 5], then: "Three 5s already." },
      { say: "Keep the three 5s.", keep: [0, 2, 4] },
      { say: "Roll the other two dice.", roll: [5, 2, 5, 2, 5], then: "Three 5s and a pair of 2s make a Full." },
      { say: "Put a piece on a Full tile.", place: tile.fu1 },
      DONE,
    ],
  },
  carre: {
    name: "Carré",
    steps: [
      // No 4s anywhere in this one: "four 4s" would blur the dice value with
      // the count that makes a Carré.
      { say: "Roll the five dice.", roll: [2, 6, 2, 1, 2], then: "Three 2s." },
      { say: "Keep the three 2s.", keep: [0, 2, 4] },
      { say: "Roll the other two dice.", roll: [2, 2, 2, 5, 2], then: "Four 2s make a Carré." },
      { say: "Put a piece on a Carré tile.", place: tile.ca1 },
      DONE,
    ],
  },
  petite: {
    name: "Petite",
    steps: [
      { say: "Roll the five dice.", roll: [1, 2, 6, 5, 1], then: "They add up to 15." },
      { say: "Keep the low dice: 1, 2 and 1.", keep: [0, 1, 4] },
      { say: "Roll the other two dice.", roll: [1, 2, 3, 1, 1], then: ["1 + 2 + 3 + 1 + 1 = 8.", "8 or less makes a Petite."] },
      { say: "Put a piece on a Petite tile.", place: tile.pe1 },
      DONE,
    ],
  },
  suite: {
    name: "Suite",
    steps: [
      { say: "Roll the five dice.", roll: [5, 2, 6, 6, 3], then: "2, 3, 5 and 6: only a 4 is missing." },
      { say: "Keep the 5, the 2, one 6 and the 3.", keep: [0, 1, 2, 4] },
      { say: "Roll the last die.", roll: [5, 2, 6, 4, 3], then: "With the 4, the dice make a Suite." },
      { say: "Put a piece on a Suite tile.", place: tile.su1 },
      DONE,
    ],
  },
  yam: {
    name: "Yam",
    steps: [
      { say: "Roll the five dice.", roll: [6, 2, 6, 3, 1], then: "Two 6s." },
      { say: "Keep the two 6s.", keep: [0, 2] },
      { say: "Roll the other three dice.", roll: [6, 6, 6, 4, 6], then: "Four 6s." },
      { say: "Keep all four 6s.", keep: [1, 4] },
      { say: "Roll the last die.", roll: [6, 6, 6, 6, 6], then: "Five 6s make a Yam." },
      { say: "There is one Yam tile, in the middle of the board.", place: tile.yam },
      DONE,
    ],
  },
  sec: {
    name: "Sec",
    steps: [
      { say: "Roll the five dice.", roll: [2, 5, 2, 6, 2], then: ["Three 2s make a Brelan.", "Keep nothing, and try for a Sec."] },
      { say: "Roll all five dice again.", roll: [1, 4, 6, 3, 6], then: "Nothing this time." },
      { say: "Roll all five dice once more.", roll: [5, 5, 2, 5, 5], then: ["Four 5s make a Carré.", "No dice were kept, so it is also a Sec."] },
      { say: "Put a piece on a Sec tile.", place: tile.se1 },
      DONE,
    ],
  },
  appel: {
    name: "Appel",
    steps: [
      { say: "Roll the five dice.", roll: [3, 3, 5, 2, 3], then: "Three 3s make a Brelan." },
      { say: "Call Full: tap it in the strip.", call: COMBO_INDEX.full },
      { say: "Keep the three 3s.", keep: [0, 1, 4] },
      { say: "Roll the other two dice.", roll: [3, 3, 3, 6, 3], then: ["Four 3s make a Carré.", "You called Full, not Carré, so the Appel tiles stay off."] },
      { say: "Roll the same two dice again.", roll: [3, 3, 5, 5, 3], then: ["Three 3s and a pair of 5s make a Full.", "You called it, so the Appel tiles light up."] },
      { say: "Put a piece on an Appel tile.", place: tile.ap1 },
      DONE,
    ],
  },
};
