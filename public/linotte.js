//Version 
const VERSION = "2.6.1";
document.getElementById("version").innerHTML += VERSION;

// open
// http://127.0.0.1:5500/public/index.html

//To install web app
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
        .then(() => console.log("SW registered"))
        .catch(err => console.error(err));
}

// const socket = io();

const boxPlayer1 = document.getElementById("playerP1");
const boxPlayer2 = document.getElementById("playerP2");
const textPlayerP1 = document.getElementById("textPlayerP1");
const textPlayerP2 = document.getElementById("textPlayerP2");
const pawnP1Text = document.getElementById("pawnP1Text");
const pawnP2Text = document.getElementById("pawnP2Text");
const coinP1Text = document.getElementById("coinP1Text");
const coinP2Text = document.getElementById("coinP2Text");


const t00 = document.getElementById("t00");
const t01 = document.getElementById("t01");
const t02 = document.getElementById("t02");
const t03 = document.getElementById("t03");
const t04 = document.getElementById("t04");
const t10 = document.getElementById("t10");
const t11 = document.getElementById("t11");
const t12 = document.getElementById("t12");
const t13 = document.getElementById("t13");
const t14 = document.getElementById("t14");
const t20 = document.getElementById("t20");
const t21 = document.getElementById("t21");
const t22 = document.getElementById("t22");
const t23 = document.getElementById("t23");
const t24 = document.getElementById("t24");
const t30 = document.getElementById("t30");
const t31 = document.getElementById("t31");
const t32 = document.getElementById("t32");
const t33 = document.getElementById("t33");
const t34 = document.getElementById("t34");
const t40 = document.getElementById("t40");
const t41 = document.getElementById("t41");
const t42 = document.getElementById("t42");
const t43 = document.getElementById("t43");
const t44 = document.getElementById("t44");
const tileElements = [t00, t01, t02, t03, t04, t10, t11, t12, t13, t14, t20, t21, t22, t23, t24, t30, t31, t32, t33, t34, t40, t41, t42, t43, t44];

const dd1 = document.getElementById("dd1");
const dd2 = document.getElementById("dd2");
const dd3 = document.getElementById("dd3");
const dd4 = document.getElementById("dd4");
const dd5 = document.getElementById("dd5");
const ddElements = [dd1, dd2, dd3, dd4, dd5];

const wd1 = document.getElementById("wd1");
const wd2 = document.getElementById("wd2");
const wd3 = document.getElementById("wd3");
const wd4 = document.getElementById("wd4");
const wd5 = document.getElementById("wd5");
const wdElements = [wd1, wd2, wd3, wd4, wd5];

const rr0 = document.getElementById("rr0");
const rr1 = document.getElementById("rr1");
const rr2 = document.getElementById("rr2");
const rr3 = document.getElementById("rr3");
const rr4 = document.getElementById("rr4");
const rr5 = document.getElementById("rr5");
const rr6 = document.getElementById("rr6");
const rr7 = document.getElementById("rr7");
const rrElements = [rr0, rr1, rr2, rr3, rr4, rr5, rr6, rr7];

const cc0 = document.getElementById("cc0");
const cc1 = document.getElementById("cc1");
const cc2 = document.getElementById("cc2");
const cc3 = document.getElementById("cc3");
const cc4 = document.getElementById("cc4");
const cc5 = document.getElementById("cc5");
const cc6 = document.getElementById("cc6");
const cc7 = document.getElementById("cc7");
const ccElements = [cc0, cc1, cc2, cc3, cc4, cc5, cc6, cc7];

const rollBtn = document.getElementById("rollBtn");
const doneBtn = document.getElementById("doneBtn");
const openBtn = document.getElementById("options");
const rollBtnText = document.querySelector("#rollBtn .text-button");

const body = document.getElementById("body");
const modal = document.getElementById("modal");
const optionsOverlay = document.getElementById("options-overlay");
const optBg = document.getElementById("opt-bg");

let LOCAL_PLAYER = null;
let rollAnimationID;
let stopRollID;
let rollBtnEnabled = true;
let doneBtnEnabled = true;
let pieceEnabled = true;
let isGameOver = false;
// Guards playEndGameSequence against running twice for the same game --
// see its own comment for why that could otherwise happen and cut the
// celebration short.
let endGameSequenceStarted = false;

function setRealVh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setRealVh();
window.addEventListener('resize', setRealVh);
window.addEventListener('orientationchange', setRealVh);




//----------- GAME STATE ---------------
import { createInitialGameState, urlOf, rndNum, idToCoo, matrixCheck, matrixFill, toBoolean, preload, idToIndex } from "./shared/utils.js";
import { dicePath, diceFaces, dicePos, diceNames, bgPath, backgrounds, piecesPath, pieces } from "./shared/assets.js";
import { updateGame } from "./shared/gameEngine.js";
import { chooseDiceToLock, shouldStopRolling, chooseBestMove, chooseCallToMake, explainPlacement, explainTarget } from "./shared/botAI.js";
import GameController from './shared/gameController.js';
import { playFairyTrail } from "./shared/fairyTrail.js";
let gameState = createInitialGameState();
gameState.players[1].name = "YOU";
gameState.players[2].name = "BOT";




//----------- GAME CONTROLLER ---------------
let controller;
let botStrategy = "points";
startBot(botStrategy); // default to player-vs-bot, ready to play on open --
// silently discarded the moment a real mode is chosen on the home screen
// below (newGameVsBot/newGameOffline fully reset gameState), so it never
// needs to be "correct", just non-crashing while the home screen sits on
// top of it (z-index 60, covers the whole viewport).

// Shown on load (see index.html) so a fresh visit always lands on a mode
// choice instead of straight into that default bot game above. Hidden via
// a direct style.display write, not a class toggle -- this element is
// never shown again after the first choice, so there's no ".hidden" state
// to manage or any cascade-order risk to worry about (see the CSS
// comment on .flip-coin-overlay.hidden for why that distinction mattered
// there).
function hideHomeScreen() {
    document.getElementById("home-overlay").style.display = "none";
}

function startOffline() {
    controller = new GameController("offline");
    controller.setState(gameState);
}

function startOnline() {
    controller = new GameController("online", socket);
    controller.setState(gameState);
}

function startBot(strategy = "points") {
    botStrategy = strategy;
    LOCAL_PLAYER = 1;
    controller = new GameController("bot");
    controller.setState(gameState);
}




//------ PLAYERS ---------------

// Minimum colorDistance (see below) the two random player colors must
// clear. Picked by checking every pair in the palette: 120 cleanly
// separates near-duplicate pairs (two identical greens, two near-identical
// dark browns, ~0-50) from genuinely distinct shades of the same family
// (e.g. a mid green vs an olive green, ~150+) -- exactly "two greens are
// fine if they're far enough apart" -- while still leaving every color at
// least ~27 of the other 36 as valid partners, so the fallback in
// assignRandomPieces is essentially never needed in practice. Declared as
// a const, so it has to come before assignRandomPieces(gameState) is
// actually called below (a const isn't hoisted the way a function
// declaration is).
const MIN_PLAYER_COLOR_DISTANCE = 120;

assignRandomPieces(gameState);

const selectedColor = [null, gameState.players[1].color, gameState.players[2].color];
applyPlayerVisuals();
renderPlayerBox(gameState.currentPlayer);
renderPieceCounts();
renderPointCounts();

// "redmean" approximate perceptual distance between two RRGGBB colors
// (no leading '#') -- a well-known, cheap way to weigh a plain RGB
// difference closer to how the eye actually perceives it, without pulling
// in a full color-space conversion.
function colorDistance(hexA, hexB) {
    const r1 = parseInt(hexA.slice(0, 2), 16);
    const g1 = parseInt(hexA.slice(2, 4), 16);
    const b1 = parseInt(hexA.slice(4, 6), 16);
    const r2 = parseInt(hexB.slice(0, 2), 16);
    const g2 = parseInt(hexB.slice(2, 4), 16);
    const b2 = parseInt(hexB.slice(4, 6), 16);
    const rmean = (r1 + r2) / 2;
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt((2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db);
}

function assignRandomPieces(state) {
    const p1p = rndNum(8, pieces.length - 1);
    state.players[1].pieceImage = piecesPath + pieces[p1p];
    state.players[1].color = "#" + state.players[1].pieceImage.split("_")[1].slice(0, 6);

    const p1Hex = state.players[1].color.slice(1);
    const otherIndices = [];
    for (let i = 8; i < pieces.length; i++) {
        if (i !== p1p) otherIndices.push(i);
    }
    const distinctEnough = otherIndices.filter(
        (i) => colorDistance(p1Hex, pieces[i].split("_")[1].slice(0, 6)) >= MIN_PLAYER_COLOR_DISTANCE
    );
    // Fall back to "just a different piece" only if literally nothing in
    // the palette clears the bar for this particular color -- shouldn't
    // happen with the current palette, but never leaves player 2 without
    // a pick.
    const pool = distinctEnough.length > 0 ? distinctEnough : otherIndices;
    const p2p = pool[rndNum(0, pool.length - 1)];

    state.players[2].pieceImage = piecesPath + pieces[p2p];
    state.players[2].color = "#" + state.players[2].pieceImage.split("_")[1].slice(0, 6);
}

function applyPlayerVisuals() {
    selectedColor[1] = gameState.players[1].color;
    selectedColor[2] = gameState.players[2].color;
    preload(gameState.players[1].pieceImage);
    preload(gameState.players[2].pieceImage);
    boxPlayer1.style.backgroundColor = gameState.players[1].color;
    boxPlayer2.style.backgroundColor = gameState.players[2].color;
}

//clearForNextTurn();
// divsOpacity(gameState.currentPlayer);


function isMyTurn() {
    if (controller.mode === "offline") return true;
    if (controller.mode === "bot") return gameState.currentPlayer === 1;
    return gameState.currentPlayer === LOCAL_PLAYER;
}


function renderPlayerBox(player) {
    if (player === 1) {
        document.getElementsByClassName("player p1")[0].style.setProperty("--glow", gameState.players[1].color);
        document.getElementsByClassName("player p2")[0].style.boxShadow = "black 0px 0px 0px 0px";
        document.getElementsByClassName("player p1")[0].classList.add("current");
        document.getElementsByClassName("player p2")[0].classList.remove("current");
    } else {
        document.getElementsByClassName("player p2")[0].style.setProperty("--glow", gameState.players[2].color);
        document.getElementsByClassName("player p1")[0].style.boxShadow = "black 0px 0px 0px 0px";
        document.getElementsByClassName("player p2")[0].classList.add("current");
        document.getElementsByClassName("player p1")[0].classList.remove("current");
    }

    textPlayerP1.textContent = gameState.players[1].name;
    textPlayerP2.textContent = gameState.players[2].name;
}

// Restarts a CSS animation on `el` even if it's already mid-play (e.g. two
// points scored in quick succession) by forcing a reflow between removing
// and re-adding the class -- same trick as jumpPiece(). `className`
// defaults to the plain pop, but pieces use a more emphatic one (see its
// own comment) since they have no other visual cue -- no trail, no "+N" --
// to draw the eye the way a scored point does.
function popStat(el, className = "stat-pop") {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    el.addEventListener("animationend", () => el.classList.remove(className), { once: true });
}

// Updates the remaining-pieces numbers. Called right after END_TURN
// commits the placement -- before any fairy trail line plays, so the
// piece count pops immediately, matching when the piece itself actually
// landed on the board. `before` (this player's counts right before
// END_TURN) is omitted for the initial render, where there's nothing to
// compare against and no pop should play.
function renderPieceCounts(before) {
    if (!before) {
        pawnP1Text.textContent = gameState.players[1].remainingPieces;
        pawnP2Text.textContent = gameState.players[2].remainingPieces;
        return;
    }
    if (gameState.players[1].remainingPieces !== before.pieces[1]) tickStat(pawnP1Text, gameState.players[1].remainingPieces);
    if (gameState.players[2].remainingPieces !== before.pieces[2]) tickStat(pawnP2Text, gameState.players[2].remainingPieces);
}

// A counter/odometer-style tick: the old value slides up and out while a
// clone of the new value slides in from below to take its place, rather
// than the number just popping in place. The "old value" side needs an
// actual temporary clone (a single text node can't slide two different
// values past each other at once) positioned exactly over the live
// element via its own bounding rect, same trick as showPlusPopup.
function tickStat(el, newValue) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const outgoing = document.createElement("div");
    outgoing.className = "stat-tick-out";
    outgoing.textContent = el.textContent;
    outgoing.style.left = rect.left + "px";
    outgoing.style.top = rect.top + "px";
    outgoing.style.width = rect.width + "px";
    outgoing.style.height = rect.height + "px";
    outgoing.style.font = cs.font;
    outgoing.style.color = cs.color;
    document.body.appendChild(outgoing);
    outgoing.addEventListener("animationend", () => outgoing.remove(), { once: true });

    el.textContent = newValue;
    el.classList.remove("stat-tick-in");
    void el.offsetWidth;
    el.classList.add("stat-tick-in");
    el.addEventListener("animationend", () => el.classList.remove("stat-tick-in"), { once: true });
}

// Plain, unanimated points render -- only for the initial page load and a
// fresh game, where there's no prior value to animate from and nothing to
// celebrate yet. Once a game is underway, celebratePoints() (below) is
// what actually moves the number.
function renderPointCounts() {
    coinP1Text.textContent = gameState.players[1].points;
    coinP2Text.textContent = gameState.players[2].points;
}

// The last cell of the last fairy trail line that just played -- where the
// board-side sparkle trail left off, and so where its continuation onward
// to a player's points counter (see celebratePoints) should pick up from.
// The last cell of the last line played, and the direction the trail was
// already moving in when it got there (from the second-to-last cell, if
// there is one) -- so its continuation off the board (see celebratePoints)
// can leave in that same direction before bending, instead of the curve
// starting to bend from the very first pixel off the tile.
function lastPlayedExit(lines) {
    if (lines.length === 0) return null;
    const lastLine = lines[lines.length - 1];
    const cell = lastLine[lastLine.length - 1];
    let dir = { x: 0, y: -1 }; // fallback: straight up, if the line was only 1 cell
    if (lastLine.length >= 2) {
        const prev = cellScreenCenter(...lastLine[lastLine.length - 2]);
        const pos = cellScreenCenter(...cell);
        const dx = pos.x - prev.x, dy = pos.y - prev.y;
        const d = Math.hypot(dx, dy) || 1;
        dir = { x: dx / d, y: dy / d };
    }
    return { cell, dir };
}

function cellScreenCenter(r, c) {
    const rect = document.getElementById(`t${r}${c}`).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: Math.min(rect.width, rect.height) };
}

// A handful of points sampled along the quadratic curve from `start` to
// `end`, for a fairy trail path that arcs like a natural toss instead of
// cutting straight there -- playFairyTrail just connects whatever points
// it's given, so feeding it points already curved is enough to bend the
// whole trail without touching its own (deliberately straight-segment)
// board-tile logic at all. The control point is pushed up and out to the
// side, scaled to the hop's own distance so it looks proportionate
// whether the counter is right next to the board or clear across it.
function curvedPath(start, end, exitDir, segments = 8) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Big enough to read as a clear swoop even on a short hop or a fast
    // 500ms travel -- an earlier 0.35x/60px-floor version was correct on
    // paper but visually indistinguishable from a straight line.
    const bend = Math.max(110, dist * 0.6);
    // A CUBIC curve (two control points), not a quadratic one (one control
    // point) -- a quadratic bezier's deviation from the straight start-end
    // line is proportional to t(1-t), which is mathematically ALWAYS
    // symmetric no matter where its single control point sits, so it can
    // only ever bend evenly across the whole hop, never lopsidedly.
    //
    // The first control point sits straight out along `exitDir` (the
    // direction the board trail was already moving in) -- a cubic bezier's
    // tangent at t=0 points directly at c1, so this is what makes the
    // trail leave the line continuing the same way it was already going,
    // instead of snapping sideways the instant it clears the last tile.
    const exitDist = Math.min(dist * 0.4, 150);
    const c1 = { x: start.x + exitDir.x * exitDist, y: start.y + exitDir.y * exitDist };
    // The second control point pulls the tail end toward `end`, so once
    // clear of the board the trail bends the rest of the way to the points
    // counter instead of carrying on straight forever.
    const sideways = dx >= 0 ? -1 : 1; // arc away from the direction of travel, not through it
    const nx = (dy / dist) * sideways;
    const c2 = { x: start.x + dx * 0.75 + nx * bend * 0.25, y: start.y + dy * 0.75 - bend * 0.25 };
    const startSize = start.size ?? end.size;
    const endSize = end.size ?? start.size;
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const it = 1 - t;
        points.push({
            x: it * it * it * start.x + 3 * it * it * t * c1.x + 3 * it * t * t * c2.x + t * t * t * end.x,
            y: it * it * it * start.y + 3 * it * it * t * c1.y + 3 * it * t * t * c2.y + t * t * t * end.y,
            // Shrinks from the board tile's own size down to the (much
            // smaller) UI counter's size as it travels, rather than being
            // pinned to the tiny end size for the whole hop.
            size: startSize + (endSize - startSize) * t,
        });
    }
    return points;
}

// How long the trail's extra hop off the board, onto a points counter,
// takes -- independent of tunables.travelMsPerSegment, which is tuned for
// board-tile-sized gaps, not a much longer dash across the whole UI.
const POINTS_HOP_MS = 500;

// Called once every fairy trail line for this turn has actually finished
// playing (see performEndTurn/playEndGameSequence) -- `lines` is exactly
// what was just played, so its last cell is where the board-side
// celebration left off. For each player whose points increased, the SAME
// trail keeps going from there onward to that player's points counter
// (playFairyTrail accepts a literal {x,y} point alongside board [r,c]
// cells, see its own comment) -- no separate flying element, just the
// trail's own sparkles continuing the journey. The counter itself only
// updates -- number change, pop, and the "+N" -- once that hop actually
// lands, not the instant the board-side trail stops.
function celebratePoints(lines, before, onAllArrived) {
    const scorers = [1, 2].filter((p) => gameState.players[p].points > before.points[p]);
    if (scorers.length === 0) {
        if (onAllArrived) onAllArrived(); // nothing changed; the number is already showing the right value
        return;
    }
    const exit = lastPlayedExit(lines);
    const startPos = cellScreenCenter(...exit.cell);
    let stillFlying = scorers.length;
    scorers.forEach((p) => {
        const el = p === 1 ? coinP1Text : coinP2Text;
        const delta = gameState.players[p].points - before.points[p];
        const rect = el.getBoundingClientRect();
        const target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: Math.max(rect.width, rect.height) };
        const path = curvedPath(startPos, target, exit.dir);
        playFairyTrail(path, {
            travelMs: POINTS_HOP_MS,
            onDone: () => {
                el.textContent = gameState.players[p].points;
                popStat(el);
                showPlusPopup(el, delta);
                if (--stillFlying === 0 && onAllArrived) onAllArrived();
            },
        });
    });
}

// A "+N" that pops up right at the points number and rises/fades in
// place -- the trail itself (see celebratePoints) is what visually
// travels there, so this just needs to announce arrival, not travel too.
function showPlusPopup(anchorEl, amount) {
    const rect = anchorEl.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.className = "stat-plus-popup";
    popup.textContent = "+" + amount;
    popup.style.left = (rect.left + rect.width / 2) + "px";
    popup.style.top = rect.top + "px";
    document.body.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
}


//----------- COOKIES ---------------
let tidyness = getCookie("tidyness", 2);
document.getElementById("bo" + tidyness).classList.add("selected"); //option section
renderTidyness(tidyness);

let dieCookie = getCookie("diceFaces", 3);
document.getElementById("do" + dieCookie).classList.add("selected"); //option section
document.getElementById("dice-title").textContent = diceNames[dieCookie];
let faces = diceFaces[dieCookie];  //faces of the selected die

let selectedDie = dicePath + faces;
preload(selectedDie);

let selectedBg = getCookie("background", 4);
document.getElementById("bg" + selectedBg).classList.add("selected"); //option section
document.getElementById("bg-title").textContent = backgrounds[selectedBg].slice(0, -4);
for (let i = 0; i < backgrounds.length; i++) {
    preload(bgPath + backgrounds[i]);
}
body.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);
optBg.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);
modal.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);

let isVolumeOn = true;
isVolumeOn = toBoolean(getCookie("volumeOn", "true"));
if (isVolumeOn == true) {
    document.getElementById("sound-on").classList.add("selected");
} else {
    document.getElementById("sound-off").classList.add("selected");
}


function setCookie(name, value, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);

    document.cookie =
        name + "=" + encodeURIComponent(value) +
        ";expires=" + d.toUTCString() +
        ";path=/";
}


function getCookie(name, defaultValue) {
    const cookies = document.cookie.split("; ");
    for (const c of cookies) {
        const [key, value] = c.split("=");
        if (key === name) {
            const cookieValue = decodeURIComponent(value);
            if (cookieValue == "undefined") {
                setCookie(name, defaultValue);
                return defaultValue;
            } else {
                return cookieValue;
            }
        }
    }
    setCookie(name, defaultValue);
    return defaultValue;
}




//----------- TIMER -----------------
const MAX_TIMER = 60;
let value = MAX_TIMER;
let timerId = null;

function flip(tile, newVal) {
    const top = tile.querySelector(".top span");
    const bottom = tile.querySelector(".bottom span");
    if (top.textContent === newVal) return;

    const oldVal = top.textContent;

    const topFlip = tile.querySelector(".top").cloneNode(true);
    const bottomFlip = tile.querySelector(".bottom").cloneNode(true);

    topFlip.querySelector("span").textContent = oldVal;
    bottomFlip.querySelector("span").textContent = newVal;

    topFlip.classList.add("flipTop");
    bottomFlip.classList.add("flipBottom");

    tile.appendChild(topFlip);
    tile.appendChild(bottomFlip);

    top.textContent = newVal;

    setTimeout(() => {
        topFlip.remove();
        bottomFlip.remove();
        bottom.textContent = newVal;
    }, 300);
}

function tick() {
    const [t, u] = String(value).padStart(2, "0").split("");
    flip(document.getElementById("tens"), t);
    flip(document.getElementById("units"), u);
    if (value === 0) {
        timerId = null;
        doneBtnEnabled = true;
        doneButton();
        return;
    }
    value--;
    timerId = setTimeout(tick, 1000);
}

function startTurnTimer() {
    value = MAX_TIMER;
    if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
    }
    startTimer();
}

function startTimer() {
    if (timerId !== null) return;
    tick();
}

function stopTimer() {
    if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    startTurnTimer();
});




//----------- DICE TABLE AND GAME -----------------
let prewPiece = null;
let selectedTileId = null;

rollBtnEnabled = true;
doneBtnEnabled = true;
pieceEnabled = true;

renderDiceFace(dieCookie);
document.querySelectorAll(".die").forEach(el => {
    el.style.backgroundPosition = dicePos[0];
});

function renderDiceFace(id) {
    document.querySelectorAll(".die").forEach(el => {
        el.style.backgroundImage = `url(${selectedDie})`;
    });

    document.querySelectorAll(".die").forEach(el => {
        el.classList.remove("black-shadow", "red-shadow");
    });

    if (id == 0 || id == 1 || id == 4 || id == 5) {
        document.querySelectorAll(".die").forEach(el => {
            el.classList.add("black-shadow");
        });
    }
    if (id == 2) {
        document.querySelectorAll(".die").forEach(el => {
            el.classList.add("red-shadow");
        });
    }
}





//----------- OPTIONS OVERLAY -----------------
openBtn.onclick = () => {
    optionsOverlay.classList.remove("hidden");
    handleTab("options");
    centerLists();
}

optionsOverlay.addEventListener("click", (e) => {
    if (e.target === optionsOverlay) {
        optionsOverlay.style.display = "none";
    }
});

document.querySelectorAll(".icon").forEach(icon => {
    icon.onclick = () => {
        if (icon.classList.contains("disabled")) return;

        handleTab(icon.dataset.page);
    };
});

function handleTab(page) {
    if (page === "back") {
        optionsOverlay.classList.add("hidden");
        return;
    }

    // cambia pagina
    document.querySelectorAll(".opt-page").forEach(p => p.classList.add("hidden"));
    document.getElementById("page-" + page).classList.remove("hidden");

    moveIndicator(page);
}

function moveIndicator(page) {
    const rect1 = document.getElementById("icon-tab1").getBoundingClientRect();
    const rect2 = document.getElementById("icon-tab2").getBoundingClientRect();
    const rect3 = document.getElementById("icon-tab3").getBoundingClientRect();

    const map = {
        game: rect1.left - 10,
        options: rect2.left - 10,
        help: rect3.left - 10
    };
    document.getElementById("tabIndicator").style.left = map[page] + "px";
}


const volumeOptions = document.querySelectorAll(".sound-btn");
volumeOptions.forEach(volumeOption => {
    volumeOption.addEventListener("click", () => {
        volumeOptions.forEach(t => t.classList.remove("selected"));
        volumeOption.classList.add("selected");

        if (volumeOption.id == "sound-off") {
            isVolumeOn = false;
        } else {
            isVolumeOn = true;
        }
        setCookie("volumeOn", isVolumeOn);
    });
});


const boardOptions = document.querySelectorAll(".board-options");
boardOptions.forEach(boardOption => {
    boardOption.addEventListener("click", () => {
        boardOptions.forEach(t => t.classList.remove("selected"));
        boardOption.classList.add("selected");
        tidyness = Number(boardOption.id[2]);
        renderTidyness(tidyness);
        setCookie("tidyness", tidyness);
    });
});


//----------- COIN FLIP (decides who starts a new game) ---------------
// Returns a Promise<1|2> — which player goes first. nameP1/nameP2 are
// plain strings for the result text ("YOU"/"BOT", "P1"/"P2", ...) rather
// than read from gameState, since the caller flips BEFORE resetting
// gameState for the new game (the old one may still hold stale names, or
// none at all on the very first load).
function flipCoin(nameP1, nameP2) {
    return new Promise((resolve) => {
        const overlay = document.getElementById("coin-flip-overlay");
        const coin = document.getElementById("flip-coin");
        const resultText = document.getElementById("coin-result-text");

        resultText.textContent = "";
        overlay.classList.remove("hidden");

        const winner = Math.random() < 0.5 ? 1 : 2; // 1 = front face lands up, 2 = back face
        const spins = 5; // extra full turns before landing, purely for a satisfying flip
        const finalDeg = spins * 360 + (winner === 2 ? 180 : 0);

        coin.style.transform = "rotateY(0deg)";
        void coin.offsetWidth; // force a reflow so the reset above is committed before animating

        const animation = coin.animate(
            [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${finalDeg}deg)` }],
            { duration: 1400, easing: "cubic-bezier(.2,.6,.25,1)", fill: "forwards" }
        );

        animation.onfinish = () => {
            resultText.textContent = `${winner === 1 ? nameP1 : nameP2} starts!`;
            setTimeout(() => {
                overlay.classList.add("hidden");
                resolve(winner);
            }, 900);
        };
    });
}

// The pre-existing "FLIP" button (.opt-btn.flipped, no id) is reserved
// for a different, not-yet-built feature -- PLAY is this session's own
// button for starting a same-table game, coin flip included.
document.getElementById("play-offline-btn").addEventListener("click", () => {
    flipCoin("P1", "P2").then((startingPlayer) => {
        newGameOffline(startingPlayer);
        hideHomeScreen();
        handleTab("back");
    });
});

document.getElementById("home-play-btn").addEventListener("click", () => {
    flipCoin("P1", "P2").then((startingPlayer) => {
        newGameOffline(startingPlayer);
        hideHomeScreen();
    });
});


//----------- AI OPPONENT ---------------
// .bot-strategy matches both the options-overlay's own POINTS/SPEED
// buttons AND the home screen's (see index.html) -- one shared handler
// for both, since starting a new bot game means the exact same thing
// regardless of which of the two identical-looking buttons was clicked.
const botStrategyButtons = document.querySelectorAll(".bot-strategy");
botStrategyButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        botStrategyButtons.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");

        flipCoin("YOU", "BOT").then((startingPlayer) => {
            newGameVsBot(btn.dataset.strategy, startingPlayer);
            hideHomeScreen();
            handleTab("back");
        });
    });
});

function newGameVsBot(strategy, startingPlayer = 1) {
    gameState = createInitialGameState();
    gameState.currentPlayer = startingPlayer;
    gameState.players[1].name = "YOU";
    gameState.players[2].name = "BOT";
    assignRandomPieces(gameState);

    startBot(strategy);
    rollBtnEnabled = true;
    doneBtnEnabled = true;
    isGameOver = false;
    endGameSequenceStarted = false;
    document.getElementById("winner-overlay").style.display = "none";

    clearBoardVisuals();
    clearForNextTurn();
    applyPlayerVisuals();
    renderPlayerBox(gameState.currentPlayer);
    renderPieceCounts();
    renderPointCounts();
    divsOpacity(gameState.currentPlayer);

    if (gameState.currentPlayer === 2) {
        playBotTurn(); // the coin flip picked the bot to go first
    } else {
        startTurnTimer();
    }
}

// "Same table" hotseat: two people share this device and take turns as
// P1/P2 -- see isMyTurn()'s "offline" branch, which never dims/disables
// either side's controls since there's only one local player either way.
function newGameOffline(startingPlayer = 1) {
    gameState = createInitialGameState();
    gameState.currentPlayer = startingPlayer;
    gameState.players[1].name = "P1";
    gameState.players[2].name = "P2";
    assignRandomPieces(gameState);

    startOffline();
    rollBtnEnabled = true;
    doneBtnEnabled = true;
    isGameOver = false;
    endGameSequenceStarted = false;
    document.getElementById("winner-overlay").style.display = "none";

    clearBoardVisuals();
    clearForNextTurn();
    applyPlayerVisuals();
    renderPlayerBox(gameState.currentPlayer);
    renderPieceCounts();
    renderPointCounts();
    divsOpacity(gameState.currentPlayer);
    startTurnTimer();
}

function clearBoardVisuals() {
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const piece = document.getElementById("p" + r + c);
            if (!piece) continue;
            piece.style.backgroundImage = "";
            const wrapper = piece.parentElement;
            wrapper.classList.remove("img-bounce", "img-disappear");
        }
    }
}


const dieOptions = document.querySelectorAll(".die-options");
dieOptions.forEach(dieOption => {
    dieOption.addEventListener("click", () => {
        dieOptions.forEach(t => t.classList.remove("selected"));
        dieOption.classList.add("selected");

        var dieId = Number(dieOption.id[2]);
        document.getElementById("dice-title").textContent = diceNames[dieId];
        faces = diceFaces[dieId];
        selectedDie = dicePath + faces;
        const diceSpriteImg = new Image();
        diceSpriteImg.src = selectedDie;
        setCookie("diceFaces", dieId);
        renderDiceFace(dieId);
    });
});


const bgOptions = document.querySelectorAll(".bg-options");
bgOptions.forEach(bgOption => {
    bgOption.addEventListener("click", () => {
        bgOptions.forEach(t => t.classList.remove("selected"));
        bgOption.classList.add("selected");

        var bgId = Number(bgOption.id[2]);
        document.getElementById("bg-title").textContent = backgrounds[bgId].slice(0, -4);

        body.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
        optBg.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
        modal.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
        setCookie("background", bgId);
    });
});


function renderTidyness(tidyness) {
    const boardTitle = document.getElementById("board-title");
    const boardTexts = document.querySelectorAll('.board-options-text');
    boardTexts.forEach(t => t.classList.remove('selected'));

    if (tidyness == 0) { boardTitle.textContent = "Perfect"; }
    if (tidyness == 1) { boardTitle.textContent = "Tidy"; }
    if (tidyness == 2) { boardTitle.textContent = "Natural"; }

    document.querySelectorAll(".piece").forEach(el => {
        applyTidyness(el);
    });
}


function applyTidyness(element) {
    let r = 0;
    let t = 0;

    if (tidyness == 0) { r = 0; t = 0; }
    if (tidyness == 1) { r = 7; t = 2; }
    if (tidyness == 2) { r = 180; t = 6; }
    element.style.transform =
        `rotate(${rndNum(-r, r)}deg) translate(${rndNum(-t, t)}%, ${rndNum(-t, t)}%)`;
}


// It centers the selected item in the carousels in the options overlay 
function centerLists() {
    document.querySelectorAll(".car-list").forEach(list => {
        const selected = list.querySelector(".selected");
        if (selected) {
            selected.scrollIntoView({
                behavior: "smooth",
                inline: "center",
                block: "nearest"
            });
        }
    });
}


//Buttons carousels handler
document.querySelectorAll('.car-button').forEach(btn => {
    btn.addEventListener('click', () => {
        const wrapper = btn.closest('.car-list-wrapper');
        const track = wrapper?.querySelector('.car-list');
        const direction = btn.dataset.direction;
        if (!track) return;

        const scrollAmount = track.clientWidth;

        track.scrollBy({
            left: direction === 'next' ? scrollAmount : -scrollAmount,
            behavior: 'smooth'
        });
    });
});




//----------- WINNER OVERLAY -----------------

document.getElementById("winner-icon-back").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("winner-overlay").style.display = "none";
});

document.getElementById("winner-container").addEventListener("click", (e) => {
    fireWinnerConfetti(200);
});

document.getElementById("piece-popup").addEventListener("click", (e) => {
    e.stopPropagation();
    restartAnimation();
});

document.getElementById("winner-button").addEventListener("click", (e) => {
    e.stopPropagation();
    location.reload();
});


//winner popup 
function checkGameOver() {
    const noPiecesLeft = gameState.players[1].remainingPieces === 0 || gameState.players[2].remainingPieces === 0;
    if (!noPiecesLeft && !gameState.isFive) return false;

    rollBtnEnabled = false;
    doneBtnEnabled = false;
    isGameOver = true;

    // The game is over: dice, results/calls and ROLL no longer do
    // anything, so all three dim to the exact same level the bot's-turn
    // dimming uses. DONE stays fully visible/opaque and clickable — it
    // still works, reopening the winner overlay if the player dismissed
    // it to look at the board.
    document.getElementById("div-dice").classList.add("game-over-dim");
    document.getElementById("div-resultsAndCalls").classList.add("game-over-dim");
    rollBtn.classList.add("game-over-dim");

    // The popup itself is shown by the caller (see playEndGameSequence in
    // performEndTurn), once the end-of-game fairy trail celebration has
    // played -- showing it immediately here would cover the board with the
    // overlay before there's anything left to see.
    return true;
}

function determineWinner() {
    if (gameState.players[1].points > gameState.players[2].points) return 1;
    if (gameState.players[1].points < gameState.players[2].points) return 2;
    return 0; // tie
}


function showWinnerPopup(winner) {
    const pointsEl = document.getElementById("winner-points");
    if (winner) { // both player 1 or 2
        document.getElementsByClassName("piece-popup-container")[0].classList.add("pulse");
        document.getElementsByClassName("piece-popup-container")[0].style.setProperty("--glow", gameState.players[winner].color);
        document.getElementById("piece-popup").style.backgroundImage = urlOf(gameState.players[winner].pieceImage);
        // Uses whatever name is currently showing in that player's info
        // box (still "YOU"/"BOT" until name selection exists) rather than
        // a hardcoded "Player 1/2".
        document.getElementById("winner-text").textContent = gameState.players[winner].name + " won!";
        document.getElementById("winner-overlay").style.display = "flex";
        animateWinnerPoints(pointsEl, gameState.players[winner].points);
        fireWinnerConfetti(3000);
    } else {
        document.getElementsByClassName("piece-popup-container")[0].classList.remove("pulse");
        document.getElementsByClassName("piece-popup-container")[0].style.setProperty("--glow", "rgba(0, 0, 0, .2)");
        document.getElementById("piece-popup").style.backgroundImage = urlOf("resources/images/tie.svg");
        document.getElementById("winner-text").textContent = "It's a tie!";
        document.getElementById("winner-overlay").style.display = "flex";
        pointsEl.textContent = "";
        pointsEl.classList.remove("winner-points-reveal");
        fireWinnerConfetti(500);
    }
}

// Reveals the winner's final score with a spring pop-in (see
// .winner-points-reveal) while counting the number itself up from 0 to
// `total`, easing out into it, instead of the total just appearing.
function animateWinnerPoints(el, total) {
    el.classList.remove("winner-points-reveal");
    void el.offsetWidth;
    el.classList.add("winner-points-reveal");

    // The looping shine (see .winner-points-shine) lives on this inner
    // span, separate from `el`'s own one-shot pop-in above -- see the CSS
    // comment for why one element can't run both at once. Only the span's
    // text changes each frame below; the shine's own animation (already
    // running from the moment the class is applied) isn't affected by that.
    el.innerHTML = '<span class="winner-points-shine"></span>';
    const shineSpan = el.firstElementChild;

    const duration = 900;
    const start = performance.now();
    (function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic: fast start, settles gently into the final number
        const value = Math.round(eased * total);
        shineSpan.textContent = value + (value === 1 ? " point" : " points");
        if (t < 1) requestAnimationFrame(step);
    })(start);
}


function fireWinnerConfetti(duration) {
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 6,
            angle: 85,
            spread: 60,
            origin: { x: 0 }
        });

        confetti({
            particleCount: 6,
            angle: 95,
            spread: 60,
            origin: { x: 1 }
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    })();
}


function restartAnimation() {
    const wrap = document.querySelector(".piece-popup-wrap");
    const piece = document.querySelector(".piece-popup");
    wrap.classList.remove("animate-wrap");
    piece.classList.remove("animate-piece");
    void wrap.offsetWidth;
    void piece.offsetWidth;
    wrap.classList.add("animate-wrap");
    piece.classList.add("animate-piece");
}






//----------- ROLL BUTTON -----------------
rollBtn.addEventListener("click", function () {
    if (!isMyTurn()) return;
    if (rollBtnEnabled == false) return;
    if (gameState.dice.rollsLeft < 1) return;
    rollBtnEnabled = false;
    doneBtnEnabled = false;

    //startTurnTimer();
    if (isVolumeOn) {
        new Audio("resources/sounds/roll.mp3").play();
    }
    controller.dispatch({ type: "ROLL_DICE" });
    rollAnimationID = setInterval(rollAnimation, 100);
    stopRollID = setInterval(stopRoll, 1200);

    rollBtnText.innerText = "ROLL " + gameState.dice.rollsLeft;
    tileElements.forEach(el => el.classList.remove("tile_highlighted"));
    rrElements.forEach(el => el.classList.remove("highlighted"));
    removePiece(selectedTileId);
});


function rollAnimation() {
    let rndValues = [0, 0, 0, 0, 0];
    for (let i = 0; i < 5; i++) {
        rndValues[i] = rndNum(1, 6);
    }
    renderDice(rndValues);
}


function renderDice(values) {
    let r = 0;
    let t = 0;

    if (tidyness == 0) { r = 0; t = 0; }
    if (tidyness == 1) { r = 10; t = 0; }
    if (tidyness == 2) { r = 10; t = 7; }

    for (let i = 0; i < 5; i++) {
        if (!gameState.dice.locked[i]) {
            ddElements[i].style.backgroundPosition = dicePos[values[i]];
            wdElements[i].style.transform = 'rotate(' + rndNum(-r, r) + 'deg) ' + 'translate(' + rndNum(-t, t) + 'px,' + rndNum(-t, t) + 'px)';
        }
    }

}


let possibleMovesLocal = Array.from({ length: 5 }, () => Array(5).fill(0));
//--------------- STOP ROLL ------------------
function stopRoll() {
    clearInterval(rollAnimationID);
    clearInterval(stopRollID);
    renderDice(gameState.dice.values);
    controller.dispatch({ type: "STOP_ROLL" });

    possibleMovesLocal = gameState.possibleMoves;
    renderResultsHighlight();
    renderTableHighlight();
    rollBtnEnabled = true;
    doneBtnEnabled = true;
}


function renderResultsHighlight() {
    rrElements.forEach(el => el.classList.remove("highlighted"));

    let results = [];
    for (let i = 0; i < 8; i++) {
        if (gameState.combinationsRealized[i]) {
            results.push(i);
        }
    }
    results.forEach(i => {
        rrElements[i].classList.add("highlighted");
    });
}


function renderTableHighlight() {
    tileElements.forEach(el => el.classList.remove("tile_highlighted"));

    let highlight = gameState.possibleMoves.flat();
    let tiles = [];
    for (let i = 0; i < 25; i++) {
        if (highlight[i] === 1) {
            tiles.push(i);
        }
    }
    tiles.forEach(i => {
        tileElements[i].style.outlineColor = selectedColor[gameState.currentPlayer];
        tileElements[i].classList.add("tile_highlighted");
    });
}





//----------- PIECE PLACEMENT ---------------
document.querySelectorAll(".tile").forEach(el => {
    el.addEventListener("click", function () {
        if (!isMyTurn()) return;
        if (pieceEnabled == false) return;

        handleTile(el.id);
    });
});


function handleTile(tileId) {
    if (!tileId) return;

    const piece = document.getElementById("p" + idToCoo(tileId));
    const wrapper = piece.parentElement;

    if (matrixCheck(idToCoo(piece.id), possibleMovesLocal) === 0) return;
    pieceEnabled = false;
    
    console.log(tileId);
    if (getComputedStyle(wrapper).opacity == "1") {
        // REMOVE
        removePiece(piece.id);
    } else {
        // PLACE
        placePiece(piece.id);
    }
}


function removePiece(pieceId) {
    if (pieceId === null) return;
    let piece = document.getElementById(pieceId);
    let wrapper = piece.parentElement;

    wrapper.classList.remove("img-bounce");
    wrapper.classList.add("img-disappear");

    wrapper.addEventListener("animationend", (e) => {
        wrapper.classList.remove("img-disappear");
        // placePiece()'s own animationend bakes opacity:1 into an inline
        // style (see its comment) so a later .piece-jump isn't permanently
        // shadowed by .img-bounce. That inline style outlives .img-bounce
        // itself, so it has to be cleared here too -- otherwise, the
        // instant .img-disappear's forwards-filled opacity:0 is removed
        // above, the leftover inline opacity:1 wins the cascade again and
        // snaps the wrapper back to visible. handleTile() then reads that
        // as "still occupied" forever after, so every future tap on this
        // tile is misread as remove instead of place.
        wrapper.style.opacity = "";
        piece.style.backgroundImage = "";
        pieceEnabled = true;
        selectedTileId = null;
    }, { once: true });

    const coor = idToCoo(pieceId);
    controller.dispatch({ type: "PLACE_PIECE", coordinates: coor, player: 0 });
    console.log(`Coordinates ${coor}`);
}


// The 4 line directions a run can follow: row, column, down-right
// diagonal, down-left diagonal. Shared by findNewTripleLines (through one
// cell) and findAllPlayerLines (the whole board).
const LINE_DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function inBounds(r, c) {
    return r >= 0 && r < 5 && c >= 0 && c < 5;
}

// The full contiguous same-`player` run through (r,c) in each of the 4
// directions, checked against `table` WITH (r,c) already placed as
// `player` — one line per direction that has a run of 3 or more, however
// long that run actually turns out to be (3, 4 or 5 cells). Returning the
// WHOLE run rather than breaking it into overlapping 3-cell windows is
// what makes a freshly-completed 4- or 5-in-a-row animate across all of
// its pieces in one trail instead of two or three overlapping ones.
// Checked against gameState.table BEFORE this placement's own
// PLACE_PIECE/END_TURN commits it, so any line found here is guaranteed to
// need (r,c) to exist at all (the cell was empty until this placement).
function findNewTripleLines(table, r, c, player) {
    const trial = table.map((row) => row.slice());
    trial[r][c] = player;

    const lines = [];
    for (const [dr, dc] of LINE_DIRECTIONS) {
        const before = [];
        let rr = r - dr, cc = c - dc;
        while (inBounds(rr, cc) && trial[rr][cc] === player) {
            before.unshift([rr, cc]);
            rr -= dr; cc -= dc;
        }
        const after = [];
        rr = r + dr; cc = c + dc;
        while (inBounds(rr, cc) && trial[rr][cc] === player) {
            after.push([rr, cc]);
            rr += dr; cc += dc;
        }
        const run = [...before, [r, c], ...after];
        if (run.length >= 3) lines.push(run);
    }
    return lines;
}

// Every maximal same-`player` run of 3+ cells currently on the board, one
// entry per run (a 5-in-a-row is one line, not three overlapping ones) --
// used for the end-of-game celebration sweep over all of the winner's
// lines, see playEndGameSequence().
function findAllPlayerLines(table, player) {
    const lines = [];
    for (const [dr, dc] of LINE_DIRECTIONS) {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (table[r][c] !== player) continue;
                const pr = r - dr, pc = c - dc;
                if (inBounds(pr, pc) && table[pr][pc] === player) continue; // not a run's start
                const run = [];
                let rr = r, cc = c;
                while (inBounds(rr, cc) && table[rr][cc] === player) {
                    run.push([rr, cc]);
                    rr += dr; cc += dc;
                }
                if (run.length >= 3) lines.push(run);
            }
        }
    }
    return lines;
}

// Plays each line's fairy trail one at a time (never overlapping), then
// calls onAllDone once the last one's head has finished traveling.
// A short gap between one line's trail finishing and the next one's
// starting, so back-to-back lines still read as distinct beats instead of
// one blending straight into the next.
const LINE_SEQUENCE_GAP_MS = 200;

function playLinesSequentially(lines, onAllDone) {
    let i = 0;
    (function next() {
        if (i >= lines.length) {
            if (onAllDone) onAllDone();
            return;
        }
        const cells = lines[i++];
        // The gap only belongs BETWEEN two lines, to keep them feeling like
        // distinct beats -- after the very last one, `next()` runs
        // immediately, since here it's `onAllDone` that fires (see
        // celebratePoints), and that goes on to continue the exact same
        // trail onward to the points counter. Delaying that too would
        // reintroduce a pause between the board trail and its own
        // continuation, breaking what's meant to read as one movement.
        const isLast = i >= lines.length;
        playFairyTrail(cells, {
            onWaypoint: ([wr, wc]) => jumpPiece(wr, wc),
            onDone: isLast ? next : () => setTimeout(next, LINE_SEQUENCE_GAP_MS),
        });
    })();
}

// Makes the piece sitting on (r,c) hop, timed to the fairy trail's spark
// reaching that exact tile (see the onWaypoint callback passed to
// playFairyTrail). Re-triggerable even if it's still mid-jump from a
// moment ago (e.g. two lines sharing a corner cell), by forcing a reflow
// between removing and re-adding the class.
function jumpPiece(r, c) {
    const piece = document.getElementById(`p${r}${c}`);
    if (!piece) return;
    // Animate the WRAPPER (.wrapPiece), never .piece itself: applyTidyness
    // sets a random rotate()+translate() as an inline transform directly
    // on .piece for the "scattered pieces" look, and a running CSS
    // animation on the same element/property takes over `transform`
    // entirely for its duration -- so animating .piece would snap that
    // tidy rotation away and back, which is exactly the visible "rotation"
    // bug this replaces. .wrapPiece's own leftover transform (scale(1)
    // from the bounceIn placement animation, see animations.css) is a
    // true identity with no rotation, so overriding it during the jump
    // and reverting after is visually silent.
    const wrapper = piece.parentElement;
    wrapper.classList.remove("piece-jump");
    void wrapper.offsetWidth;
    wrapper.classList.add("piece-jump");
    wrapper.addEventListener("animationend", () => {
        wrapper.classList.remove("piece-jump");
    }, { once: true });
}

function placePiece(pieceId) {
    let piece = document.getElementById(pieceId);
    let wrapper = piece.parentElement;

    if (gameState.currentPlayer == 1) { piece.style.backgroundImage = urlOf(gameState.players[1].pieceImage); }
    if (gameState.currentPlayer == 2) { piece.style.backgroundImage = urlOf(gameState.players[2].pieceImage); }

    applyTidyness(piece);
    selectedTileId = pieceId;

    if (prewPiece !== null) {
        if (prewPiece !== piece) {
            removePiece(prewPiece.id);
        }
    }
    prewPiece = piece;

    wrapper.classList.add("img-bounce");
    wrapper.addEventListener("animationend", (e) => {
        pieceEnabled = true;
        // .img-bounce's forwards fill-mode is what keeps .wrapPiece visible
        // (its base state is opacity:0) once the entrance animation ends --
        // bake that into an inline style and drop the class so a later
        // .piece-jump (same element, same `animation` property) isn't
        // permanently shadowed by .img-bounce winning the cascade tie by
        // stylesheet load order (linotte.css loads after animations.css).
        wrapper.style.opacity = "1";
        wrapper.classList.remove("img-bounce");
    }, { once: true });

    const coor = idToCoo(pieceId);
    // The fairy trail only plays once the placement is actually committed
    // (DONE, in performEndTurn) -- not here, since a tentative placement
    // can still be reconsidered (click a different tile) before then.
    controller.dispatch({ type: "PLACE_PIECE", coordinates: coor, player: gameState.currentPlayer });
}


function checkPossibleMoves(coordinates) {
    matrixCheck(coordinates, gameState.possibleMoves);
}


function checkTable(coordinates) {
    matrixCheck(coordinates, gameState.table);
}







//------------------ DONE BUTTON ----------------------
doneBtn.addEventListener("click", doneButton);

function doneButton(e) {
    if (isGameOver) {
        // The game's over and there's no next turn anymore — DONE just
        // brings the winner overlay back if it was dismissed to look at
        // the board, instead of being a dead button.
        showWinnerPopup(determineWinner());
        return;
    }
    if (!isMyTurn()) return;
    if (doneBtnEnabled == false) return;
    performEndTurn();
}

function performEndTurn() {
    console.log("doneButton");

    // The bot logs its own turn (with full decision data) from inside
    // playBotTurn before this runs; this only covers the human player's
    // moves, so the log still shows whose turn it was and where the piece
    // landed for every turn, not just the bot's.
    if (controller.mode === "bot" && gameState.currentPlayer === 1) {
        botLogBlank();
        botLogHuman(`Turno ${++botTurnCounter} (TU) → ${gameState.currentPosition ? "piazza " + gameState.currentPosition : "nessun piazzamento"}`);
    }

    // The fairy trail (see shared/fairyTrail.js) only plays once a
    // placement is actually committed -- right here, reading
    // gameState.currentPosition/table exactly as they were right before
    // END_TURN commits them, not at the earlier tentative placePiece()
    // click, which the player can still reconsider before DONE.
    let lastMoveLines = [];
    if (gameState.currentPosition) {
        const [r, c] = [Number(gameState.currentPosition[0]), Number(gameState.currentPosition[1])];
        lastMoveLines = findNewTripleLines(gameState.table, r, c, gameState.currentPlayer);
    }

    // Snapshotted BEFORE END_TURN commits anything, so renderPieceCounts/
    // renderPointCounts (called at two different times below) can each
    // tell whether THEIR number actually changed and only pop/pop+popup
    // the one(s) that did.
    const before = {
        pieces: { 1: gameState.players[1].remainingPieces, 2: gameState.players[2].remainingPieces },
        points: { 1: gameState.players[1].points, 2: gameState.players[2].points },
    };

    possibleMovesLocal = Array.from({ length: 5 }, () => Array(5).fill(0));
    controller.dispatch({ type: "END_TURN" });
    clearForNextTurn()
    renderPlayerBox(gameState.currentPlayer);
    // The piece count pops right away -- the piece really did just land on
    // the board -- but the score (see renderPointCounts below) waits until
    // the line that earned it has actually played.
    renderPieceCounts(before);
    divsOpacity(gameState.currentPlayer);

    if (checkGameOver()) {
        stopTimer();
        playEndGameSequence(lastMoveLines, before);
        return;
    }

    // Several lines from one placement (e.g. a corner completing both a
    // row and a column) play one after another, never at the same time --
    // see playLinesSequentially. The next turn -- the bot's own turn, or
    // just the timer for whoever's turn it now is -- doesn't start until
    // ALL of this turn's animations (board lines, then the points hop)
    // have actually finished, so it never starts overlapping the previous
    // turn's celebration still playing out.
    playLinesSequentially(lastMoveLines, () => {
        celebratePoints(lastMoveLines, before, () => {
            startTurnTimer(); // fresh 60s -- keeps running through the bot's own turn too, not just the human's
            if (controller.mode === "bot" && gameState.currentPlayer === 2) {
                playBotTurn();
            }
        });
    });
    //stateUpdate();


    //send to the server where the player placed the piece
    // socket.emit("action", {
    //     type: "DONE",
    //     localPlayer: LOCAL_PLAYER,
    //     tileCoordinate: selectedTile === null ? null : selectedTile.id
    // });
}

// Runs once the game has just ended (see checkGameOver): replays the line
// that finished it first, if the very last move completed one, then every
// other line the winner has on the board as a celebratory sweep -- one at
// a time, never overlapping (see playLinesSequentially) -- and only then
// shows the winner popup. Showing the popup immediately would cover the
// board with the overlay before there's anything left to watch.
function playEndGameSequence(lastMoveLines, before) {
    // checkGameOver() (this function's only caller) can end up asked to run
    // more than once for the very same game over event -- e.g. the bot's
    // own turn-processing calling performEndTurn() a second time, or the
    // turn timer's auto-submit racing the win right as it happens. A
    // second, incomplete run would start its own concurrent trail and pop
    // the winner overlay as soon as ITS (shorter) sequence finishes,
    // visually cutting off the real one mid-celebration. Only the first
    // call actually plays anything.
    if (endGameSequenceStarted) return;
    endGameSequenceStarted = true;

    const winner = determineWinner();

    // Step 1: the deciding move's own line(s), celebrated exactly like any
    // other turn -- trail, then the points hop to the counter, then the
    // number actually increments. Only once THAT is done does the sweep
    // (step 2) start, so the score updates right after the line that
    // earned it, not after a victory lap over lines that scored turns ago.
    playLinesSequentially(lastMoveLines, () => {
        celebratePoints(lastMoveLines, before, () => {
            let sweepLines = [];
            if (winner) {
                const alreadyShown = new Set(lastMoveLines.map((line) => JSON.stringify(line)));
                sweepLines = findAllPlayerLines(gameState.table, winner)
                    .filter((line) => !alreadyShown.has(JSON.stringify(line)));
            }
            // Step 2: sweep every other line the winner has on the board,
            // purely as a victory lap -- no further point changes, those
            // already happened in earlier turns.
            playLinesSequentially(sweepLines, () => {
                // A beat of empty board between the celebration and the
                // popup, so the last line doesn't feel like it's cut off
                // by the overlay appearing the instant it finishes.
                setTimeout(() => showWinnerPopup(winner), 1000);
            });
        });
    });
}


// socket.on("place_piece", tileCoordinate => {
//     if (tileCoordinate)
//         placePiece("piece_" + tileCoordinate);

//     //end of the game
//     if (gameState.players[1].remainingPieces == 0 || gameState.players[2].remainingPieces == 0 || gameState.isFive == true) {
//         stopTimer()
//         rollBtnEnabled = false;
//         doneBtnEnabled = true;

//         if (gameState.players[1].points > gameState.players[2].points) {
//             showWinnerPopup(1);
//         } else if (gameState.players[1].points < gameState.players[2].points) {
//             showWinnerPopup(2);
//         } else {
//             //it's a tie
//             showWinnerPopup(0);
//         }
//         return;
//     }
//     startTurnTimer();
// });


//----------- BOT TURN ---------------
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


//----------- BOT DECISION LOG (see public/bot-log.html) ---------------
// A live, copy-pasteable trace of every choice the bot makes this turn --
// dice, roll/stop, call, lock, and the full placement breakdown (chosen
// cell plus every alternative actually considered, with the same fields
// the priority ladder itself compares). Written to localStorage so
// bot-log.html has history even if opened after the fact, and broadcast
// live via BroadcastChannel so an already-open log tab updates instantly.
const BOT_LOG_KEY = "linotte-bot-log-entries";
const BOT_LOG_MAX_LINES = 4000;
const CALL_NAMES = { 3: "full", 4: "carré", 5: "petite", 6: "suite", 7: "yam" };

let botLogChannel = null;
try {
    botLogChannel = new BroadcastChannel("linotte-bot-log");
} catch (e) {
    // Unsupported browser -- bot-log.html falls back to reloading after
    // the fact to read localStorage instead of getting live pushes.
}

let botTurnCounter = 0;

// Writes one line to the log: a JSON blob carrying everything needed to
// analyze the decision (board state, dice, every candidate's full
// evaluation) — this is for Claude to read back, not for a person to parse
// at a glance. No prose, no formatting choices; just the data the actual
// decision functions produced.
function botLogData(obj) {
    const line = JSON.stringify(obj);
    try {
        const existing = JSON.parse(localStorage.getItem(BOT_LOG_KEY) || "[]");
        existing.push(line);
        while (existing.length > BOT_LOG_MAX_LINES) existing.shift();
        localStorage.setItem(BOT_LOG_KEY, JSON.stringify(existing));
    } catch (e) {
        // Storage full/unavailable -- an already-open log tab still gets
        // this line live via the channel below.
    }
    if (botLogChannel) botLogChannel.postMessage(line);
}

// One line a person can actually read at a glance: whose turn, and where
// the piece landed (or didn't). Everything else in the log is for Claude.
function botLogHuman(text) {
    const line = `» ${text}`;
    try {
        const existing = JSON.parse(localStorage.getItem(BOT_LOG_KEY) || "[]");
        existing.push(line);
        while (existing.length > BOT_LOG_MAX_LINES) existing.shift();
        localStorage.setItem(BOT_LOG_KEY, JSON.stringify(existing));
    } catch (e) {
        // Storage full/unavailable -- an already-open log tab still gets
        // this line live via the channel below.
    }
    if (botLogChannel) botLogChannel.postMessage(line);
}

// An actual blank line (no timestamp) between turns, so a long log doesn't
// read as one unbroken wall of text.
function botLogBlank() {
    try {
        const existing = JSON.parse(localStorage.getItem(BOT_LOG_KEY) || "[]");
        existing.push("");
        while (existing.length > BOT_LOG_MAX_LINES) existing.shift();
        localStorage.setItem(BOT_LOG_KEY, JSON.stringify(existing));
    } catch (e) {
        // Storage full/unavailable -- an already-open log tab still gets
        // this line live via the channel below.
    }
    if (botLogChannel) botLogChannel.postMessage("");
}

// Trims a candidate down to what's worth reading back -- drops r/c (rc
// already has it) and only includes a boolean flag when it's actually
// true, to keep the JSON dense instead of repeating "false" 4x per cell.
function compactCandidate(c) {
    if (!c) return null;
    const out = {
        rc: c.rc,
        tile: c.tile,
        tag: c.tag,
        pts: c.pointsGained,
        denied: c.deniedPoints,
        rarity: Math.round(c.rarity * 10) / 10,
        lineConn: c.lineConnection,
        cluster: c.clusterScore,
        blockScore: c.blockScore,
    };
    if (c.wouldWinGame) out.wouldWinGame = true;
    if (c.wouldLoseGame) out.wouldLoseGame = true;
    if (c.criticalBlock) out.criticalBlock = true;
    if (c.urgentBlock) out.urgentBlock = true;
    return out;
}

async function playBotTurn() {
    if (controller.mode !== "bot") return;
    if (gameState.currentPlayer !== 2) return;

    setBotControlsDisabled(true);
    const turnNum = ++botTurnCounter;
    botLogBlank();
    const record = {
        turn: turnNum,
        player: 2,
        strategy: botStrategy,
        board: gameState.table.map((row) => row.slice()),
        piecesLeft: { p1: gameState.players[1].remainingPieces, p2: gameState.players[2].remainingPieces },
        points: { p1: gameState.players[1].points, p2: gameState.players[2].points },
        rolls: [],
        placement: null,
    };
    try {
        await sleep(800); // small pause so the bot's move doesn't feel instant

        let keepRolling = true;
        while (keepRolling) {
            await botRoll();

            const target = explainTarget(gameState, 2, botStrategy);
            const rollRecord = {
                dice: gameState.dice.values.slice(),
                rollsLeft: gameState.dice.rollsLeft,
                target: target ? { combo: target.comboKey, need: target.need, value: Math.round(target.attractiveness) } : null,
            };
            record.rolls.push(rollRecord);

            if (gameState.dice.rollsLeft <= 0) {
                rollRecord.rollsExhausted = true;
                break;
            }
            const stop = shouldStopRolling(gameState, 2, botStrategy);
            rollRecord.stopRolling = stop;
            if (stop) break;

            // Calling only matters for the *next* roll's combination check,
            // so it's decided here — after seeing this throw, and only
            // once we know the bot is going to roll again.
            const callIndex = chooseCallToMake(gameState, 2, botStrategy);
            rollRecord.call = callIndex !== null && callIndex !== undefined ? (CALL_NAMES[callIndex] ?? callIndex) : null;
            await applyBotCall(callIndex);

            // Give the player a moment to read the dice before the bot starts
            // choosing which ones to keep.
            await sleep(700);
            const locked = chooseDiceToLock(gameState.dice.values, gameState, 2, botStrategy);
            rollRecord.lock = locked.map((l) => (l ? 1 : 0));
            await applyBotLock(locked);
            await sleep(800);
        }

        await sleep(600);
        const explanation = explainPlacement(gameState, 2, botStrategy);
        record.placement = {
            chosen: compactCandidate(explanation.chosen),
            ranked: explanation.ranked.filter((c) => c.rc !== explanation.chosen?.rc).map(compactCandidate),
            declined: explanation.declined.map(compactCandidate),
        };
        botLogData(record);
        botLogHuman(`Turno ${turnNum} (BOT) → ${explanation.chosen ? "piazza " + explanation.chosen.rc : "nessun piazzamento"}`);

        const coordinates = explanation.chosen ? explanation.chosen.rc : null;
        if (coordinates) {
            placePiece("p" + coordinates);
        }

        await sleep(1000);
    } finally {
        setBotControlsDisabled(false);
    }
    performEndTurn();
}


async function botRoll() {
    if (isVolumeOn) {
        new Audio("resources/sounds/roll.mp3").play();
    }
    controller.dispatch({ type: "ROLL_DICE" });
    rollBtnText.innerText = "ROLL " + gameState.dice.rollsLeft;
    tileElements.forEach(el => el.classList.remove("tile_highlighted"));
    rrElements.forEach(el => el.classList.remove("highlighted"));

    // Brief roll animation matching the human roll's rough pacing
    // (the human version runs on a 1200ms interval; we just await it
    // directly here instead of using setInterval/setTimeout IDs that
    // would collide with the human roll button's own state).
    const ticks = 12;
    for (let i = 0; i < ticks; i++) {
        let rndValues = [0, 0, 0, 0, 0];
        for (let j = 0; j < 5; j++) rndValues[j] = rndNum(1, 6);
        renderDice(rndValues);
        await sleep(120);
    }

    renderDice(gameState.dice.values);
    controller.dispatch({ type: "STOP_ROLL" });
    possibleMovesLocal = gameState.possibleMoves;
    renderResultsHighlight();
    renderTableHighlight();
}


async function applyBotLock(lockedArray) {
    for (let i = 0; i < 5; i++) {
        if (gameState.dice.locked[i] === lockedArray[i]) continue;

        gameState.dice.locked[i] = lockedArray[i];
        if (lockedArray[i]) {
            ddElements[i].classList.add("selected");
        } else {
            ddElements[i].classList.remove("selected");
        }

        // Mirror a person clicking each die: update the game after every
        // individual choice, then pause briefly before considering the next.
        controller.dispatch({ type: "LOCK_DICE", locked: gameState.dice.locked.slice() });
        await sleep(260);
    }
}

async function applyBotCall(callIndex) {
    // Only one call can be active at a time: check the chosen one (if any)
    // and uncheck everything else, mirroring the human ".call.selectable" handler.
    let changed = false;
    for (let i = 3; i < 8; i++) {
        const shouldBeChecked = i === callIndex;
        if (Boolean(gameState.called[i]) === shouldBeChecked) continue;

        gameState.called[i] = shouldBeChecked ? 1 : 0;
        document.getElementById("cc" + i).classList.toggle("checked", shouldBeChecked);
        changed = true;
    }
    if (!changed) return;

    controller.dispatch({ type: "SELEC_CALL", called: gameState.called.slice() });
    await sleep(300);
}


function setBotControlsDisabled(disabled) {
    const controls = [...rrElements, ...ccElements, ...ddElements, rollBtn, doneBtn];
    controls.forEach(control => {
        control.setAttribute("aria-disabled", String(disabled));
    });
}


function clearForNextTurn() {
    console.log("clearForNextTurn");

    prewPiece = null;
    selectedTileId = null;

    // Undo the game-over dimming (see checkGameOver) whenever a fresh turn
    // or a brand new game starts.
    document.getElementById("div-dice").classList.remove("game-over-dim");
    document.getElementById("div-resultsAndCalls").classList.remove("game-over-dim");
    rollBtn.classList.remove("game-over-dim");

    //dice reset
    wdElements.forEach(wd => wd.style.transform = 'rotate(0deg) translate(0px,0px)');
    ddElements.forEach(dd => dd.classList.remove("selected"));
    ddElements.forEach(dd => dd.style.backgroundPosition = dicePos[0]);

    //Roll button reset
    rollBtnText.innerText = "ROLL 3";
    gameState.dice.rollsLeft = 3;
    gameState.called = [null, null, null, false, false, false, false, false];

    //table and reuslt reset
    tileElements.forEach(el => el.classList.remove("tile_highlighted"));
    rrElements.forEach(el => el.classList.remove("highlighted"));
    ccElements.forEach(el => el.classList.remove("checked"));
}


//----------- LOCK DICE ---------------
document.querySelectorAll(".die").forEach(el => {
    el.addEventListener("click", function () {
        if (!isMyTurn()) return;
        if (!rollBtnEnabled) return; // dice are mid-roll (rollBtnEnabled is false from click to stopRoll) -- not settled yet, don't let a lock toggle underneath the animation
        if (gameState.dice.rollsLeft === 3) return; // not rolled yet this turn -- nothing to lock in

        let elem = document.getElementById(this.id);
        if (elem.classList.contains("selected")) {
            gameState.dice.locked[Number(this.id[2]) - 1] = false;
            elem.classList.remove("selected"); // reset
        } else {
            gameState.dice.locked[Number(this.id[2]) - 1] = true;
            elem.classList.add("selected");
        }

        controller.dispatch({ type: "LOCK_DICE", locked: gameState.dice.locked });

        // socket.emit("action", {
        //     type: "LOCK_DICE",
        //     localPlayer: LOCAL_PLAYER,
        //     lockedDice: gameState.dice.locked
        // });
    });
});


// socket.on("lockDice_result", state => {
//     gameState.dice.locked = state;
//     diceIds = ["dd1", "dd2", "dd3", "dd4", "dd5"];

//     for (let i = 0; i < 5; i++) {
//         elem = document.getElementById(diceIds[i]);

//         if (gameState.dice.locked[i]) {
//             if (!elem.classList.contains("selected")) {
//                 elem.classList.add("selected");
//             }

//         } else {
//             elem.classList.remove("selected");
//         }

//     }
// });


//----------- SELECT CALL ---------------
document.querySelectorAll(".result").forEach(el => {
    el.addEventListener("click", function () {
        if (!isMyTurn()) return;
        if (!rollBtnEnabled) return; // mid-roll -- see the .die handler above

        el.classList.add("tip-on");
        setTimeout(() => {
            el.classList.remove("tip-on");
        }, 800); // durata visibilità

        //Only for selectable results
        if (!el.classList.contains("selectable")) return;
        //Only if not firts throw
        if (gameState.dice.rollsLeft === 3) return;

        const elemId = document.getElementById(this.id).id;
        const targetId = idToIndex(elemId);
        const targetDiv = document.getElementById("cc" + targetId);
    
        if(gameState.called[targetId]){
            targetDiv.classList.remove("checked");
            gameState.called[targetId] = 0;
        } else {
            document.querySelectorAll(".call.selectable").forEach(el => {
                el.classList.remove("checked"); // reset
                gameState.called[idToIndex(el.id)] = 0;
            });
            //Not possible to call carre if 4 dice are locked
            if (document.querySelectorAll(".die.selected").length === 4 && targetDiv === "cc5") return;
            //Not possible to call carre on carre
            if (gameState.combinationsRealized[4] === 1 && targetDiv === "cc5") return;
            //Only if at least one die is rolled
            if (document.querySelectorAll(".die.selected").length === 5) return;

            targetDiv.classList.add("checked");
            gameState.called[targetId] = 1;
        }
    });
});


//----------- KEYBOARD SHORTCUTS ---------------
// 1-5 lock/unlock the matching die, 6-0 select/deselect the matching call
// (full, carre, petite, suite, yam in that order), space bar rolls, and D
// presses DONE. Every shortcut just clicks the same element a mouse would,
// so all the existing guards (isMyTurn, rollBtnEnabled, .selectable, the
// first-throw gate, etc.) apply identically — nothing is duplicated here.
const CALL_KEY_TO_RESULT_INDEX = { "6": 3, "7": 4, "8": 5, "9": 6, "0": 7 };

// DEBUG PREVIEW ONLY (key "F"): cycles the fairy-trail sparkle effect
// (see shared/fairyTrail.js) over a sample row/column/diagonal, so it can
// be seen without actually completing a combo in a real game. Safe to
// remove once the effect itself is finalized.
let fairyDebugIndex = -1;
const FAIRY_DEBUG_LINES = [
    [[0, 0], [0, 1], [0, 2]], // row
    [[0, 4], [1, 4], [2, 4]], // column
    [[0, 0], [1, 1], [2, 2]], // main diagonal
];

document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const targetTag = e.target && e.target.tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;
    if (!optionsOverlay.classList.contains("hidden")) return; // options panel open

    if (e.code === "Space") {
        e.preventDefault();
        rollBtn.click();
        return;
    }

    if (e.key === "d" || e.key === "D") {
        doneBtn.click();
        return;
    }

    if (e.key === "f" || e.key === "F") {
        fairyDebugIndex = (fairyDebugIndex + 1) % FAIRY_DEBUG_LINES.length;
        const cells = FAIRY_DEBUG_LINES[fairyDebugIndex];
        // Simulate an actual placed piece on each cell first (a real
        // triple always has one) so the jump-on-arrival is visible too,
        // not just the sparks -- without needing to play out a real game.
        cells.forEach(([r, c]) => {
            const piece = document.getElementById(`p${r}${c}`);
            if (!piece) return;
            piece.style.backgroundImage = urlOf(gameState.players[1].pieceImage);
            piece.parentElement.style.opacity = "1";
        });
        playFairyTrail(cells, { onWaypoint: ([wr, wc]) => jumpPiece(wr, wc) });
        return;
    }

    if (isGameOver) return; // dice/calls are dead once the game has ended

    if (e.key >= "1" && e.key <= "5") {
        ddElements[Number(e.key) - 1].click();
        return;
    }

    if (e.key in CALL_KEY_TO_RESULT_INDEX) {
        rrElements[CALL_KEY_TO_RESULT_INDEX[e.key]].click();
    }
});


function highlighteCall(state) {
    for (let i = 3; i < 8; i++) {
        if (state[i]) {
            if (!ccElements[i].classList.contains("checked")) {
                ccElements[i].classList.add("checked");
            }
        } else {
            ccElements[i].classList.remove("checked");
        }
    }

}


function stateUpdate() {
    // coinP1Text.textContent = gameState.players[1].points;
    // coinP2Text.textContent = gameState.players[2].points;
    // pawnP1Text.textContent = gameState.players[1].remainingPieces;
    // pawnP2Text.textContent = gameState.players[2].remainingPieces;

    //divPlayerShadow(gameState.currentPlayer);
    //renderBoardFromState(gameState.table);
}


function divsOpacity(currentPlayer) {
    if (controller.mode === "offline") return; // hotseat: never dim, both players share the controls
    if (!currentPlayer) return;
    // Same opacity value applied uniformly to every control area (dice,
    // results/calls, roll/done) -- see the [aria-disabled] rule in
    // linotte.css for why the individual dice/calls/buttons don't ALSO
    // carry their own opacity (that would stack and double-dim them).
    const opacity = (currentPlayer === LOCAL_PLAYER) ? 1 : 0.5;
    document.getElementById("div-dice").style.opacity = opacity;
    document.getElementById("div-resultsAndCalls").style.opacity = opacity;
    document.getElementById("div-buttons").style.opacity = opacity;
}


function renderBoardFromState(table) {
    document.querySelectorAll(".tile").forEach(tile => {
        const id = tile.id;      // es: "b3"
        const r = rows[id[0]];
        const c = Number(id[1]) - 1;

        const value = table[c][r];
        const piece = tile.querySelector(".piece");

        if (value === 0) {
            piece.style.backgroundImage = "";
            piece.classList.remove("img-bounce");
        }

        if (value === 1) {
            piece.style.backgroundImage = `url('${gameState.players[1].pieceImage}')`;
            piece.classList.add("img-bounce");
        }

        if (value === 2) {
            piece.style.backgroundImage = `url('${gameState.players[2].pieceImage}')`;
            piece.classList.add("img-bounce");
        }
    });
}


// socket.on("selectCall_result", state => {
//     highlighteCall(state);
// });

















