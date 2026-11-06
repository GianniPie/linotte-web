//----------- HUMAN-LIKE BOT ---------------
// Fills a seat when no human is found for the random queue. It decides with
// the same botAI the offline bot uses, but plays through the room exactly as
// a person's client does -- one tap at a time (lock a die, pick a call, put a
// piece down, maybe take it back), with uneven pauses, the odd slip, and
// emoji replies. Nothing here is visible on the wire: its actions are the
// same messages a human's would be.
//
// Players are told in the consent screen that a random opponent may be
// computer-controlled; the bot is never used in a private friend room.

import {
  chooseCallToMake, chooseDiceToLock, shouldStopRolling, explainPlacement,
} from "../public/shared/botAI.js";
import { BOT_TIME_SCALE } from "./config.js";
import { makePersona, think, slips, replyTo, rand } from "./humanize.js";
import { randomName } from "./names.js";

const MAX_EMOTES_PER_GAME = 4;
const ROLL_ANIMATION_MS = 1250; // the client's own roll animation (1200ms) plus a beat

export class HumanBot {
  constructor({ avoidName = "", timeScale = BOT_TIME_SCALE, persona = null, name = null, emotesSent = 0 } = {}) {
    this.persona = persona || makePersona();
    this.name = name || randomName(avoidName);
    this.timeScale = timeScale;
    this.stopped = false;
    this.timers = new Set();
    this.emotesSent = emotesSent;
    this.playing = false;
  }

  // The same bot (character, name, emoji count) after a server restart; see
  // Room.toJSON / fromJSON.
  toJSON() {
    return { persona: this.persona, name: this.name, emotesSent: this.emotesSent };
  }

  static fromJSON(data) {
    return new HumanBot({ persona: data.persona, name: data.name, emotesSent: data.emotesSent });
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
    switch (kind) {
      case "gameStart":
        if (this.room.state.currentPlayer === this.seat) this.playTurn(data.startDelay);
        if (Math.random() < this.persona.chatty * 0.7) this.later(rand.uniform(2500, 6500) + data.startDelay, () => this.say("👋"));
        break;
      case "turn":
        this.playTurn(0);
        break;
      case "turnEnded":
        if (data.by === this.seat && data.gained[this.seat] > 0 && Math.random() < this.persona.chatty * 0.4) {
          this.later(rand.uniform(1500, 4000), () => this.say(rand.pick(["🎲", "🤣", "🙏🏻"])));
        } else if (data.by !== this.seat && data.gained[data.by] >= 2 && Math.random() < this.persona.chatty * 0.5) {
          this.later(rand.uniform(1500, 4000), () => this.say(rand.pick(["😮", "🫤", "🥺"])));
        }
        break;
      case "emote":
        if (Math.random() < 0.35 + this.persona.chatty * 0.5) {
          this.later(rand.uniform(1500, 6000), () => this.say(replyTo(data.id)));
        }
        break;
      case "gameOver":
        if (Math.random() < this.persona.chatty + 0.2) {
          const won = data.winner === this.seat;
          this.later(rand.uniform(1500, 4500), () => this.say(won ? rand.pick(["🙏🏻", "🤣", "❤️"]) : rand.pick(["❤️", "🫤", "😮"])));
        }
        break;
    }
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

  pause(kind, extra = 0) {
    return this.sleep(think(kind, this.persona, { timeLeftMs: this.room.timeLeftMs(), extra }));
  }

  say(id) {
    if (this.emotesSent >= MAX_EMOTES_PER_GAME) return;
    if (this.room.emote(this.seat, id).ok) this.emotesSent++;
  }

  // True while this is still the same turn and it's still ours to play.
  live(turnId) {
    return !this.stopped && this.room.status === "playing"
      && this.room.turnId === turnId && this.room.state.currentPlayer === this.seat;
  }

  act(action) {
    return this.room.handleAction(this.seat, action).ok;
  }

  //--------- a turn ---------
  async playTurn(startDelay) {
    if (this.playing) return;
    this.playing = true;
    const turnId = this.room.turnId;
    try {
      await this.pause("turnStart", startDelay);
      if (!this.live(turnId)) return;
      await this.rollPhase(turnId);
      if (!this.live(turnId)) return;
      await this.placePhase(turnId);
      if (!this.live(turnId)) return;
      await this.pause("afterPlace");
      if (!this.live(turnId)) return;
      this.act({ type: "END_TURN" });
    } catch (err) {
      console.error("bot turn failed:", err);
    } finally {
      this.playing = false;
    }
  }

  async rollPhase(turnId) {
    const { room, seat } = this;
    const strategy = this.persona.strategy;
    for (;;) {
      if (!this.act({ type: "ROLL_DICE" })) return;
      await this.sleep(ROLL_ANIMATION_MS);
      if (!this.live(turnId)) return;
      this.act({ type: "STOP_ROLL" });
      await this.pause("rollResult");
      if (!this.live(turnId)) return;

      const s = room.state;
      if (s.dice.rollsLeft <= 0) return;

      const wantsStop = shouldStopRolling(s, seat, strategy);
      if (wantsStop && !slips.rollOn(this.persona)) return;
      if (!wantsStop && slips.stopEarly(this.persona)) {
        // only stop early if there is something to place at all
        if (s.possibleMoves.some((row) => row.some((v) => v === 1))) return;
      }

      // A call only matters for the next throw, so it is made now, after
      // seeing this one, once we know we are rolling again.
      const callIndex = chooseCallToMake(s, seat, strategy);
      if (callIndex !== null && callIndex !== undefined && !slips.skipCall(this.persona)) {
        await this.applyCall(callIndex);
        if (!this.live(turnId)) return;
      }

      await this.pause("afterLock");
      if (!this.live(turnId)) return;
      await this.applyLock(chooseDiceToLock(s.dice.values, s, seat, strategy));
      if (!this.live(turnId)) return;
      await this.pause("beforeRoll");
      if (!this.live(turnId)) return;
    }
  }

  async applyCall(index) {
    const called = [null, null, null, 0, 0, 0, 0, 0];
    called[index] = 1;
    this.act({ type: "SELEC_CALL", called });
    await this.pause("call");
  }

  async applyLock(target) {
    const want = target.map(Boolean);
    // A person sometimes taps the wrong die; it is corrected on the next throw.
    if (slips.lock(this.persona)) {
      const i = Math.floor(Math.random() * 5);
      want[i] = !want[i];
    }
    const current = this.room.state.dice.locked.slice();
    const order = [0, 1, 2, 3, 4];
    if (Math.random() < 0.3) order.reverse();
    for (const i of order) {
      if (current[i] === want[i]) continue;
      current[i] = want[i];
      this.act({ type: "LOCK_DICE", locked: current.slice() });
      await this.pause("lockGap");
    }
  }

  async placePhase(turnId) {
    const { room, seat } = this;
    const explanation = explainPlacement(room.state, seat, this.persona.strategy);
    const ranked = explanation.ranked;
    if (!explanation.chosen || ranked.length === 0) return; // nothing worth placing

    let pick = explanation.chosen;
    if (ranked.length > 1 && slips.placement(this.persona)) {
      pick = ranked[Math.min(ranked.length - 1, Math.random() < 0.7 ? 1 : 2)];
    }

    await this.pause("placeThink", ranked.length * 120);
    if (!this.live(turnId)) return;

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
