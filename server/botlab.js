//----------- BOT LAB ---------------
// A developer tool, not part of the game: the phone plays against the "speed"
// bot and sends every bot turn here (POST /api/botlab/turn); public/botlab.html,
// open on a computer, shows them live (a stream of server-sent events), lets a
// person validate a turn or say where the piece should have gone, and those
// corrections are turned into weights for the bot's placement
// (public/shared/botLearning.js) that the phone downloads (the same stream) and
// plays with from then on.
//
// Off in production unless BOTLAB_KEY is set (then every call must carry it as
// ?key=... or the X-Botlab-Key header); on, without a key, everywhere else.
// Turns and corrections are kept in server/data/botlab.json.

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { IS_PRODUCTION } from "./config.js";
import { trainAll } from "../public/shared/botLearning.js";

const KEY = process.env.BOTLAB_KEY || "";
export const BOTLAB_ENABLED = !IS_PRODUCTION || Boolean(KEY);
const MAX_TURNS = 400;
const here = path.dirname(fileURLToPath(import.meta.url));

export function createBotLab({ file = path.join(here, "data", "botlab.json"), key = KEY, enabled = BOTLAB_ENABLED } = {}) {
  let turns = []; // newest last
  let cases = []; // { id, verdict, chosen, correct, candidates, boardBefore, note, at }
  let learned = { weights: null, aim: null, call: null, stop: null, report: [], agreement: 1, version: 0 };
  const watchers = new Set();

  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    turns = Array.isArray(saved.turns) ? saved.turns : [];
    cases = Array.isArray(saved.cases) ? saved.cases : [];
    if (saved.learned) learned = { ...learned, ...saved.learned };
  } catch { /* nothing saved yet */ }

  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ turns, cases, learned }));
      } catch (err) { console.error("botlab not saved:", err.message); }
    }, 800);
    saveTimer.unref?.();
  };

  const send = (event, data) => {
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of watchers) res.write(chunk);
  };

  // Weights again from every correction, then everybody is told.
  function retrain() {
    const next = cases.length ? trainAll(cases) : { weights: null, aim: null, call: null, stop: null, report: [], agreement: 1 };
    learned = { ...next, version: learned.version + 1 };
    send("weights", learned);
    save();
  }

  const summary = (c) => ({ id: c.id, kind: c.kind || "place", roll: c.roll ?? null, turnId: c.turnId || c.id, verdict: c.verdict, chosen: c.chosen, correct: c.correct, note: c.note || "" });
  // a placement review keeps the turn's own id (as before); the others add what was reviewed
  const caseId = (turnId, kind, roll) => (kind === "place" ? turnId : `${turnId}#${kind}${roll}`);

  function allowed(req) {
    if (!enabled) return false;
    return !key || req.query.key === key || req.get("X-Botlab-Key") === key;
  }

  function attach(app) {
    const router = express.Router();
    router.use(express.json({ limit: "400kb" }));
    router.use((req, res, next) => {
      if (!allowed(req)) return res.status(404).json({ ok: false });
      res.set("Cache-Control", "no-store");
      next();
    });

    // A bot turn (or a roll of it still in progress, same id again): kept and shown.
    router.post("/turn", (req, res) => {
      const turn = req.body?.turn;
      if (!turn || typeof turn.id !== "string" || !Array.isArray(turn.boardBefore)) return res.status(400).json({ ok: false });
      const i = turns.findIndex((t) => t.id === turn.id);
      if (i >= 0) turns[i] = { ...turns[i], ...turn }; else turns.push({ ...turn, at: Date.now() });
      while (turns.length > MAX_TURNS) turns.shift();
      send("turn", i >= 0 ? turns[i] : turns[turns.length - 1]);
      save();
      res.json({ ok: true });
    });

    // Where the phone can reach this server now: the computer's addresses on the
    // local network (the self-assigned 169.254.x.x ones mean "no network", left out).
    router.get("/info", (req, res) => {
      const port = req.socket.localPort;
      const addresses = Object.values(os.networkInterfaces()).flat()
        .filter((a) => a && a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254."))
        .map((a) => a.address);
      res.json({ port, addresses, urls: addresses.map((ip) => `http://${ip}:${port}/?botlab=${key ? encodeURIComponent(key) : "1"}`) });
    });

    router.get("/state", (req, res) => {
      res.json({ turns, cases: cases.map(summary), learned });
    });

    router.get("/weights", (req, res) => res.json({ weights: learned.weights, aim: learned.aim, call: learned.call, stop: learned.stop, version: learned.version }));

    // Live: turns, corrections and new weights as they happen.
    router.get("/stream", (req, res) => {
      res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
      res.flushHeaders?.();
      res.write(`event: weights\ndata: ${JSON.stringify(learned)}\n\n`);
      watchers.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 20000);
      req.on("close", () => { clearInterval(ping); watchers.delete(res); });
    });

    // One review. kind "place" (default): the cell the piece should have gone to;
    // "aim" / "call" (a combo, or "none" for a call) and "stop" ("stop" | "roll")
    // and "lock" (the dice kept, as five 0/1 characters) are about one roll of the turn (`roll`, from 0). verdict "valid" (the bot was
    // right), "wrong" with `correct`, or "clear".
    router.post("/feedback", (req, res) => {
      const { turnId, verdict, correct, note } = req.body || {};
      const kind = ["place", "aim", "call", "stop", "lock"].includes(req.body?.kind) ? req.body.kind : "place";
      const roll = Number.isInteger(req.body?.roll) ? req.body.roll : null;
      const turn = turns.find((t) => t.id === turnId);
      if (!turn) return res.status(404).json({ ok: false, error: "no_turn" });
      if (kind !== "place" && (roll === null || roll < 0)) return res.status(400).json({ ok: false, error: "bad_roll" });
      const id = caseId(turnId, kind, roll);
      cases = cases.filter((c) => c.id !== id);
      if (verdict === "clear") {
        send("feedback", { id, kind, verdict: "clear" });
      } else {
        let entry;
        if (kind === "place") {
          const chosen = turn.placement?.chosen || null;
          const cell = verdict === "valid" ? chosen : correct;
          if (!cell || !turn.placement?.candidates?.some((c) => c.rc === cell)) return res.status(400).json({ ok: false, error: "bad_cell" });
          entry = { candidates: turn.placement.candidates, boardBefore: turn.boardBefore, chosen, correct: cell };
        } else {
          const lab = turn.rolls?.[roll]?.lab?.[kind];
          if (!lab) return res.status(400).json({ ok: false, error: "no_decision" });
          const cell = verdict === "valid" ? lab.chosen : correct;
          const fine = kind === "lock" ? typeof cell === "string" && /^[01]{5}$/.test(cell)
            : kind === "stop" ? lab.applicable && (cell === "stop" || cell === "roll")
            : kind === "call" ? cell === "none" || lab.options.some((o) => o.combo === cell)
            : lab.options.some((o) => o.combo === cell);
          if (!fine) return res.status(400).json({ ok: false, error: "bad_choice" });
          // a keep is learned as an aim: each combo that could be chased, with the dice it would keep
          const aimOptions = turn.rolls[roll].lab.aim?.options || [];
          const candidates = kind === "stop" ? null
            : kind === "lock" ? lab.options.map((o) => ({ ...(aimOptions.find((a) => a.combo === o.combo) || { combo: o.combo, need: 3, probability: 0, cellWeight: 0.01, value: 0 }), mask: o.mask }))
            : lab.options;
          entry = { chosen: lab.chosen, correct: cell, candidates, x: kind === "stop" ? lab.x : null };
        }
        // setting the bot's own choice is a validation too
        entry = { id, kind, roll, turnId, verdict: entry.chosen === entry.correct ? "valid" : "wrong", ...entry, note: String(note || "").slice(0, 300), at: Date.now() };
        cases.push(entry);
        send("feedback", summary(entry));
      }
      retrain();
      res.json({ ok: true, learned });
    });

    // Forget the turns shown (the reviews and the learned weights stay).
    router.post("/clear-turns", (req, res) => {
      turns = [];
      send("turns-cleared", {});
      save();
      res.json({ ok: true });
    });

    router.post("/reset", (req, res) => {
      cases = [];
      send("feedback", { id: "*", verdict: "clear" });
      retrain();
      res.json({ ok: true });
    });

    app.use("/api/botlab", router);
  }

  return { attach, get cases() { return cases; }, get turns() { return turns; }, get learned() { return learned; } };
}
