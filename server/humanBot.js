//----------- HUMAN-LIKE BOT ---------------
// Fills a seat when no human is found for the random queue. It decides with
// the same botAI the offline bot uses, but plays through the room exactly as
// a person's client does -- one tap at a time (lock a die, pick a call, put a
// piece down, maybe take it back), with uneven pauses, the odd slip, and
// emoji replies. Nothing here is visible on the wire: its actions are the
// same messages a human's would be.
//
// What makes it feel like a person, besides the slips (humanize.js):
//  - pace: quick when the dice are close to making a combination, slow when
//    it is unsure (two placements about as good as each other); locking the
//    dice then rolling is one quick sequence; dice are tapped in any order
//    and the call can come before, between or after the taps;
//  - the board: it notices lines it closes, lines closed on it, a point the
//    opponent could have blocked and didn't, and reacts in the chat the way a
//    person would (botChat.js, botSense.js);
//  - the opponent's pace: it nudges (roll, then the bell) when waited on too
//    long, and now and then steps away for a moment (wait);
//  - the chat: it talks more when it is talked to, sometimes taps the wrong
//    reaction and corrects it.
//
// Players are told in the consent screen that a random opponent may be
// computer-controlled; the bot is never used in a private friend room.

import {
  chooseCallToMake, chooseDiceToLock, shouldStopRolling, explainPlacement, explainTarget,
} from "../public/shared/botAI.js";
import { callAllowed } from "../public/shared/gameEngine.js";
import { BOT_TIME_SCALE } from "./config.js";
import { makePersona, think, slips, rand, rematchAnswer } from "./humanize.js";
import { randomName } from "./names.js";
import { scoringCells, newPieceCell, touches, placementMargin, nearness, indexOfRc } from "./botSense.js";
import { pickFor, pickWeighted, replyTo, wrongOne, cooledHeat, activity, HEAT_PER_EMOTE } from "./botChat.js";

const MAX_EMOTES_PER_GAME = 6;
const MIN_GAP_BETWEEN_EMOTES_MS = 4000; // a person doesn't fire off reactions back to back

// Like people, some bots show a country flag (most don't): picked from the
// game's likely players (the app's languages' countries come up most).
const BOT_COUNTRIES = [
  "IT", "IT", "FR", "FR", "ES", "ES", "BR", "BR", "PT", "CN", "CN", "TW", "US", "US", "GB",
  "DE", "BE", "CH", "CA", "MX", "AR", "NL", "PL", "SE", "JP", "KR", "AU", "IE", "AT", "CL",
];
const BOT_FLAG_SHARE = 0.3;
const randomCountry = () => (Math.random() < BOT_FLAG_SHARE ? BOT_COUNTRIES[Math.floor(Math.random() * BOT_COUNTRIES.length)] : "");
const ROLL_ANIMATION_MS = 1250; // the client's own roll animation (1200ms) plus a beat

const copyTable = (table) => table.map((row) => row.slice());
const shuffled = (list) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export class HumanBot {
  constructor({ avoidName = "", timeScale = BOT_TIME_SCALE, persona = null, name = null, country = null, emotesSent = 0 } = {}) {
    // A bot saved by an earlier version lacks the newer traits: fill them in.
    this.persona = { patience: 0.7, emojiSlip: 0.05, ...(persona || makePersona()) };
    this.name = name || randomName(avoidName);
    this.country = country ?? randomCountry();
    this.timeScale = timeScale;
    this.stopped = false;
    this.timers = new Set();
    this.emotesSent = emotesSent;
    this.playing = false;
    this.heat = 0; // how much it has been talked to lately
    this.heatAt = 0;
    this.lastSayAt = 0;
    this.tempo = 1; // < 1 quick, > 1 slow (see rollPhase / placePhase)
    this.watchGen = 0; // the opponent-is-slow watch: bumped on every opponent action
    this.tableBefore = null; // the board as it was when the opponent's turn began
    this.turn = this.freshTurn();
    this.oppFlags = { rolled: false, yam: false };
  }

  freshTurn() { return { slips: 0, blocked: false, yam: false }; }

  // The same bot (character, name, emoji count) after a server restart; see
  // Room.toJSON / fromJSON.
  toJSON() {
    return { persona: this.persona, name: this.name, country: this.country, emotesSent: this.emotesSent };
  }

  static fromJSON(data) {
    return new HumanBot({ persona: data.persona, name: data.name, country: data.country ?? "", emotesSent: data.emotesSent });
  }

  attach(room, seat) {
    this.room = room;
    this.seat = seat;
  }

  stop() {
    this.stopped = true;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  //--------- events from the room ---------
  onEvent(kind, data) {
    if (this.stopped) return;
    try {
      this.handle(kind, data);
    } catch (err) {
      // What the bot notices or says must never get in the way of the game.
      console.error("bot event failed:", kind, err);
    }
  }

  handle(kind, data) {
    switch (kind) {
      case "gameStart":
        this.tableBefore = copyTable(this.room.state.table);
        this.oppFlags = { rolled: false, yam: false };
        if (this.room.state.currentPlayer === this.seat) this.playTurn(data.startDelay);
        else this.watchOpponent(data.startDelay);
        this.speak("start", 0.8, [2500, 6500], data.startDelay);
        break;
      case "turn":
        this.watchGen++; // its turn: no one to wait on
        this.playTurn(0);
        break;
      case "action":
        this.noticeOpponent(data.action);
        break;
      case "turnEnded":
        if (data.by === this.seat) this.afterOwnTurn(data.gained);
        else this.afterOpponentTurn(data.gained);
        break;
      case "emote":
        this.warmUp();
        if (this.chance(0.8)) this.later(rand.uniform(1500, 6000), () => this.send(replyTo(data.id)));
        break;
      case "gameOver":
        this.watchGen++;
        if (this.chance(0.9)) {
          const won = data.winner === this.seat;
          this.later(rand.uniform(1500, 4500), () => this.send(won ? rand.pick(["🙏🏻", "🤣", "❤️"]) : rand.pick(["❤️", "🫤", "😮"])));
        }
        break;
    }
  }

  //--------- the chat ---------
  warmUp() {
    const now = Date.now();
    this.heat = cooledHeat(this.heat, now - this.heatAt) + HEAT_PER_EMOTE;
    this.heatAt = now;
  }

  // How talkative it is right now: its own nature, warmer when talked to.
  activityNow() {
    return activity(this.persona.chatty, cooledHeat(this.heat, Date.now() - this.heatAt));
  }

  chance(p) { return Math.random() < p * this.activityNow(); }

  // Has the other player put a piece on the board yet? Until they have, nothing has
  // happened that is worth a reaction (only the hello at the start).
  opponentHasPlaced() {
    const opp = this.room.otherSeat(this.seat);
    return this.room.state.table.some((row) => row.includes(opp));
  }

  // Maybe say something fitting `situation`, after a pause. Unprompted, so only
  // once the other player has played a piece.
  speak(situation, p, [lo, hi] = [1200, 4000], extra = 0) {
    if (situation !== "start" && !this.opponentHasPlaced()) return;
    if (!this.chance(p)) return;
    this.later(rand.uniform(lo, hi) + extra, () => this.send(pickFor(situation)));
  }

  // Tap a reaction; now and then a wrong one first, corrected a moment later.
  send(id) {
    if (this.stopped || this.room?.status !== "playing") return;
    const plain = id === "🔔" || id === "🎲" || id === "⏳"; // nudges and "wait" are not mixed up
    if (!plain && Math.random() < this.persona.emojiSlip && this.say(wrongOne(id))) {
      this.later(rand.uniform(900, 2400), () => this.say(id, { correction: true }));
      return;
    }
    this.say(id);
  }

  say(id, { correction = false } = {}) {
    if (this.emotesSent >= MAX_EMOTES_PER_GAME) return false;
    if (!correction && Date.now() - this.lastSayAt < MIN_GAP_BETWEEN_EMOTES_MS * this.timeScale) return false;
    if (!this.room.emote(this.seat, id).ok) return false;
    this.emotesSent++;
    this.lastSayAt = Date.now();
    return true;
  }

  //--------- the opponent's turn: watching, nudging, reacting ---------
  noticeOpponent(action) {
    if (!action) return;
    this.watchGen++; // any action: it is not idle (the watch starts over)
    if (action.type === "ROLL_DICE") this.oppFlags.rolled = true;
    if (action.type === "STOP_ROLL" && this.room.state.combinationsRealized?.[7]) this.oppFlags.yam = true;
    this.armWatch();
  }

  // When the opponent keeps us waiting: say "roll" (if they haven't rolled),
  // then ring the bell. The room limits the bell (10 s apart, 5 a game).
  watchOpponent(extraMs = 0) {
    this.oppFlags = { rolled: false, yam: false };
    this.armWatch(extraMs);
  }

  armWatch(extraMs = 0) {
    if (this.stopped || this.room?.status !== "playing" || this.room.state.currentPlayer === this.seat) return;
    const gen = ++this.watchGen;
    const patience = this.persona.patience;
    const idle = (fn) => () => { if (gen === this.watchGen && this.room.state.currentPlayer !== this.seat) fn(); };
    if (!this.oppFlags.rolled) {
      this.later(rand.uniform(9000, 15000) * patience + extraMs, idle(() => {
        if (Math.random() < 0.5) this.send("🎲");
        this.later(rand.uniform(6000, 10000) * patience, idle(() => { if (this.mayRing() && Math.random() < 0.55) this.send("🔔"); }));
      }));
    } else {
      this.later(rand.uniform(14000, 20000) * patience + extraMs, idle(() => { if (this.mayRing() && Math.random() < 0.4) this.send("🔔"); }));
    }
  }

  // The bell is for someone who has already let a turn run out: never for a
  // player who has been taking their turns.
  mayRing() {
    return (this.room.idleTurns?.[this.room.otherSeat(this.seat)] || 0) >= 1;
  }

  // The opponent's turn is over: what did they do to our board?
  afterOpponentTurn(gained) {
    const { room, seat } = this;
    const opp = room.otherSeat(seat);
    const before = this.tableBefore, after = room.state.table;
    this.watchGen++;
    this.tableBefore = copyTable(after);
    if (!before) return;
    const cell = newPieceCell(before, after, opp);
    const mine = scoringCells(before, seat); // cells where we would have scored
    const blocked = cell >= 0 && mine.has(cell);
    const useful = !blocked && cell >= 0 && touches(before, seat, cell, 2);
    const stillOpen = !blocked && [...mine.keys()].some((i) => scoringCells(after, seat).has(i));
    const big = (gained?.[opp] || 0) >= 2 || this.oppFlags.yam;
    this.oppFlags = { rolled: false, yam: false };
    if (cell < 0) return; // they placed nothing: nothing to react to
    if (blocked) this.speak("blockedByOpponent", 0.75);
    else if (big) this.speak("opponentBigScore", 0.65);
    else if (stillOpen) this.speak("opponentLetItBe", 0.5);
    else if (useful) this.speak("opponentTookUseful", 0.3);
    else if (Math.random() < 0.04) this.speak("random", 1);
  }

  // Our turn is over: closed a line, scored, or slipped?
  afterOwnTurn(gained) {
    const g = gained?.[this.seat] || 0;
    const t = this.turn;
    this.turn = this.freshTurn();
    this.tableBefore = copyTable(this.room.state.table);
    this.oppFlags = { rolled: false, yam: false };
    if (t.slips && this.chance(0.45)) this.speak("botSlip", 1);
    else if (t.blocked) this.speak("botBlocked", 0.75);
    else if (g >= 2 || t.yam) this.speak("botBigScore", 0.75);
    else if (g > 0) this.speak("botScored", 0.5);
    else if (Math.random() < 0.04) this.speak("random", 1);
    this.armWatch();
  }

  //--------- helpers ---------
  sleep(ms) {
    return new Promise((resolve) => {
      const t = setTimeout(() => { this.timers.delete(t); resolve(); }, ms * this.timeScale);
      this.timers.add(t);
    });
  }

  later(ms, fn) {
    const t = setTimeout(() => { this.timers.delete(t); if (!this.stopped) fn(); }, ms * this.timeScale);
    this.timers.add(t);
  }

  pause(kind, extra = 0, tempo = this.tempo) {
    return this.sleep(think(kind, this.persona, { timeLeftMs: this.room.timeLeftMs(), extra, tempo }));
  }

  // Asked for a rematch: whether it wants one, and after how long (the lobby
  // waits that long, then starts the game or says no).
  answerRematch({ won }) {
    const { accept, waitMs } = rematchAnswer(this.persona, { botWon: won });
    return { accept, waitMs: waitMs * this.timeScale };
  }

  // True while this is still the same turn and it's still ours to play.
  live(turnId) {
    return !this.stopped && this.room.status === "playing"
      && this.room.turnId === turnId && this.room.state.currentPlayer === this.seat;
  }

  act(action) {
    return this.room.handleAction(this.seat, action).ok;
  }

  // The slip is noted: it may be said (sorry, mhhh...) after the turn.
  slipped() { this.turn.slips++; }

  //--------- a turn ---------
  async playTurn(startDelay) {
    if (this.playing) return;
    this.playing = true;
    const turnId = this.room.turnId;
    this.turn = this.freshTurn();
    this.tempo = 1;
    try {
      // Now and then it steps away for a moment: "wait", a few seconds more.
      if (this.persona.speed > 1.15 && Math.random() < 0.035 && this.room.timeLeftMs() > 24000) {
        this.say("⏳");
        await this.sleep(rand.uniform(4000, 8000));
      } else if (Math.random() < 0.03) {
        this.speak("random", 1, [800, 2500]);
      }
      await this.pause("turnStart", startDelay);
      if (!this.live(turnId)) return;
      await this.rollPhase(turnId);
      if (!this.live(turnId)) return;
      await this.placePhase(turnId);
      if (!this.live(turnId)) return;
      await this.pause("afterPlace", 0, 1);
      if (!this.live(turnId)) return;
      this.act({ type: "END_TURN" });
    } catch (err) {
      console.error("bot turn failed:", err);
    } finally {
      this.playing = false;
    }
  }

  // How quickly it moves: quick when the dice are close to making a
  // combination, slow when it is far from one.
  setTempoFromDice(s, seat, strategy) {
    let target = null;
    try { target = explainTarget(s, seat, strategy); } catch { /* no target: unsure */ }
    const near = nearness(target, s);
    this.tempo = near === "near" || near === "made" ? rand.uniform(0.55, 0.75) : near === "far" ? rand.uniform(1.1, 1.4) : 1;
    return near;
  }

  async rollPhase(turnId) {
    const { room, seat } = this;
    const strategy = this.persona.strategy;
    for (;;) {
      if (!this.act({ type: "ROLL_DICE" })) return;
      await this.sleep(ROLL_ANIMATION_MS);
      if (!this.live(turnId)) return;
      this.act({ type: "STOP_ROLL" });
      const s = room.state;
      this.setTempoFromDice(s, seat, strategy);
      if (s.combinationsRealized?.[7]) this.turn.yam = true;
      await this.pause("rollResult");
      if (!this.live(turnId)) return;

      if (s.dice.rollsLeft <= 0) return;

      const wantsStop = shouldStopRolling(s, seat, strategy);
      if (wantsStop && !slips.rollOn(this.persona)) return;
      if (wantsStop) this.slipped();
      if (!wantsStop && slips.stopEarly(this.persona)) {
        // only stop early if there is something to place at all
        if (s.possibleMoves.some((row) => row.some((v) => v === 1))) { this.slipped(); return; }
      }

      // A call only matters for the next throw, so it is made now, after
      // seeing this one, once we know we are rolling again. A person makes it
      // before tapping the dice, between two taps, or after them.
      let callIndex = chooseCallToMake(s, seat, strategy);
      if (callIndex !== null && callIndex !== undefined && slips.skipCall(this.persona)) { callIndex = null; this.slipped(); }
      const hasCall = callIndex !== null && callIndex !== undefined;
      const moment = !hasCall ? null : pickWeighted([["before", 4], ["during", 2.5], ["after", 3.5]]);
      if (moment === "before") {
        await this.applyCall(callIndex);
        if (!this.live(turnId)) return;
      }

      await this.pause("afterLock");
      if (!this.live(turnId)) return;
      const tapped = await this.applyLock(chooseDiceToLock(s.dice.values, s, seat, strategy), moment === "during" ? callIndex : null);
      if (!this.live(turnId)) return;
      if (moment === "after" && callAllowed(room.state, callIndex)) {
        await this.applyCall(callIndex);
        if (!this.live(turnId)) return;
      }
      if (s.dice.locked.every(Boolean)) return; // keeping all five: nothing to roll
      // Locking and rolling is one movement of the hand: ROLL right after the last tap.
      if (tapped > 0 && Math.random() < 0.75) await this.sleep(rand.uniform(220, 520));
      else await this.pause("beforeRoll");
      if (!this.live(turnId)) return;
    }
  }

  async applyCall(index) {
    const called = [null, null, null, 0, 0, 0, 0, 0];
    called[index] = 1;
    this.act({ type: "SELEC_CALL", called });
    await this.pause("call");
  }

  // Taps the dice to match `target`; returns how many taps. `duringCall`: a
  // call to make between two of the taps (when it is still allowed).
  async applyLock(target, duringCall = null) {
    const want = target.map(Boolean);
    // A person sometimes taps the wrong die; it is corrected on the next throw.
    if (slips.lock(this.persona)) {
      const i = Math.floor(Math.random() * 5);
      want[i] = !want[i];
      this.slipped();
    }
    const current = this.room.state.dice.locked.slice();
    // Usually left to right, sometimes right to left, sometimes any order.
    const r = Math.random();
    const order = r < 0.4 ? shuffled([0, 1, 2, 3, 4]) : r < 0.55 ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
    const taps = order.filter((i) => current[i] !== want[i]);
    const callAfter = duringCall === null ? -1 : Math.floor(Math.random() * Math.max(1, taps.length)); // after which tap
    let done = 0;
    let called = duringCall === null;
    for (const i of taps) {
      current[i] = want[i];
      this.act({ type: "LOCK_DICE", locked: current.slice() });
      done++;
      if (!called && done - 1 >= callAfter && callAllowed(this.room.state, duringCall)) { called = true; await this.applyCall(duringCall); }
      else await this.pause("lockGap");
    }
    if (!called && callAllowed(this.room.state, duringCall)) await this.applyCall(duringCall);
    return done;
  }

  async placePhase(turnId) {
    const { room, seat } = this;
    const explanation = explainPlacement(room.state, seat, this.persona.strategy);
    const ranked = explanation.ranked;
    if (!explanation.chosen || ranked.length === 0) return; // nothing worth placing

    let pick = explanation.chosen;
    if (ranked.length > 1 && slips.placement(this.persona)) {
      pick = ranked[Math.min(ranked.length - 1, Math.random() < 0.7 ? 1 : 2)];
      this.slipped();
    }

    // Unsure when two placements are about as good as each other; quick when
    // one is plainly best, and more so right after making a combination.
    const margin = placementMargin(ranked);
    const made = room.state.combinationsRealized?.some((v, i) => v && i !== 1 && i !== 2);
    this.tempo = margin >= 1 ? (made ? 0.7 : 0.85) : 1.9 - 0.9 * margin;
    await this.pause("placeThink", ranked.length * 120);
    if (!this.live(turnId)) return;

    // Does it close a line the opponent was about to score on?
    const opp = room.otherSeat(seat);
    if (scoringCells(room.state.table, opp).has(indexOfRc(pick.rc))) this.turn.blocked = true;

    // Changing one's mind: tap one tile, hesitate, then tap the right one.
    // The client sends "take back the first" and "place the second" together.
    if (ranked.length > 1 && slips.indecision(this.persona)) {
      const first = ranked.find((c) => c.rc !== pick.rc) || pick;
      this.act({ type: "PLACE_PIECE", coordinates: first.rc, player: this.seat });
      await this.pause("tentativeRedo");
      if (!this.live(turnId)) return;
      this.act({ type: "PLACE_PIECE", coordinates: first.rc, player: 0 });
    }
    this.act({ type: "PLACE_PIECE", coordinates: pick.rc, player: this.seat });
  }
}
