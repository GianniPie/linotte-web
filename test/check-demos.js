// Plays every help-page demo script through the real game engine and fails
// if a script would show something the game wouldn't do: a kept die that
// changes face, a call the rules don't allow, a tile that doesn't light up,
// or a demo that never makes its own combination.
//   node test/check-demos.js
import assert from "node:assert/strict";
import { updateGame } from "../public/shared/gameEngine.js";
import { createInitialGameState } from "../public/shared/utils.js";
import { DEMOS, COMBO_INDEX } from "../public/shared/demoScripts.js";

for (const [key, demo] of Object.entries(DEMOS)) {
  const s = createInitialGameState();
  let placed = null;
  for (const step of demo.steps) {
    assert.ok(step.say, `${key}: every step needs a caption`);
    // One sentence per caption line (the player shows one line per sentence).
    for (const line of [step.say].concat(step.then || [])) {
      assert.equal((line.match(/[.!?](\s|$)/g) || []).length, 1, `${key}: "${line}" is not exactly one sentence`);
    }
    if (step.roll) {
      assert.ok(s.dice.rollsLeft > 0, `${key}: more than three rolls`);
      s.dice.values.forEach((v, i) => {
        if (s.dice.locked[i]) assert.equal(step.roll[i], v, `${key}: kept die ${i} changed face`);
      });
      updateGame(s, { type: "ROLL_DICE", values: step.roll });
      updateGame(s, { type: "STOP_ROLL" });
      // A caption that says the Appel tiles stay off / light up must be true.
      const said = [].concat(step.then || []).join(" ");
      if (/Appel tiles stay off/.test(said)) assert.ok(!s.combinationsRealized[COMBO_INDEX.appel], `${key}: Appel lit up but the caption says it stays off`);
      if (/Appel tiles light up/.test(said)) assert.ok(s.combinationsRealized[COMBO_INDEX.appel], `${key}: Appel stayed off but the caption says it lights up`);
    } else if (step.keep) {
      assert.ok(s.dice.rollsLeft < 3, `${key}: keeping dice before the first roll`);
      const locked = s.dice.locked.slice();
      step.keep.forEach((i) => { locked[i] = true; });
      assert.ok(!locked.every(Boolean), `${key}: all five dice kept`);
      updateGame(s, { type: "LOCK_DICE", locked });
    } else if (step.call !== undefined) {
      assert.ok(step.call >= 3 && step.call <= 7, `${key}: only full..yam can be called`);
      assert.ok(s.dice.rollsLeft < 3, `${key}: calling before the first roll`);
      const called = [null, null, null, 0, 0, 0, 0, 0];
      called[step.call] = 1;
      updateGame(s, { type: "SELEC_CALL", called });
    } else if (step.place) {
      const [r, c] = [Number(step.place[0]), Number(step.place[1])];
      assert.equal(s.possibleMoves[r][c], 1, `${key}: tile ${step.place} is not lit up`);
      updateGame(s, { type: "PLACE_PIECE", coordinates: step.place, player: 1 });
      placed = step.place;
    } else if (step.done) {
      assert.ok(placed, `${key}: DONE before placing a piece`);
    }
  }
  console.log(`ok: ${demo.name}`);
}

// Each demo must actually make the combination it is named after.
for (const [key] of Object.entries(DEMOS)) {
  const s = createInitialGameState();
  for (const step of DEMOS[key].steps) {
    if (step.roll) { updateGame(s, { type: "ROLL_DICE", values: step.roll }); updateGame(s, { type: "STOP_ROLL" }); }
    if (step.keep) { const l = s.dice.locked.slice(); step.keep.forEach((i) => { l[i] = true; }); updateGame(s, { type: "LOCK_DICE", locked: l }); }
    if (step.call !== undefined) { const c = [null, null, null, 0, 0, 0, 0, 0]; c[step.call] = 1; updateGame(s, { type: "SELEC_CALL", called: c }); }
    if (step.place) break;
  }
  assert.ok(s.combinationsRealized[COMBO_INDEX[key]], `${key}: the demo never makes a ${DEMOS[key].name}`);
}
console.log("all demo scripts are valid");
