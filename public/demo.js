//----------- COMBINATION DEMOS: THE PLAYER ---------------
// Plays a scripted turn (public/shared/demoScripts.js) in a small copy of
// the game screen: the same board, combination strip, dice and ROLL/DONE
// buttons, built from the game's own CSS classes and dressed with whatever
// the player has chosen (background, dice style, piece, colour). A finger
// moves to each control and taps it, and every step runs through the real
// engine, so what lights up is exactly what the game would light up.

import { updateGame } from "./shared/gameEngine.js";
import { createInitialGameState } from "./shared/utils.js";
import { dicePos } from "./shared/assets.js";
import { DEMOS } from "./shared/demoScripts.js";
import { t } from "./i18n.js";

const CORNERS = { "00": "tlc", "04": "trc", "40": "blc", "44": "brc" };
const STOP = Symbol("demo stopped");

let getVisuals = () => ({});
let overlay, dialog, board, rail, titleEl, captionEl, finger;
const els = { tiles: {}, results: [], calls: [], wraps: [], dice: [] };
let state = null;
let runId = 0;
let currentKey = null;
let opener = null;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initCombinationDemos(options) {
    getVisuals = options.getVisuals;
    build();
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-demo]");
        // detail 0: the click came from the keyboard (Enter/Space), not a
        // finger or the mouse.
        if (btn && DEMOS[btn.dataset.demo]) openDemo(btn.dataset.demo, btn, e.detail === 0);
    });
}

//--------- DOM ---------
function el(tag, className, parent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
}

// `shape`: the symbol's lines, drawn in opaque black; the group's opacity
// turns the whole symbol 75% black as one shape (see .demo-icon-btn svg).
function iconButton(className, label, shape) {
    const b = el("button", "demo-icon-btn " + className);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><g opacity=".75" fill="none" stroke="#000" stroke-width="3.79" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>`;
    return b;
}

function build() {
    overlay = el("div", "demo-overlay", document.body);
    overlay.hidden = true;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDemo(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) closeDemo(); });

    dialog = el("div", "demo-dialog", overlay);
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "demo-title");

    // The board: 25 tiles, each with the piece holder the real board uses.
    board = el("div", "div-table demo-board", dialog);
    board.setAttribute("aria-hidden", "true");
    const grid = el("div", "grid", board);
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const rc = `${r}${c}`;
            const t = el("div", "tile" + (CORNERS[rc] ? " " + CORNERS[rc] : ""), grid);
            const wrap = el("div", "wrapPiece", t);
            el("div", "piece", wrap);
            els.tiles[rc] = t;
        }
    }

    // Everything else sits in the rail: under the board in portrait, beside
    // it in landscape (see layout()).
    rail = el("div", "demo-rail", dialog);

    const head = el("div", "demo-head", rail);
    titleEl = el("h2", "title demo-title", head);
    titleEl.id = "demo-title";
    // Counter-clockwise arc with a rounded, filled arrowhead at the top.
    const replay = iconButton("demo-replay", "Play again",
        '<path d="M5.5 12A6.5 6.5 0 1 0 12.8 5.55"/><path d="M13 2.9 9 5.6 13 8.3z" fill="#000"/>');
    replay.addEventListener("click", () => play(currentKey));
    head.appendChild(replay);
    const close = iconButton("demo-close", "Close",
        '<path d="M6.8 6.8 17.2 17.2M17.2 6.8 6.8 17.2"/>');
    close.addEventListener("click", closeDemo);
    head.appendChild(close);

    const strip = el("div", "div-resultsAndCalls demo-strip", rail);
    strip.setAttribute("aria-hidden", "true");
    const results = el("div", "results", strip);
    const calls = el("div", "calls", strip);
    for (let i = 0; i < 8; i++) {
        els.results.push(el("div", "result" + (i >= 3 ? " selectable" : ""), results));
        els.calls.push(el("div", "call" + (i >= 3 ? " selectable" : ""), calls));
    }

    const dice = el("div", "div-dice demo-dice", rail);
    dice.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 5; i++) {
        const wrap = el("div", "wrapDie", dice);
        els.wraps.push(wrap);
        els.dice.push(el("div", "die", wrap));
    }

    const buttons = el("div", "div-buttons demo-buttons", rail);
    buttons.setAttribute("aria-hidden", "true");
    els.roll = el("div", "button roll", buttons);
    els.rollText = el("div", "text-button", els.roll);
    els.done = el("div", "button done", buttons);
    el("div", "text-button", els.done).textContent = t("DONE");

    // Karaoke-style captions: each step adds a line at the bottom and the
    // earlier ones scroll up, faded but still readable.
    captionEl = el("div", "demo-caption", rail);
    captionEl.setAttribute("role", "log");
    captionEl.setAttribute("aria-live", "polite");
    els.lines = el("div", "demo-lines", captionEl);

    finger = el("div", "demo-finger", dialog);
    finger.setAttribute("aria-hidden", "true");

    window.addEventListener("resize", () => { if (!overlay.hidden) layout(); });
}

//--------- open / close ---------
// Focus moves into the dialog (and back to the play button on close) only
// for keyboard users: a focus set from code shows the browser's focus ring
// even after a tap, which drew a black circle around X and play.
let openedByKeyboard = false;

function openDemo(key, from, byKeyboard) {
    opener = from || document.activeElement;
    openedByKeyboard = Boolean(byKeyboard);
    currentKey = key;
    overlay.hidden = false;
    dressLikeTheGame();
    layout();
    if (openedByKeyboard) dialog.querySelector(".demo-close").focus();
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    play(key);
}

function closeDemo() {
    runId++; // stops the running script at its next pause
    overlay.hidden = true;
    if (openedByKeyboard && opener && opener.focus) opener.focus();
}

// The player's own choices, read from the real game screen, so the demo
// looks like their game: background, dice style, tile symbols, strip icons,
// piece and highlight colour.
function dressLikeTheGame() {
    const bodyStyle = getComputedStyle(document.body);
    dialog.style.backgroundImage = bodyStyle.backgroundImage;
    dialog.style.backgroundColor = bodyStyle.backgroundColor;
    for (const rc in els.tiles) {
        const real = document.getElementById("t" + rc);
        els.tiles[rc].style.setProperty("--tile-img", getComputedStyle(real).getPropertyValue("--tile-img"));
    }
    els.results.forEach((r, i) => {
        r.style.backgroundImage = getComputedStyle(document.getElementById("rr" + i)).backgroundImage;
    });
    const realDie = document.getElementById("dd1");
    els.dice.forEach((d) => {
        d.style.backgroundImage = getComputedStyle(realDie).backgroundImage;
        d.classList.toggle("black-shadow", realDie.classList.contains("black-shadow"));
        d.classList.toggle("red-shadow", realDie.classList.contains("red-shadow"));
    });
}

// Board size S and rail width R from the space the screen gives: board over
// rail in portrait, side by side when that makes the board bigger.
function layout() {
    const pad = 12;
    const aw = Math.min(window.innerWidth, 1000) - 32;
    const ah = window.innerHeight - 32;
    const col = Math.min(aw - 2 * pad, (ah - 2 * pad - 200) / 1.53, 440);
    const row = Math.min((aw - 2 * pad - 16) / 1.85, ah - 2 * pad, 440);
    const isRow = row > col * 1.08 && row >= 250;
    const S = Math.floor(isRow ? row : col);
    const R = Math.floor(isRow ? S * 0.85 : S);
    dialog.classList.toggle("is-row", isRow);
    dialog.style.setProperty("--S", S + "px");
    dialog.style.setProperty("--R", R + "px");
}

//--------- playback ---------
function reset() {
    state = createInitialGameState();
    for (const rc in els.tiles) {
        const t = els.tiles[rc];
        t.classList.remove("tile_highlighted");
        t.style.outlineColor = "";
        const wrap = t.firstElementChild;
        wrap.classList.remove("img-bounce");
        wrap.style.opacity = "";
        wrap.firstElementChild.style.backgroundImage = "";
    }
    els.results.forEach((r) => r.classList.remove("highlighted"));
    els.calls.forEach((c) => c.classList.remove("checked"));
    els.dice.forEach((d) => {
        d.classList.remove("selected");
        d.style.backgroundPosition = dicePos[0];
    });
    els.rollText.textContent = t("ROLL {n}", { n: 3 });
    els.lines.textContent = "";
    finger.classList.remove("is-visible", "is-tapping");
}

async function play(key) {
    const id = ++runId;
    const demo = DEMOS[key];
    titleEl.textContent = demo.name;
    reset();
    const wait = (ms) => new Promise((resolve, reject) =>
        setTimeout(() => (id === runId ? resolve() : reject(STOP)), reducedMotion() ? Math.min(ms, 300) : ms));
    try {
        // Time to read a line before anything else happens: longer lines stay longer.
        const read = (line) => wait(Math.max(1100, t(line).length * 50));
        await wait(500);
        for (const step of demo.steps) {
            // What the player is about to do, read before the finger moves...
            addCaption(step.say);
            await read(step.say);
            if (step.roll) await doRoll(step.roll, wait);
            else if (step.keep) await doKeep(step.keep, wait);
            else if (step.call !== undefined) await doCall(step.call, wait);
            else if (step.place) await doPlace(step.place, wait);
            else if (step.done) await doDone(wait);
            // ...and what the dice made, only once they have stopped.
            const results = [].concat(step.then || []);
            for (const line of results) {
                addCaption(line);
                await read(line);
            }
            if (!results.length) await wait(600);
        }
        finger.classList.remove("is-visible");
    } catch (err) {
        if (err !== STOP) throw err;
    }
}

// The lines sit at the bottom of the caption box, which the player can
// scroll by hand to reread. A new line follows the bottom only if the box
// was already there -- someone scrolled up to reread isn't pulled away.
// The jump to the bottom is instant (a smooth scroll can stop halfway) and
// the slide is drawn FLIP-style instead: the stack is moved back to where
// it was and eased into place, so if that animation doesn't run
// (background tab, reduced motion) the lines are still in the right place.
function addCaption(text) {
    const box = captionEl;
    const stack = els.lines;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 8;
    const before = stack.getBoundingClientRect().top;
    stack.querySelectorAll(".is-current").forEach((line) => line.classList.remove("is-current"));
    const line = el("p", "demo-line is-current", stack);
    line.textContent = t(text);
    if (!atBottom) return;
    box.scrollTop = box.scrollHeight;
    const delta = before - stack.getBoundingClientRect().top;
    if (delta && !reducedMotion()) {
        stack.style.transition = "none";
        stack.style.transform = `translateY(${delta}px)`;
        void stack.offsetHeight;
        stack.style.transition = "";
        stack.style.transform = "";
    }
}

// Moves the finger onto `target` and taps it.
async function tap(target, wait) {
    const d = dialog.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    finger.style.setProperty("--x", `${t.left - d.left + t.width / 2}px`);
    finger.style.setProperty("--y", `${t.top - d.top + t.height * 0.55}px`);
    finger.classList.add("is-visible");
    await wait(480);
    finger.classList.add("is-tapping");
    await wait(150);
    finger.classList.remove("is-tapping");
}

// The same press a real finger gives a button in the game (.is-pressed in
// linotte.css): it sinks and darkens, then springs back.
function press(button) {
    button.classList.add("is-pressed");
    setTimeout(() => button.classList.remove("is-pressed"), 150);
}

function showRoll() {
    els.dice.forEach((d, i) => { d.style.backgroundPosition = dicePos[state.dice.values[i]]; });
    els.results.forEach((r, i) => r.classList.toggle("highlighted", Boolean(state.combinationsRealized[i])));
    const color = getVisuals().color || "#ff0000";
    for (const rc in els.tiles) {
        const on = state.possibleMoves[Number(rc[0])][Number(rc[1])] === 1;
        els.tiles[rc].classList.toggle("tile_highlighted", on);
        els.tiles[rc].style.outlineColor = on ? color : "";
    }
}

async function doRoll(values, wait) {
    await tap(els.roll, wait);
    press(els.roll);
    updateGame(state, { type: "ROLL_DICE", values });
    els.rollText.textContent = t("ROLL {n}", { n: state.dice.rollsLeft });
    els.results.forEach((r) => r.classList.remove("highlighted"));
    for (const rc in els.tiles) els.tiles[rc].classList.remove("tile_highlighted");
    finger.classList.remove("is-visible");
    // Same tumble as a real roll: kept dice stay put, the rest flicker.
    for (let i = 0; i < 9; i++) {
        els.dice.forEach((d, j) => {
            if (!state.dice.locked[j]) d.style.backgroundPosition = dicePos[1 + Math.floor(Math.random() * 6)];
        });
        await wait(100);
    }
    updateGame(state, { type: "STOP_ROLL" });
    showRoll();
}

async function doKeep(indexes, wait) {
    for (const i of indexes) {
        await tap(els.dice[i], wait);
        const locked = state.dice.locked.slice();
        locked[i] = true;
        updateGame(state, { type: "LOCK_DICE", locked });
        els.dice[i].classList.add("selected");
        await wait(200);
    }
}

async function doCall(index, wait) {
    await tap(els.results[index], wait);
    const called = [null, null, null, 0, 0, 0, 0, 0];
    called[index] = 1;
    updateGame(state, { type: "SELEC_CALL", called });
    els.calls[index].classList.add("checked");
}

async function doPlace(rc, wait) {
    const t = els.tiles[rc];
    await tap(t, wait);
    const wrap = t.firstElementChild;
    const image = getVisuals().pieceImage;
    if (image) wrap.firstElementChild.style.backgroundImage = `url('${image}')`;
    wrap.classList.add("img-bounce");
    wrap.addEventListener("animationend", () => {
        wrap.style.opacity = "1";
        wrap.classList.remove("img-bounce");
    }, { once: true });
    updateGame(state, { type: "PLACE_PIECE", coordinates: rc, player: 1 });
}

async function doDone(wait) {
    await tap(els.done, wait);
    press(els.done);
    updateGame(state, { type: "END_TURN" });
    for (const rc in els.tiles) els.tiles[rc].classList.remove("tile_highlighted");
    els.results.forEach((r) => r.classList.remove("highlighted"));
    els.calls.forEach((c) => c.classList.remove("checked"));
    els.dice.forEach((d) => {
        d.classList.remove("selected");
        d.style.backgroundPosition = dicePos[0];
    });
    els.rollText.textContent = t("ROLL {n}", { n: 3 });
}
