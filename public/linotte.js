//Version (single source: version.js, bumped by `npm run release`)
// i18n first: it translates the page before anything else reads it.
import { t, LANG, LANGUAGES, setLanguage } from "./i18n.js";
import { VERSION } from "./version.js";
import { CONTACT_EMAIL, ONLINE_AVAILABLE, PRO_PRICE } from "./config.js";
document.getElementById("version").textContent = `${t("version")} ${VERSION}`;

// The developer contact in the help page's credits (set in config.js).
if (CONTACT_EMAIL) {
    const contact = document.getElementById("contact-email");
    const link = document.createElement("a");
    link.href = "mailto:" + CONTACT_EMAIL;
    link.textContent = CONTACT_EMAIL;
    contact.append(t(" at "), link);
}

// open
// http://127.0.0.1:5500/public/index.html

//To install web app. Not inside the store apps (Capacitor): their files are
// already on the phone, and a service worker there would only serve stale
// copies after an app update.
const IN_NATIVE_APP = Boolean(window.Capacitor?.isNativePlatform?.());
if ("serviceWorker" in navigator && !IN_NATIVE_APP) {
    navigator.serviceWorker.register("/sw.js")
        .then(() => console.log("SW registered"))
        .catch(err => console.error(err));

    // The very first visit (nothing cached yet) only gets "controlled" by
    // the service worker once it finishes installing -- any request THIS
    // page itself makes before that point (a randomly-assigned piece
    // image, for instance -- pieces/backgrounds/dice are all picked from a
    // pool at runtime, see shared/assets.js) was issued with no controller
    // yet and so was never going through sw.js's cache at all, precached
    // or not. Reloading once, right as control actually starts, is what
    // makes this same first visit fully offline-capable too, instead of
    // only every visit after it.
    let refreshedForSW = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshedForSW) return;
        // Never yank a game away: if one was already started in the few
        // seconds the install took, skip -- it's picked up on the next visit.
        if (gameInProgress) return;
        refreshedForSW = true;
        window.location.reload();
    });
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
const turnLabelEl = document.getElementById("turn-label");
const turnLabelTextEl = document.querySelector("#turn-label .turn-label-text");
const endGameDoneBtn = document.getElementById("endGameDoneBtn");
const openBtn = document.getElementById("options");
const rollBtnText = document.querySelector("#rollBtn .text-button");

const body = document.getElementById("body");
const modal = document.getElementById("modal");
const optionsOverlay = document.getElementById("options-overlay");
// Every .opt-bg: the options overlay's AND the home screen's, so both always
// show the selected background (the home screen's used to stay on the CSS default).
const optBgs = document.querySelectorAll(".opt-bg");

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
// While the window is being resized or rotated, transitions are switched off
// (see html.is-resizing in linotte.css) so the new layout lands in one frame.
let resizingTimer;
function onViewportChange() {
    setRealVh();
    if (!optionsOverlay.classList.contains("hidden")) { alignWithHome(); moveIndicator(currentOptionsTab); }
    document.documentElement.classList.add('is-resizing');
    clearTimeout(resizingTimer);
    resizingTimer = setTimeout(() => {
        document.documentElement.classList.remove('is-resizing');
        // iOS fires orientationchange before the new size is known, and the
        // height read then is still the old one: measure again once the
        // rotation has settled.
        setRealVh();
        if (!optionsOverlay.classList.contains("hidden")) { alignWithHome(); moveIndicator(currentOptionsTab); }
    }, 250);
}
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);




//----------- GAME STATE ---------------
import { createInitialGameState, urlOf, rndNum, idToCoo, matrixCheck, matrixFill, toBoolean, preload, idToIndex } from "./shared/utils.js";
import { dicePath, diceFaces, dicePos, diceNames, bgPath, backgrounds, piecesPath, pieces, avatarIds, avatarUrl } from "./shared/assets.js";
import { updateGame } from "./shared/gameEngine.js";
import { chooseDiceToLock, shouldStopRolling, chooseBestMove, chooseCallToMake, explainPlacement, explainTarget } from "./shared/botAI.js";
import GameController from './shared/gameController.js';
import { playFairyTrail } from "./shared/fairyTrail.js";
import { initCombinationDemos } from "./demo.js";
import { emojiMarkup, emojiLabel } from "./emoji.js";
import { ACCOUNTS_AVAILABLE, EMAIL_HAS_CODE, enabledProviders, initAuth, onUserChange, currentUser, signInWith, sendEmailCode, verifyEmailCode, signOut, deleteAccount, loadProfile, saveProfile } from "./auth.js";
import { nameProblem, cleanPlayerName, COUNTRIES, flagOf } from "./shared/playerNames.js";
import { pickPieceIndexes, isPlayPiece, FIRST_PLAY_PIECE } from "./shared/pieces.js";
import { recordGame, moveLocalGamesToAccount, loadStats, guestXp, noteGuestAbandon } from "./stats.js";
import { ROOMS_NEED_PRO } from "./shared/accounts.js";
import { OnlineClient, hasConsent, saveConsent, inviteLink, pendingJoinCode, setOnlineSession, wasInOnlineSession, fetchPro, lastKnownPro, lastKnownXp } from "./online.js";
import { levelOf, levelStart } from "./shared/level.js";
let gameState = createInitialGameState();
gameState.players[1].name = t("YOU");
gameState.players[2].name = "BOT";




//----------- GAME CONTROLLER ---------------
let controller;
// False until a mode is actually picked on the home screen. The default
// controller below only exists so the code doesn't crash while the home
// screen is up; with this false there is no game: no turn timer, no bot, no
// keyboard shortcuts, nothing highlighted as the running mode.
let gameInProgress = false;
let botStrategy = "points";
startBot(botStrategy); // default to player-vs-bot, ready to play on open --
// silently discarded the moment a real mode is chosen on the home screen
// below (newGameVsBot/newGameOffline fully reset gameState), so it never
// needs to be "correct", just non-crashing while the home screen sits on
// top of it (z-index 60, covers the whole viewport).

// The home screen (see index.html and home.css): shown on load, and again
// whenever a player leaves a game (HOME in the Game tab, NEW GAME on the
// winner screen). Shown/hidden with an inline display, so no ".hidden"
// cascade-order issues (see .flip-coin-overlay.hidden in linotte.css).
const homeOverlay = document.getElementById("home-overlay");

function hideHomeScreen() {
    homeOverlay.style.display = "none";
}

function isHomeShown() {
    return homeOverlay.style.display !== "none";
}

// A game left for the home stays in memory, paused, and the home offers to
// continue it. Online games can't wait (the server's clock runs on), so
// leaving one ends it; a finished game has nothing to continue.
function canContinueGame() {
    return (gameInProgress && !isGameOver && controller.mode !== "online") || Boolean(savedGame());
}

// An off-line game (vs bot or same table) also survives closing the app: it
// is saved at the start of every turn, and the home offers it back on the
// next launch. Saved between turns only, so it resumes with a fresh roll
// for whoever's turn it was. Cleared when the game ends or another starts.
const SAVED_GAME_KEY = "linotte-saved-game";

function saveOfflineGame() {
    if (!gameInProgress || isGameOver || !controller || controller.mode === "online") return;
    try {
        localStorage.setItem(SAVED_GAME_KEY, JSON.stringify({
            v: 1, mode: controller.mode, strategy: botStrategy, state: gameState, savedAt: Date.now(),
        }));
    } catch { /* storage off: the game only lives while the app is open */ }
}

function clearSavedGame() {
    try { localStorage.removeItem(SAVED_GAME_KEY); } catch { /* nothing saved */ }
}

// The saved game, if there is one and nothing is running in its place.
function savedGame() {
    if (gameInProgress) return null;
    try {
        const g = JSON.parse(localStorage.getItem(SAVED_GAME_KEY) || "null");
        return g?.v === 1 && (g.mode === "bot" || g.mode === "offline") && g.state?.players ? g : null;
    } catch {
        return null;
    }
}

// Picks a saved game up again: the board, scores and pieces as they were,
// at the start of the turn that was about to be played.
function resumeSavedGame() {
    const g = savedGame();
    if (!g) return false;
    gameState = g.state;
    if (g.mode === "bot") startBot(g.strategy || "points");
    else startOffline();
    gameInProgress = true;
    turnHandoverPending = false;
    isGameOver = false;
    endGameSequenceStarted = false;
    rollBtnEnabled = true;
    doneBtnEnabled = true;
    clearForNextTurn();
    renderOnlineBoard(); // draws any game from gameState, not only online ones
    applyFlip(gameState.currentPlayer);
    startTurnTimer();
    if (controller.mode === "bot" && gameState.currentPlayer === 2) playBotTurn();
    return true;
}

// "Continue your game" on the home: the paused game in memory, or one saved
// by an earlier launch.
function refreshContinueCard() {
    const card = document.getElementById("home-continue");
    if (!canContinueGame()) { card.hidden = true; return; }
    const saved = savedGame();
    const state = saved ? saved.state : gameState;
    const mode = saved ? saved.mode : controller.mode;
    const p = state.players;
    const turn = p[state.currentPlayer].name;
    document.getElementById("home-continue-desc").textContent = mode === "bot"
        ? t("Vs bot · You {me} – Bot {bot}", { me: p[1].points, bot: p[2].points })
        : t("Same table · {p1} {a} – {p2} {b} · {turn}'s turn", { p1: p[1].name, a: p[1].points, p2: p[2].name, b: p[2].points, turn });
    card.hidden = false;
}

function showHomeScreen() {
    optionsOverlay.classList.add("hidden");
    flipPending = false;
    document.body.classList.remove("table-flipped"); // the home is never upside down
    document.getElementById("winner-overlay").style.display = "none";
    if (canContinueGame()) setPaused(true);
    refreshContinueCard();
    homeOverlay.style.display = "";
}

function markActiveMode() {}

function startOffline() {
    controller = new GameController("offline");
    controller.setState(gameState);
    markActiveMode();
}

function startOnline() {
    controller = new GameController("online", onlineClient);
    controller.setState(gameState);
    markActiveMode();
}

function startBot(strategy = "points") {
    botStrategy = strategy;
    LOCAL_PLAYER = 1;
    controller = new GameController("bot");
    controller.setState(gameState);
    markActiveMode();
}




//------ PLAYERS ---------------

// Player 1 (the one holding the phone) plays with their favorite piece if
// they chose one in the options; player 2 gets one that looks clearly
// different (see public/shared/pieces.js, shared with the game server).
function assignRandomPieces(state) {
    const [p1, p2] = pickPieceIndexes(favoritePiece(), -1);
    for (const [seat, i] of [[1, p1], [2, p2]]) {
        state.players[seat].pieceImage = piecesPath + pieces[i];
        state.players[seat].color = "#" + pieces[i].split("_")[1].slice(0, 6);
    }
}

// The favorite piece from the options (-1: random). Read straight from the
// cookie: this runs before the options section is set up. Only Pro players
// play with it; the choice is kept for if they become Pro again.
function favoritePiece() {
    if (!lastKnownPro()) return -1;
    const i = Number(getCookie("piece", -1));
    return isPlayPiece(i) ? i : -1;
}

assignRandomPieces(gameState);

const selectedColor = [null, gameState.players[1].color, gameState.players[2].color];
applyPlayerVisuals();
renderPlayerBox(gameState.currentPlayer);
renderPieceCounts();
renderPointCounts();

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


// True from the moment a turn is committed (DONE) until every animation that
// turn triggered has finished and the next turn is handed over -- nobody can
// act, the page doesn't rotate and the active-player highlight doesn't move
// before then.
let turnHandoverPending = false;
const TURN_HANDOVER_BEAT_MS = 700; // pause after the last animation, before the page flips / the turn passes

function isMyTurn() {
    if (isPaused) return false;
    if (turnHandoverPending) return false;
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
    // Online, the server says who is Pro: they carry their badge, a star and
    // their level. Everything else (country, Pro, level) is on the card a
    // tap on the box opens (showPlayerCard).
    for (const seat of [1, 2]) {
        const p = gameState.players[seat];
        const box = document.getElementById(seat === 1 ? "playerP1" : "playerP2");
        box.classList.toggle("is-pro", Boolean(p.pro));
        box.dataset.badge = p.pro ? `★ ${p.level ?? 0}` : "";
    }
    // Online names ("Crane36") are longer than YOU/BOT/P1: a smaller size
    // keeps them whole instead of ending in "...".
    textPlayerP1.classList.toggle("long", gameState.players[1].name.length > 5);
    textPlayerP2.classList.toggle("long", gameState.players[2].name.length > 5);
}

// A tap on a player's box: who they are. Their name, country and, online,
// whether they're Pro and their level (only Pro players show it to others).
// This phone's player sees their own, Pro or not.
function showPlayerCard(seat) {
    const p = gameState.players[seat];
    if (!p || !gameInProgress) return;
    const mine = controller.mode !== "offline" && seat === (controller.mode === "online" ? LOCAL_PLAYER : 1);
    const isBot = controller.mode === "bot" && seat === 2;
    byId("pc-name").textContent = mine ? (profile?.name || p.name) : p.name;

    const country = mine ? (controller.mode === "online" ? p.country : profile?.country) : p.country;
    let countryName = country;
    try { countryName = new Intl.DisplayNames([LANG, "en"], { type: "region" }).of(country); } catch { /* the code */ }
    byId("pc-country").textContent = country ? `${flagOf(country)}\u2002${countryName}` : "";
    byId("pc-country").hidden = !country;

    const pro = mine ? document.body.classList.contains("is-pro") : Boolean(p.pro);
    const plan = byId("pc-plan");
    plan.hidden = isBot || controller.mode === "offline";
    plan.textContent = pro ? `★ ${t("Linotte Pro")}` : t("Free version");
    plan.classList.toggle("is-pro", pro);

    const level = mine ? levelOf(myXp()) : p.pro && p.level != null ? p.level : null;
    byId("pc-level").textContent = level === null ? "" : t("Level {n}", { n: level });
    showOnlineView("player");
}
boxPlayer1.addEventListener("click", () => showPlayerCard(1));
boxPlayer2.addEventListener("click", () => showPlayerCard(2));

// This phone's player's points: the account's (from the server), or the
// guest's (kept on the phone, see stats.js).
function myXp() {
    return currentUser() ? lastKnownXp() ?? 0 : guestXp();
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
    // Appended to <html>, not <body>: its position comes from screen
    // coordinates, and the body is itself turned 180deg while flipped, which
    // would land it mirrored. Turned to match the page so it reads the same
    // way up (and slides the same way) as the number it replaces.
    document.documentElement.appendChild(outgoing);
    if (document.body.classList.contains("table-flipped")) outgoing.style.rotate = "180deg";
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
    // Sized off the game column's font (30px next to the 16px one on a
    // portrait phone), not the screen: the stylesheet's 8vw made it 67px
    // on a landscape phone.
    const colFont = parseFloat(getComputedStyle(anchorEl.closest(".flex-block") || anchorEl).fontSize);
    if (colFont) popup.style.fontSize = (colFont * 1.875) + "px";
    // On <html>, turned with the page when flipped: same reason as the
    // outgoing number in tickStat (screen coordinates, body is turned).
    document.documentElement.appendChild(popup);
    if (document.body.classList.contains("table-flipped")) popup.style.rotate = "180deg";
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
}


// Background filenames are hyphenated slugs ("sun-tornado.svg"), not
// display names -- bg-title used to just slice off the ".svg" and show the
// raw slug verbatim ("sun-tornado"), which read like an internal filename
// leaking into the UI. This turns it into a normal human label ("Sun
// Tornado") instead.
function humanizeBgName(filename) {
    return filename
        .slice(0, -4)
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

//----------- COOKIES ---------------
let tidyness = getCookie("tidyness", 2);
document.getElementById("bo" + tidyness).classList.add("selected"); //option section
renderTidyness(tidyness);

let dieCookie = getCookie("diceFaces", 3);
document.getElementById("do" + dieCookie).classList.add("selected"); //option section
document.getElementById("dice-title").textContent = t(diceNames[dieCookie]);
let faces = diceFaces[dieCookie];  //faces of the selected die

let selectedDie = dicePath + faces;
preload(selectedDie);

let selectedBg = getCookie("background", 4);
document.getElementById("bg" + selectedBg).classList.add("selected"); //option section
document.getElementById("bg-title").textContent = humanizeBgName(backgrounds[selectedBg]);
for (let i = 0; i < backgrounds.length; i++) {
    preload(bgPath + backgrounds[i]);
}
body.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);
optBgs.forEach(el => el.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]));
modal.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);

let isVolumeOn = true;
isVolumeOn = toBoolean(getCookie("volumeOn", "true"));
if (isVolumeOn == true) {
    document.getElementById("sound-on").classList.add("selected");
} else {
    document.getElementById("sound-off").classList.add("selected");
}
// The section title says which one is on.
function updateSoundTitle() {
    document.getElementById("sound-title").textContent = isVolumeOn ? t("Sound") : t("No sound");
}
updateSoundTitle();


function setCookie(name, value, days = 365) {
    prefChanged(name); // dice, background, board and piece follow the account (see "Profile")
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

// (No turn timer on load: it starts with the game, in newGameVsBot/newGameOffline.
// A timer running behind the home screen eventually expired, ended a turn
// nobody was playing, and started the bot rolling dice with sound.)

//----------- PAUSE -----------------
// Freezes the turn timer and the bot (sleep() below holds while paused) and
// makes isMyTurn() false so dice/calls/tiles/ROLL/DONE ignore input too.
let isPaused = false;
let timerWasRunning = false;
let pauseWaiters = [];
const pauseBtn = document.getElementById("pause-btn");

function setPaused(paused) {
    if (paused === isPaused) return;
    isPaused = paused;
    pauseBtn.classList.toggle("is-paused", paused);
    pauseBtn.classList.toggle("selected", paused);
    document.getElementById("clock-wrap").classList.toggle("paused", paused);
    if (paused) {
        timerWasRunning = timerId !== null;
        stopTimer();
    } else {
        // Resume from where it stopped: the next tick lands a full second
        // later instead of re-running tick() (which would drop a second).
        if (timerWasRunning && timerId === null) timerId = setTimeout(tick, 1000);
        timerWasRunning = false;
        const waiters = pauseWaiters;
        pauseWaiters = [];
        waiters.forEach(resolve => resolve());
    }
}

// No pausing a game with another person in it (the server's clock runs on).
pauseBtn.addEventListener("click", () => {
    if (controller.mode === "online") return;
    setPaused(!isPaused);
});

// Restarts the turn clock from `seconds` (a game resumed mid-turn), instead
// of the fresh MAX_TIMER startTurnTimer() gives.
function resumeTurnTimer(seconds) {
    stopTimer();
    value = Math.max(0, Math.min(MAX_TIMER, seconds));
    startTimer();
}




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
// From the game (the options icon) the menu opens on the Game tab; from the
// home (the settings button) it has no Game tab and opens on Options, or on
// How to play.
function openOptions(context, page) {
    optionsOverlay.dataset.context = context;
    if (context === "game") updateGameTab();
    optionsOverlay.classList.remove("hidden");
    alignWithHome();
    handleTab(page);
    centerLists();
}

// Opened from the home, the header (in the home's units, see linotte.css)
// is nudged by the last fraction of a pixel so the back arrow covers the
// options icon exactly: the top bar's height also depends on the PRO button.
function alignWithHome() {
    const header = optionsOverlay.querySelector(".opt-header");
    header.style.removeProperty("translate");
    const settings = document.getElementById("home-settings");
    if (optionsOverlay.dataset.context !== "home" || !settings.offsetWidth) return;
    // Centres: the icon is still shrunk by its press (.is-pressed) when the
    // menu opens, which moves its edges but not its centre.
    const centre = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const [fx, fy] = centre(settings);
    const [tx, ty] = centre(document.getElementById("icon-back"));
    header.style.translate = `${fx - tx}px ${fy - ty}px`;
}

openBtn.onclick = () => openOptions("game", "game");

// The Game tab only offers what fits the game in progress: pause and
// restart off-line (an online game's clock runs on the server), FLIP only
// at the same table.
function updateGameTab() {
    const mode = controller.mode;
    const live = gameInProgress && !isGameOver;
    document.getElementById("pause-slot").hidden = mode === "online" || !live;
    document.getElementById("flip-slot").hidden = mode !== "offline";
    document.getElementById("restart-slot").hidden = mode === "online" || !gameInProgress;
}

// Closes the menu. The "hidden" class, not display:none -- the open button
// only removes that class, so an inline display:none could never be undone.
// A FLIP that happened while it was open (the option toggled, or a turn
// handed over) turns the game now, once the menu is out of the way.
function closeOptions() {
    optionsOverlay.classList.add("hidden");
    // Back on the home, the arrow turns into the options icon again.
    if (optionsOverlay.dataset.context === "home") {
        const settings = document.getElementById("home-settings");
        settings.classList.remove("from-back");
        void settings.offsetWidth;
        settings.classList.add("from-back");
    }
    if (flipPending) {
        flipPending = false;
        applyFlip();
    }
}

optionsOverlay.addEventListener("click", (e) => {
    if (e.target === optionsOverlay) closeOptions();
});

document.querySelectorAll(".icon").forEach(icon => {
    icon.onclick = () => {
        if (icon.classList.contains("disabled")) return;

        handleTab(icon.dataset.page);
    };
});

// The options tab showing now, so the indicator can be put back under it
// after a rotation or resize moves the icons (see onViewportChange).
let currentOptionsTab = "game";

function handleTab(page) {
    if (page === "back") {
        closeOptions();
        return;
    }

    // cambia pagina
    document.querySelectorAll(".opt-page").forEach(p => p.classList.add("hidden"));
    document.getElementById("page-" + page).classList.remove("hidden");

    currentOptionsTab = page;
    moveIndicator(page);
    if (page === "options") requestAnimationFrame(() => centerLists());
}

function moveIndicator(page) {
    // Relative to the header (the indicator's positioned parent), which is
    // centered and no longer starts at x=0 on wide screens.
    const headerLeft = document.querySelector(".opt-header").getBoundingClientRect().left;
    const rect1 = document.getElementById("icon-tab1").getBoundingClientRect();
    const rect2 = document.getElementById("icon-tab2").getBoundingClientRect();
    const rect3 = document.getElementById("icon-tab3").getBoundingClientRect();

    // Centred under its icon, whatever the two sizes (larger from the home).
    const indicator = document.getElementById("tabIndicator");
    const under = (r) => r.left - headerLeft + (r.width - indicator.offsetWidth) / 2;
    const map = { game: under(rect1), options: under(rect2), help: under(rect3) };
    indicator.style.left = map[page] + "px";
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
        updateSoundTitle();
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
// `forcedWinner` (online): the server already decided who starts; the coin
// only animates to that result.
function flipCoin(nameP1, nameP2, forcedWinner = 0) {
    return new Promise((resolve) => {
        const overlay = document.getElementById("coin-flip-overlay");
        const coin = document.getElementById("flip-coin");
        const resultText = document.getElementById("coin-result-text");

        resultText.textContent = "";
        overlay.classList.remove("hidden");

        const winner = forcedWinner || (Math.random() < 0.5 ? 1 : 2); // 1 = front face lands up, 2 = back face
        const spins = 5; // extra full turns before landing, purely for a satisfying flip
        const finalDeg = spins * 360 + (winner === 2 ? 180 : 0);

        coin.style.transform = "rotateY(0deg)";
        void coin.offsetWidth; // force a reflow so the reset above is committed before animating

        const animation = coin.animate(
            [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${finalDeg}deg)` }],
            { duration: 1400, easing: "cubic-bezier(.2,.6,.25,1)", fill: "forwards" }
        );

        animation.onfinish = () => {
            const starter = winner === 1 ? nameP1 : nameP2;
            resultText.textContent = starter === t("YOU") ? t("You start!") : t("{name} starts!", { name: starter });
            setTimeout(() => {
                overlay.classList.add("hidden");
                resolve(winner);
            }, 900);
        };
    });
}

// Same-table (hotseat) only: passes the "upright" view to whoever's turn
// it actually is, without the board itself turning with it -- see
// body.table-flipped/.div-table in linotte.css for the actual mechanism
// (page rotates 180deg, board rotates an extra 180deg on top to cancel
// that back out).
// FLIP is a selectable option (like the sound buttons): when selected, the
// page only flips while it's player 2's turn, so each person gets an upright
// view on their own turn. See body.table-flipped in linotte.css.
// Remembered between games and visits (cookie, like the other options).
let flipOptionOn = toBoolean(getCookie("flipOn", "false"));
document.getElementById("flip-table-btn").classList.toggle("selected", flipOptionOn);
// `viewPlayer` is whose side the page is currently turned to; it only changes
// when a turn is actually handed over (or the winner is shown), never at the
// moment a turn is committed, so the page doesn't rotate mid-animation.
let viewPlayer = 1;
// Set when the game should turn while the menu is open: the menu itself
// doesn't turn under the player's finger; closeOptions() turns the game.
let flipPending = false;
function applyFlip(player = viewPlayer) {
    viewPlayer = player;
    if (!optionsOverlay.classList.contains("hidden") && optionsOverlay.dataset.context === "game") {
        flipPending = true;
        return;
    }
    const flipped = flipOptionOn && controller.mode === "offline" && player === 2;
    document.body.classList.toggle("table-flipped", flipped);
}
document.getElementById("flip-table-btn").addEventListener("click", () => {
    if (controller.mode !== "offline") return;
    flipOptionOn = !flipOptionOn;
    setCookie("flipOn", flipOptionOn);
    document.getElementById("flip-table-btn").classList.toggle("selected", flipOptionOn);
    applyFlip();
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

        closeOnlineOverlay();
        flipCoin(t("YOU"), "BOT").then((startingPlayer) => {
            newGameVsBot(btn.dataset.strategy, startingPlayer);
            hideHomeScreen();
            handleTab("back");
        });
    });
});

function newGameVsBot(strategy, startingPlayer = 1) {
    leaveOnlineGameIfAny();
    clearSavedGame(); // a new game replaces any saved one
    gameInProgress = true;
    turnHandoverPending = false;
    setPaused(false);
    gameState = createInitialGameState();
    gameState.currentPlayer = startingPlayer;
    gameState.players[1].name = t("YOU");
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
    saveOfflineGame();

    if (gameState.currentPlayer === 2) {
        startTurnTimer(); // the bot's turn is timed too, same as when it follows the player's
        playBotTurn(); // the coin flip picked the bot to go first
    } else {
        startTurnTimer();
    }
}

// "Same table" hotseat: two people share this device and take turns as
// P1/P2 -- see isMyTurn()'s "offline" branch, which never dims/disables
// either side's controls since there's only one local player either way.
function newGameOffline(startingPlayer = 1) {
    leaveOnlineGameIfAny();
    clearSavedGame(); // a new game replaces any saved one
    gameInProgress = true;
    turnHandoverPending = false;
    setPaused(false);
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
    saveOfflineGame();
    applyFlip(gameState.currentPlayer);
    startTurnTimer();
}

function clearBoardVisuals() {
    forcedWinner = null; // every new game (any mode) starts with no forfeit on record
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
        document.getElementById("dice-title").textContent = t(diceNames[dieId]);
        faces = diceFaces[dieId];
        selectedDie = dicePath + faces;
        const diceSpriteImg = new Image();
        diceSpriteImg.src = selectedDie;
        setCookie("diceFaces", dieId);
        renderDiceFace(dieId);
        centerLists(true);
    });
});


const bgOptions = document.querySelectorAll(".bg-options");
bgOptions.forEach(bgOption => {
    bgOption.addEventListener("click", () => {
        bgOptions.forEach(t => t.classList.remove("selected"));
        bgOption.classList.add("selected");

        var bgId = Number(bgOption.id[2]);
        document.getElementById("bg-title").textContent = humanizeBgName(backgrounds[bgId]);

        body.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
        optBgs.forEach(el => el.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]));
        modal.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
        setCookie("background", bgId);
        centerLists(true);
    });
});


//----- favorite piece (options) -----
// "Random" first (a die), then every piece a player can play with, each on a
// tile like the board's. Choosing a piece is part of Linotte Pro: without it
// the pieces show a padlock and say so when tapped. Remembered like the
// other options, follows the account, and used from the next game (online
// too: the server is told, and checks Pro itself).
(function buildPieceOptions() {
    const list = document.getElementById("piece-list");
    const add = (i, src, label) => {
        const li = document.createElement("li");
        li.className = "car-item";
        const item = document.createElement("div");
        item.className = "car-item-content piece-options" + (i === -1 ? " is-random" : " is-pro-only");
        item.id = "po" + i;
        item.setAttribute("aria-label", label);
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        item.appendChild(img);
        li.appendChild(item);
        list.appendChild(li);
        item.addEventListener("click", () => {
            if (i !== -1 && !lastKnownPro()) return showToast(t("Pro version only"));
            selectPiece(i);
        });
    };
    add(-1, "resources/images/random-die.svg", t("Random piece"));
    for (let i = FIRST_PLAY_PIECE; i < pieces.length; i++) add(i, piecesPath + pieces[i], "Piece " + (i + 1));
    showPieceChoice(favoritePiece());
})();

function showPieceChoice(i) {
    document.querySelectorAll(".piece-options").forEach((el) => el.classList.toggle("selected", el.id === "po" + i));
    document.getElementById("piece-title").textContent = isPlayPiece(i) ? t("Your piece") : t("Random piece");
}

function selectPiece(i) {
    const piece = isPlayPiece(i) ? i : -1;
    setCookie("piece", piece);
    // Without Pro the choice is kept but "random" is what's played and shown.
    showPieceChoice(favoritePiece());
    centerLists(true);
    onlineClient?.setPiece(favoritePiece());
}

//----- language (options) -----
// English, Italiano, Français; picking one reloads the page in it (see i18n.js).
(function buildLanguageOptions() {
    const list = document.getElementById("language-list");
    for (const { code, name } of LANGUAGES) {
        const slot = document.createElement("div");
        slot.className = "car-btn";
        const btn = document.createElement("div");
        btn.className = "opt-btn lang-btn" + (code === LANG ? " selected" : "");
        btn.textContent = name;
        btn.lang = code;
        btn.setAttribute("role", "button");
        btn.addEventListener("click", () => setLanguage(code, {
            reopen: { page: "options", scroll: document.getElementById("page-options").scrollTop },
        }));
        slot.appendChild(btn);
        list.appendChild(slot);
    }
})();

function renderTidyness(tidyness) {
    const boardTitle = document.getElementById("board-title");
    const boardTexts = document.querySelectorAll('.board-options-text');
    boardTexts.forEach(t => t.classList.remove('selected'));

    if (tidyness == 0) { boardTitle.textContent = t("Perfect"); }
    if (tidyness == 1) { boardTitle.textContent = t("Tidy"); }
    if (tidyness == 2) { boardTitle.textContent = t("Natural"); }

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
// Each carousel (dice, backgrounds...) scrolls sideways to its current
// choice. Only the carousel moves: scrollIntoView would also scroll the page
// up or down to it. Runs whenever the Options tab is shown (a hidden list
// has no size to scroll), right away, without an animation.
function centerLists(smooth = false) {
    document.querySelectorAll("#page-options .car-list").forEach(list => {
        const selected = list.querySelector(".selected");
        if (!selected || !list.clientWidth) return;
        const item = selected.closest(".car-item") || selected;
        const listBox = list.getBoundingClientRect();
        const itemBox = item.getBoundingClientRect();
        const left = list.scrollLeft + (itemBox.left - listBox.left) - (list.clientWidth - itemBox.width) / 2;
        list.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
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

// A tap anywhere on the winner screen, the dimmed backdrop included, throws
// a burst (the back icon and the piece have their own taps and stop it).
document.getElementById("winner-overlay").addEventListener("click", () => {
    fireWinnerConfetti(200);
});

document.getElementById("piece-popup").addEventListener("click", (e) => {
    e.stopPropagation();
    restartAnimation();
});

// NEW GAME: back to the home screen, to pick the next mode (it used to
// reload the whole page).
//----------- REMATCH ---------------
// Another game against the same opponent, from the winner screen. Against
// the bot or at the same table it starts at once; online the other player
// has to say yes (the server's bot answers like a person would).
let lastOverReason = "normal";

function showRematchState(state) {
    const btn = document.getElementById("winner-rematch");
    const text = document.getElementById("winner-rematch-text");
    btn.hidden = state === "left";
    btn.classList.toggle("is-waiting", state === "waiting");
    btn.classList.toggle("is-offered", state === "offered");
    text.textContent = t({ waiting: "WAITING...", offered: "REMATCH?", declined: "NO REMATCH" }[state] || "REMATCH");
    if (state === "offered") showToast(t("Your opponent wants a rematch."));
    if (state === "declined") { btn.classList.add("is-waiting"); showToast(t("Your opponent doesn't want a rematch.")); }
}

document.getElementById("winner-rematch").addEventListener("click", async (e) => {
    e.stopPropagation();
    if (controller.mode === "bot") return newGameVsBot(botStrategy);
    if (controller.mode === "offline") return newGameOffline();
    showRematchState("waiting");
    const res = await onlineClient.rematch();
    if (!res.ok) showRematchState(res.error === "opponent_left" || res.error === "no_game" ? "left" : "ready");
    // ok: either waiting for the other player, or a "game_start" is on its way
});

document.getElementById("winner-button").addEventListener("click", (e) => {
    e.stopPropagation();
    leaveToHome();
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

    // ROLL/DONE and the "[name] turn" label (see divsOpacity) are all dead
    // now that there's no next turn -- replaced, in both modes, by a single
    // green DONE in their place, which just reopens the winner popup (see
    // doneButton's isGameOver branch) if it gets dismissed.
    rollBtn.style.display = "none";
    doneBtn.style.display = "none";
    turnLabelEl.style.display = "none";
    endGameDoneBtn.style.display = "flex";

    // The popup itself is shown by the caller (see playEndGameSequence in
    // performEndTurn), once the end-of-game fairy trail celebration has
    // played -- showing it immediately here would cover the board with the
    // overlay before there's anything left to see.
    return true;
}

// Set when an online game ends by someone leaving, so DONE (which reopens the
// winner popup) keeps naming that player instead of comparing points.
let forcedWinner = null;

// Stats: each finished game is recorded once (the winner popup can be shown
// again with DONE). gameState is a new object for every game.
let recordedGame = null;
function noteGameResult(winner) {
    if (recordedGame === gameState) return;
    recordedGame = gameState;
    showRematchState(lastOverReason === "normal" || controller.mode !== "online" ? "ready" : "left");
    lastOverReason = "normal";
    const mode = controller.mode === "bot" ? "bot" : controller.mode === "online" ? onlineKind : null;
    if (!mode) return; // "Same table": nobody's own game
    const me = controller.mode === "online" ? LOCAL_PLAYER : 1;
    const other = me === 1 ? 2 : 1;
    // A win may raise the level: asked again once the game is recorded (by
    // the server for an online game, by recordGame for one against the bot).
    const xpBefore = myXp();
    const recorded = recordGame({
        mode,
        won: winner === me,
        points: gameState.players[me].points,
        opponentPoints: gameState.players[other].points,
        opponent: controller.mode === "bot" ? "Bot" : gameState.players[other].name,
    });
    if (winner === me && currentUser()) {
        recorded.then(() => setTimeout(() => refreshPro({ fresh: true }), mode === "bot" ? 0 : 1500));
    } else if (!currentUser()) {
        recorded.then(() => {
            if (levelOf(guestXp()) > levelOf(xpBefore)) showToast(t("Level {n}!", { n: levelOf(guestXp()) }));
            showHomeBadge();
        });
    }
}

function determineWinner() {
    if (forcedWinner !== null) return forcedWinner;
    if (gameState.players[1].points > gameState.players[2].points) return 1;
    if (gameState.players[1].points < gameState.players[2].points) return 2;
    return 0; // tie
}


function showWinnerPopup(winner) {
    noteGameResult(winner);
    const pointsEl = document.getElementById("winner-points");
    if (winner) { // both player 1 or 2
        document.getElementsByClassName("piece-popup-container")[0].classList.add("pulse");
        document.getElementsByClassName("piece-popup-container")[0].style.setProperty("--glow", gameState.players[winner].color);
        document.getElementById("piece-popup").style.backgroundImage = urlOf(gameState.players[winner].pieceImage);
        // Uses whatever name is currently showing in that player's info
        // box (still "YOU"/"BOT" until name selection exists) rather than
        // a hardcoded "Player 1/2".
        document.getElementById("winner-overlay").style.display = "flex";
        const winnerName = gameState.players[winner].name;
        setWinnerText(winnerName === t("YOU") ? t("You won!") : t("{name} won!", { name: winnerName }));
        animateWinnerPoints(pointsEl, gameState.players[winner].points);
        fireWinnerConfetti(3000);
    } else {
        document.getElementsByClassName("piece-popup-container")[0].classList.remove("pulse");
        document.getElementsByClassName("piece-popup-container")[0].style.setProperty("--glow", "rgba(0, 0, 0, .2)");
        document.getElementById("piece-popup").style.backgroundImage = urlOf("resources/images/tie.svg");
        document.getElementById("winner-overlay").style.display = "flex";
        setWinnerText(t("It's a tie!"));
        pointsEl.textContent = "";
        pointsEl.classList.remove("winner-points-reveal");
        fireWinnerConfetti(500);
    }
}

// The winner card's headline, shrunk to the card's width when it doesn't fit
// (see .winner-text): down to 60% of its size on one line, and past that on
// balanced lines at 60%. The overlay must be showing so it can be measured.
const WINNER_TEXT_MIN_FIT = .6;
function setWinnerText(text) {
    const el = document.getElementById("winner-text");
    el.textContent = text;
    fitWinnerText();
}
function fitWinnerText() {
    const el = document.getElementById("winner-text");
    el.style.removeProperty("--fit");
    el.classList.remove("wraps");
    const room = el.parentElement.clientWidth;
    const width = el.scrollWidth;
    if (!room || width <= room) return;
    const fit = room / width * .97;
    if (fit >= WINNER_TEXT_MIN_FIT) {
        el.style.setProperty("--fit", fit.toFixed(3));
    } else {
        el.style.setProperty("--fit", WINNER_TEXT_MIN_FIT);
        el.classList.add("wraps");
    }
}
// The card's size follows the window (rotation, split screen).
window.addEventListener("resize", () => {
    if (document.getElementById("winner-overlay").style.display === "flex") fitWinnerText();
});

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
        shineSpan.textContent = t(value === 1 ? "{n} point" : "{n} points", { n: value });
        if (t < 1) requestAnimationFrame(step);
    })(start);
}


function fireWinnerConfetti(duration) {
    const end = Date.now() + duration;
    // Shot from the two side edges. Nearly straight up suits a tall portrait
    // screen; on a wide landscape one that keeps them at the edges, so there
    // they're aimed further in, toward the middle.
    const tilt = window.matchMedia("(orientation: landscape)").matches ? 30 : 5;

    (function frame() {
        confetti({
            particleCount: 6,
            angle: 90 - tilt,
            spread: 60,
            origin: { x: 0 }
        });

        confetti({
            particleCount: 6,
            angle: 90 + tilt,
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
    // Take back a tentative piece BEFORE rolling: online the moves reach
    // the server in this order, and while the dice roll it refused the
    // cancel, then redrew the screen with the piece still placed and no
    // dice animation.
    tileElements.forEach(el => el.classList.remove("tile_highlighted"));
    rrElements.forEach(el => el.classList.remove("highlighted"));
    removePiece(selectedTileId);

    const rollsBefore = gameState.dice.rollsLeft;
    controller.dispatch({ type: "ROLL_DICE" });
    rollAnimationID = setInterval(rollAnimation, 100);
    stopRollID = setInterval(stopRoll, 1200);

    // Online, the roll only lands when the server's dice come back, so the
    // counter can't be read from the state yet.
    setRollsLeftUI(controller.mode === "online" ? rollsBefore - 1 : gameState.dice.rollsLeft);
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
    // The dice sit in a single tight row, so the pieces' ±7px "natural"
    // position scatter just read as dice that are slightly off-centre
    // (worse on a small phone screen). The tilt keeps the natural look; the
    // position stays close to centre.
    t = Math.min(t, 2);

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
    // Online: keep the dice tumbling until the server's numbers have arrived
    // (this interval simply fires again 1.2s later).
    if (controller.mode === "online" && !controller.rollArrived) return;
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
// A tap that can place/remove a piece does that, on release (a finger that
// slides off cancels it). Any other touch on an occupied tile (either
// player's, any time) makes its piece bounce right away, as the finger lands.
const tileCanAct = (el) => isMyTurn() && pieceEnabled &&
    matrixCheck(idToCoo(el.id), possibleMovesLocal) !== 0;

document.querySelectorAll(".tile").forEach(el => {
    el.addEventListener("click", function () {
        if (tileCanAct(el)) handleTile(el.id);
    });
    el.addEventListener("pointerdown", function () {
        if (tileCanAct(el)) return;
        const piece = document.getElementById("p" + idToCoo(el.id));
        if (piece && piece.style.backgroundImage &&
            getComputedStyle(piece.parentElement).opacity === "1") {
            jumpPiece(...idToCoo(el.id), true);
        }
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

    // The tentative piece is gone: don't let the next placement "remove" it
    // a second time (that would also send a second cancel online).
    if (prewPiece && prewPiece.id === pieceId) prewPiece = null;

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
function jumpPiece(r, c, small = false) {
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
    wrapper.classList.remove("piece-jump", "piece-tap");
    void wrapper.offsetWidth;
    wrapper.classList.add("piece-jump");
    if (small) wrapper.classList.add("piece-tap"); // gentler bounce for a plain tap
    wrapper.addEventListener("animationend", () => {
        wrapper.classList.remove("piece-jump", "piece-tap");
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
// DONE needs at least one roll this turn (it used to pass the turn without
// rolling at all). Only the tap is gated: the turn clock running out still
// ends the turn through doneButton() directly.
doneBtn.addEventListener("click", () => {
    if (!isGameOver && gameState.dice.rollsLeft >= 3) return;
    doneButton();
});

// The ROLL label and the inactive look of ROLL/DONE (see .button.is-inactive
// in linotte.css) always change together: ROLL with no rolls left, DONE
// before the turn's first roll. Online, `n` is the count the player is about
// to have (the server's dice are still on their way).
function setRollsLeftUI(n) {
    rollBtnText.innerText = t("ROLL {n}", { n });
    rollBtn.classList.toggle("is-inactive", n < 1);
    doneBtn.classList.toggle("is-inactive", n >= 3);
}

//----------- PRESS FEEDBACK -----------------
// Every button sinks while it's held (.is-pressed in linotte.css). The class
// stays on for at least PRESS_MIN_MS so a quick tap still shows it.
const PRESSABLE = ".button, .winner-button, .chat-fab, .options, #icon-back, #winner-icon-back, .rules-play, .demo-icon-btn, .home-profile, .home-pro, .home-settings, .home-extra, .home-ad";
const PRESS_MIN_MS = 90;

document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(PRESSABLE);
    if (!el || el.classList.contains("is-inactive")) return;
    el.classList.add("is-pressed");
    const pressedAt = performance.now();
    const release = () => {
        window.removeEventListener("pointerup", release, true);
        window.removeEventListener("pointercancel", release, true);
        const wait = Math.max(0, PRESS_MIN_MS - (performance.now() - pressedAt));
        setTimeout(() => el.classList.remove("is-pressed"), wait);
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
}, { passive: true });

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

// Vs-bot's end-of-game stand-in for DONE (see checkGameOver) -- same
// "bring the winner popup back" behavior as DONE's own isGameOver branch
// above, just reachable from the button that's actually visible by then.
endGameDoneBtn.addEventListener("click", () => {
    showWinnerPopup(determineWinner());
});

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
    turnHandoverPending = true;
    // The piece count pops right away -- the piece really did just land on
    // the board -- but the score (see renderPointCounts below) waits until
    // the line that earned it has actually played.
    renderPieceCounts(before);

    if (checkGameOver()) {
        clearSavedGame();
        stopTimer();
        playEndGameSequence(lastMoveLines, before);
        return;
    }
    saveOfflineGame();

    // Several lines from one placement (e.g. a corner completing both a
    // row and a column) play one after another, never at the same time --
    // see playLinesSequentially. The next turn -- the bot's own turn, or
    // just the timer for whoever's turn it now is -- doesn't start until
    // ALL of this turn's animations (board lines, then the points hop)
    // have actually finished, so it never starts overlapping the previous
    // turn's celebration still playing out.
    playLinesSequentially(lastMoveLines, () => {
        celebratePoints(lastMoveLines, before, async () => {
            // A short beat after the last animation (the points change
            // included) before the turn actually passes -- only when
            // something played, so a plain turn isn't slowed down.
            if (lastMoveLines.length > 0) {
                await sleep(TURN_HANDOVER_BEAT_MS);
                if (!turnHandoverPending) return; // a new game started meanwhile
            }
            // Only now, with every animation done, does the turn actually
            // pass: highlight, controls dimming and (same-table) page flip.
            turnHandoverPending = false;
            renderPlayerBox(gameState.currentPlayer);
            divsOpacity(gameState.currentPlayer);
            applyFlip(gameState.currentPlayer);
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

// A short earthquake shake of the board (see @keyframes boardQuake in
// linotte.css) that builds up and is at its peak the moment it ends -- it
// leads straight into the winner popup. `onDone` runs exactly when it ends.
function shakeBoard(onDone) {
    const board = document.querySelector(".div-table");
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        board.classList.remove("quake");
        board.removeEventListener("animationend", onEnd);
        if (onDone) onDone();
    };
    // Only this animation's own end: animationend bubbles, and the pieces
    // inside the board hop (jumpPiece) right around the same time, whose end
    // would otherwise cut the shake short.
    const onEnd = (e) => {
        if (e.target === board && e.animationName === "boardQuake") finish();
    };
    board.classList.remove("quake");
    void board.offsetWidth; // restart the animation if it's still running
    board.classList.add("quake");
    board.addEventListener("animationend", onEnd);
    setTimeout(finish, 1200); // safety net if animationend never arrives
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
    // The page is never turned at the end of a game: it stays however it was
    // for the player who made the last move (upside down if that was player 2
    // in same-table mode) through every ending animation, the shake and the
    // popup, whoever ends up winning.
    playLinesSequentially(lastMoveLines, () => {
        celebratePoints(lastMoveLines, before, () => {
            // The winner's lines on the board, as whole runs.
            const winnerLines = winner ? findAllPlayerLines(gameState.table, winner) : [];
            // Exactly one line, and it's the one the deciding move just
            // played in step 1: nothing left to replay, so the popup follows
            // right away (after the usual beat). With more than one line,
            // the sweep below plays ALL of them, the deciding line included --
            // it already got its own turn in step 1, and then goes again as
            // part of the full victory lap.
            const justPlayedTheOnlyLine = winnerLines.length === 1
                && lastMoveLines.length > 0
                && lastMoveLines.every((window) =>
                    window.every(([wr, wc]) => winnerLines[0].some(([lr, lc]) => lr === wr && lc === wc)));
            const sweepLines = justPlayedTheOnlyLine ? [] : winnerLines;
            // Step 2: sweep the winner's lines on the board,
            // purely as a victory lap -- no further point changes, those
            // already happened in earlier turns.
            // A beat after the points land and before the victory lap starts.
            setTimeout(() => playLinesSequentially(sweepLines, () => {
                // A beat between the celebration and the popup, so the last
                // line doesn't feel cut off by the overlay appearing the
                // instant it finishes: the board shakes, building up, and the
                // popup lands the moment the shake ends (the shake is .5s, so
                // starting it 500ms in keeps the usual 1s beat overall).
                setTimeout(() => shakeBoard(() => showWinnerPopup(winner)), 500);
            }), sweepLines.length > 0 ? TURN_HANDOVER_BEAT_MS : 0);
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
// Counts only unpaused time, so a paused bot turn resumes mid-wait instead of
// carrying on (or skipping ahead) behind the player's back.
async function sleep(ms) {
    let left = ms;
    while (left > 0) {
        if (isPaused) {
            await new Promise(resolve => pauseWaiters.push(resolve));
            continue;
        }
        const step = Math.min(left, 100);
        await new Promise(resolve => setTimeout(resolve, step));
        if (!isPaused) left -= step;
    }
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
    setRollsLeftUI(gameState.dice.rollsLeft);
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
    setRollsLeftUI(3);
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
            if (document.querySelectorAll(".die.selected").length === 4 && targetDiv === "cc5") { syncCall(); return; }
            //Not possible to call carre on carre
            if (gameState.combinationsRealized[4] === 1 && targetDiv === "cc5") { syncCall(); return; }
            //Only if at least one die is rolled
            if (document.querySelectorAll(".die.selected").length === 5) { syncCall(); return; }

            targetDiv.classList.add("checked");
            gameState.called[targetId] = 1;
        }
        syncCall();
    });
});

// Tells the controller what the call selection now is -- online, that's what
// lets the opponent see the call being made.
function syncCall() {
    controller.dispatch({ type: "SELEC_CALL", called: gameState.called.slice() });
}


//----------- KEYBOARD SHORTCUTS ---------------
// 1-5 lock/unlock the matching die, 6-0 select/deselect the matching call
// (full, carre, petite, suite, yam in that order), space bar rolls, and D
// presses DONE. Every shortcut just clicks the same element a mouse would,
// so all the existing guards (isMyTurn, rollBtnEnabled, .selectable, the
// first-throw gate, etc.) apply identically — nothing is duplicated here.
const CALL_KEY_TO_RESULT_INDEX = { "6": 3, "7": 4, "8": 5, "9": 6, "0": 7 };

document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (!gameInProgress || isHomeShown()) return; // home screen: nothing to roll/place
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
    // Every call marks the start of a live turn (or game), so the
    // end-of-game button (see checkGameOver()) resets to hidden here, in
    // every mode -- checkGameOver() shows it again on the turn that ends
    // the game.
    endGameDoneBtn.style.display = "none";
    rollBtn.style.display = "";
    doneBtn.style.display = "";
    turnLabelEl.style.display = "none";
    // Undo a dimming left by the previous game (it can end on the bot's or
    // the opponent's turn); the hotseat never sets one of its own.
    document.getElementById("div-dice").style.opacity = "";
    document.getElementById("div-resultsAndCalls").style.opacity = "";
    if (controller.mode === "offline") return; // hotseat: never dim, both players share the controls
    if (!currentPlayer) return;
    // Dice and results/calls just dim a touch on the opponent's turn -- see
    // the [aria-disabled] rule in linotte.css for why the individual
    // dice/calls don't ALSO carry their own opacity (that would stack and
    // double-dim them). ROLL/DONE aren't dimmed alongside them anymore:
    // during the bot's turn they're swapped out entirely for a
    // "[name] turn" label below instead of sitting there dimmed and dead.
    const isBotTurn = currentPlayer !== LOCAL_PLAYER;
    const opacity = isBotTurn ? 0.8 : 1;
    document.getElementById("div-dice").style.opacity = opacity;
    document.getElementById("div-resultsAndCalls").style.opacity = opacity;

    if (isBotTurn) {
        rollBtn.style.display = "none";
        doneBtn.style.display = "none";
        turnLabelEl.style.display = "flex";
        turnLabelTextEl.textContent = t("{name} turn", { name: gameState.players[currentPlayer].name });
    }
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


//------------------ CHAT EMOJI WHEEL ----------------------
// Graphic-only placeholder for future online play -- there's no peer to
// send a thrown emoji to yet, so it just plays the toss animation locally.
const chatFab = document.getElementById("chat-fab");
const chatWheelOverlay = document.getElementById("chat-wheel-overlay");
const chatWheel = document.getElementById("chat-wheel");
const chatTossStage = document.getElementById("chat-toss-stage");

// The app's own emoji drawings (emoji.js) instead of the OS's glossy emoji
// font: flat and outlined like the rest of the game, identical everywhere,
// and part of the app (nothing to download, works offline). The buttons
// keep the emoji character in data-emoji -- that's what is sent online.
chatWheel.querySelectorAll(".chat-emoji").forEach((btn) => {
    btn.innerHTML = emojiMarkup(btn.dataset.emoji);
    btn.setAttribute("aria-label", emojiLabel(btn.dataset.emoji));
});

let chatWheelRotation = 0;
let chatWheelDragging = false;
let chatWheelPointerId = null;
let chatWheelDragStartAngle = 0;
let chatWheelDragStartRotation = 0;
let chatWheelDragStartX = 0;
let chatWheelDragStartY = 0;
let chatWheelDidDrag = false;
let chatWheelDownBtn = null;
let chatWheelLastAngle = 0;
let chatWheelLastTime = 0;
let chatWheelVelocity = 0; // degrees per ms, for the release-inertia spin below
let chatWheelInertiaFrame = null;

function chatWheelAngleFromCenter(x, y) {
    const rect = chatWheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

function setChatWheelRotation(deg) {
    chatWheelRotation = deg;
    // A custom property, not a plain transform -- .chat-emoji's own
    // transform (see linotte.css) reads this same value to counter-rotate
    // itself, so every emoji stays upright regardless of the dial's spin.
    chatWheel.style.setProperty("--wheel-rotation", chatWheelRotation + "deg");
}

function stopChatWheelInertia() {
    if (chatWheelInertiaFrame !== null) {
        cancelAnimationFrame(chatWheelInertiaFrame);
        chatWheelInertiaFrame = null;
    }
}

chatFab.addEventListener("click", () => {
    chatWheelOverlay.classList.remove("hidden");
});

chatWheelOverlay.addEventListener("click", (e) => {
    if (e.target === chatWheelOverlay) {
        stopChatWheelInertia();
        chatWheelOverlay.classList.add("hidden");
    }
});

chatWheel.addEventListener("pointerdown", (e) => {
    stopChatWheelInertia(); // grabbing the dial takes over from any spin still coasting
    chatWheelDragging = true;
    chatWheelDidDrag = false;
    chatWheelPointerId = e.pointerId;
    // setPointerCapture below re-targets the pointerup (and the click that
    // follows it) to chatWheel itself, no matter what's visually under the
    // pointer -- so a plain per-button "click" listener never actually
    // fires once capture is set on an ancestor. Recording the button a
    // press started on here, and acting on it in endChatWheelDrag's own
    // pointerup instead of waiting for a click that will never arrive, is
    // what makes picking an emoji work at all.
    chatWheelDownBtn = e.target.closest(".chat-emoji");
    chatWheelDragStartX = e.clientX;
    chatWheelDragStartY = e.clientY;
    chatWheelDragStartAngle = chatWheelAngleFromCenter(e.clientX, e.clientY);
    chatWheelDragStartRotation = chatWheelRotation;
    chatWheelLastAngle = chatWheelDragStartAngle;
    chatWheelLastTime = performance.now();
    chatWheelVelocity = 0;
    chatWheel.setPointerCapture(e.pointerId);
});

chatWheel.addEventListener("pointermove", (e) => {
    if (!chatWheelDragging || e.pointerId !== chatWheelPointerId) return;
    const now = performance.now();
    const currentAngle = chatWheelAngleFromCenter(e.clientX, e.clientY);
    const totalDelta = currentAngle - chatWheelDragStartAngle;
    // Drag detection is in screen pixels moved, NOT degrees rotated: the
    // emoji sit near the dial's rim, where a couple of px of ordinary tap
    // jitter is already several degrees of angle (close to the center,
    // the same jitter is nothing) -- an angle-based threshold was tripping
    // on perfectly normal taps and silently swallowing every pick, which
    // is why throwing an emoji looked like it was doing nothing at all.
    const movedPx = Math.hypot(e.clientX - chatWheelDragStartX, e.clientY - chatWheelDragStartY);
    if (movedPx > 8) chatWheelDidDrag = true;
    setChatWheelRotation(chatWheelDragStartRotation + totalDelta);

    // Instantaneous angular speed between this move and the last one (not
    // the average over the whole drag) -- this is what carries into the
    // release-inertia spin below, so a flick reads by its last motion, not
    // however the drag started.
    const dt = now - chatWheelLastTime;
    if (dt > 0) chatWheelVelocity = (currentAngle - chatWheelLastAngle) / dt;
    chatWheelLastAngle = currentAngle;
    chatWheelLastTime = now;
});

function endChatWheelDrag(e) {
    if (!chatWheelDragging) return;
    chatWheelDragging = false;

    // No drag happened and the press started on an emoji -- that's a pick,
    // handled here rather than via that button's own "click" listener,
    // which setPointerCapture (see pointerdown above) prevents from ever
    // receiving the event.
    if (!chatWheelDidDrag && chatWheelDownBtn) {
        stopChatWheelInertia();
        throwChatEmoji(chatWheelDownBtn.dataset.emoji, chatWheelDownBtn.getBoundingClientRect());
        if (controller.mode === "online" && gameInProgress && !isGameOver) {
            onlineClient.sendEmote(chatWheelDownBtn.dataset.emoji);
        }
        chatWheelOverlay.classList.add("hidden");
        chatWheelDownBtn = null;
        return;
    }
    chatWheelDownBtn = null;

    // Keeps spinning on its own after release and gradually slows down --
    // same "flick a dial" feel as a real one, instead of snapping dead the
    // instant the finger lifts.
    const FRICTION_PER_FRAME = 0.94; // at a 60fps frame (~16.67ms)
    const MIN_VELOCITY = 0.01; // deg/ms -- below this it's imperceptible, just stop
    let lastFrameTime = performance.now();
    function step(now) {
        const dt = Math.min(now - lastFrameTime, 48); // cap the step so a stutter/tab-switch can't fling it
        lastFrameTime = now;
        setChatWheelRotation(chatWheelRotation + chatWheelVelocity * dt);
        chatWheelVelocity *= Math.pow(FRICTION_PER_FRAME, dt / 16.6667);
        chatWheelInertiaFrame = Math.abs(chatWheelVelocity) > MIN_VELOCITY ? requestAnimationFrame(step) : null;
    }
    if (Math.abs(chatWheelVelocity) > MIN_VELOCITY) {
        chatWheelInertiaFrame = requestAnimationFrame(step);
    }
}
chatWheel.addEventListener("pointerup", endChatWheelDrag);
chatWheel.addEventListener("pointercancel", endChatWheelDrag);

function quadBezierPoint(p0, p1, p2, t) {
    const u = 1 - t;
    return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function throwChatEmoji(emoji, originRect) {
    const el = document.createElement("div");
    el.className = "chat-toss-emoji";
    el.innerHTML = emojiMarkup(emoji);

    const startX = originRect.left + originRect.width / 2;
    const startY = originRect.top + originRect.height / 2;

    // Lands somewhere scattered around the screen's center rather than
    // one exact fixed point, so repeated tosses don't all pile on the
    // same spot.
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight * 0.45;
    const scatterR = Math.min(window.innerWidth, window.innerHeight) * 0.14 * Math.random();
    const scatterAngle = Math.random() * Math.PI * 2;
    const endX = centerX + Math.cos(scatterAngle) * scatterR;
    const endY = centerY + Math.sin(scatterAngle) * scatterR;

    // A control point pushed out to one side of the straight start->end
    // line, so the quadratic curve it drives actually bows out into an
    // arc instead of flying in a straight line.
    const dx = endX - startX, dy = endY - startY;
    const dist = Math.hypot(dx, dy) || 1;
    const perpX = -dy / dist, perpY = dx / dist;
    const curveAmount = (Math.random() < 0.5 ? -1 : 1) * (dist * 0.2 + 24);
    const ctrlX = (startX + endX) / 2 + perpX * curveAmount;
    const ctrlY = (startY + endY) / 2 + perpY * curveAmount;

    el.style.left = startX + "px";
    el.style.top = startY + "px";
    chatTossStage.appendChild(el);

    const TRAVEL_MS = 1450;
    const HOLD_MS = 900; // a wandering stop at the landing spot before the pop, not an instant reaction
    const POP_MS = 60; // the actual burst -- see pop() below
    const startTime = performance.now();

    // Position and scale are driven frame-by-frame here rather than left as
    // a CSS transition -- a transition can only interpolate left/top in a
    // straight line between two fixed values, and the whole point of the
    // curve above is that it isn't one. No rotation: a spin here read as
    // noise, not energy. Opacity stays untouched (fully solid) for this
    // entire travel phase.
    function step(now) {
        const t = Math.min((now - startTime) / TRAVEL_MS, 1);
        const posT = 1 - Math.pow(1 - t, 3); // quick launch, soft landing
        const x = quadBezierPoint(startX, ctrlX, endX, posT);
        const y = quadBezierPoint(startY, ctrlY, endY, posT);
        const scale = 1 + posT * 0.6; // grows gently in flight -- the real "pop" is at arrival, below

        el.style.left = x + "px";
        el.style.top = y + "px";
        el.style.transform = `translate(-50%, -50%) scale(${scale})`;

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            holdAndPop(x, y);
        }
    }
    requestAnimationFrame(step);

    // Drifts gently in place for a beat -- like a bubble actually floating,
    // not a paused sprite -- before it bursts. Driven continuously here
    // (not a CSS keyframe loop) for two reasons: two sine waves per axis
    // with DIFFERENT frequencies/phases wander in a loose, organic loop
    // with no fixed back-and-forth to repeat, instead of sliding out and
    // snapping back along one straight line every cycle (which is what
    // actually read as mechanical); and it means the burst below can pick
    // up from wherever the drift actually left it, instead of snapping
    // back to dead-center first.
    function holdAndPop(landX, landY) {
        const freqX = 0.35 + Math.random() * 0.25; // Hz -- deliberately not equal to freqY
        const freqY = 0.35 + Math.random() * 0.25;
        // Phase is 0 or PI -- i.e. sin(phase) is always exactly 0 -- never
        // some arbitrary random angle. The travel phase ends with zero
        // offset from the landing point; starting the wander's very first
        // frame at a non-zero point on its sine curve (as a fully random
        // phase would, most of the time) is exactly what produced that
        // sudden snap the instant it was handed off from travel to hold.
        const phaseX = Math.random() < 0.5 ? 0 : Math.PI;
        const phaseY = Math.random() < 0.5 ? 0 : Math.PI;
        const ampX = 4 + Math.random() * 3;
        const ampY = 4 + Math.random() * 3;
        const holdStart = performance.now();
        let lastDx = 0, lastDy = 0, lastScale = 1.6;

        function holdStep(now) {
            const elapsed = now - holdStart;
            const tSec = elapsed / 1000;
            lastDx = ampX * Math.sin(2 * Math.PI * freqX * tSec + phaseX);
            lastDy = ampY * Math.sin(2 * Math.PI * freqY * tSec + phaseY);
            lastScale = 1.6 + 0.04 * Math.sin(2 * Math.PI * 0.6 * tSec);
            el.style.left = landX + lastDx + "px";
            el.style.top = landY + lastDy + "px";
            el.style.transform = `translate(-50%, -50%) scale(${lastScale})`;
            if (elapsed < HOLD_MS) {
                requestAnimationFrame(holdStep);
            } else {
                pop(landX + lastDx, landY + lastDy, lastScale);
            }
        }
        requestAnimationFrame(holdStep);
    }

    // The actual burst -- near-instantaneous and explosive from its very
    // first frame (most of the growth happens in the first quarter),
    // continuing from wherever the hold's drift left it (see holdAndPop)
    // rather than jumping back to the landing point first.
    function pop(fromX, fromY, fromScale) {
        const POP_PEAK_SCALE = 2.5, POP_END_SCALE = 3.2;
        const popStart = performance.now();
        function popStep(now) {
            const t = Math.min((now - popStart) / POP_MS, 1);
            let scale, opacity;
            if (t < 0.25) {
                const u = t / 0.25;
                const eased = 1 - Math.pow(1 - u, 2);
                scale = fromScale + (POP_PEAK_SCALE - fromScale) * eased;
                opacity = 1 - 0.1 * eased;
            } else {
                const u = (t - 0.25) / 0.75;
                scale = POP_PEAK_SCALE + (POP_END_SCALE - POP_PEAK_SCALE) * u;
                opacity = 0.9 * (1 - u);
            }
            el.style.left = fromX + "px";
            el.style.top = fromY + "px";
            el.style.transform = `translate(-50%, -50%) scale(${scale})`;
            el.style.opacity = opacity;
            if (t < 1) {
                requestAnimationFrame(popStep);
            } else {
                el.remove();
            }
        }
        requestAnimationFrame(popStep);
    }
}



















//----------- ONLINE PLAY ---------------
// The server (see server/) is the only referee: it rolls the dice, checks
// every move and numbers everything it relays. This side does three things:
//   - the player's own taps are applied at once (so the UI answers instantly)
//     and sent to the server (see GameController.dispatch);
//   - the opponent's taps arrive as numbered actions and are replayed here one
//     at a time, with the same animations a local tap makes -- that is what
//     lets the waiting player watch every move live;
//   - if anything ever drifts (a refused action, a missed number, a dropped
//     connection) the server's full snapshot is drawn instead.

const onlineClient = new OnlineClient({
    onConnection: (connected) => {
        // Back after a drop while looking for an opponent (e.g. the server
        // restarted for an update): the new server's queue is empty, so join
        // it again. A game that had started is picked up by rejoin instead.
        if (connected && onlineOverlay.style.display !== "none" && onlineOverlay.dataset.view === "searching" && searchingRandom) {
            onlineClient.joinQueue();
        }
        if (!gameInProgress || controller.mode !== "online" || isGameOver) return;
        showToast(connected ? t("Back online") : t("Connection lost, reconnecting..."), connected ? 1800 : 5000);
    },
    onGameStart: (snap) => beginOnlineGame(snap),
    onSnapshot: (snap) => beginOnlineGame({ ...snap, fresh: false }),
    onWaitingRoom: (code) => showWaitingRoom(code),
    onAction: onRemoteAction,
    onEmote: ({ from, id }) => {
        const box = document.getElementById(from === 1 ? "playerP1" : "playerP2");
        throwChatEmoji(id, box.getBoundingClientRect());
    },
    onOpponentStatus: ({ connected }) => {
        if (controller.mode !== "online" || isGameOver) return;
        showToast(connected ? t("Your opponent is back") : t("Your opponent disconnected, waiting for them..."), connected ? 2000 : 6000);
    },
    onGameOver: onRemoteGameOver,
    onPro: (pro) => setPro(pro),
    onRematchOffer: () => { if (controller.mode === "online" && isGameOver) showRematchState("offered"); },
    onRematchDeclined: ({ left }) => {
        if (controller.mode !== "online" || !isGameOver) return;
        showRematchState(left ? "left" : "declined");
        if (left) showToast(t("Your opponent has left."));
    },
    getPiece: () => favoritePiece(),
    onRoomExpired: () => {
        showMessage(t("Room expired"), t("Nobody joined in time. Create a new room to try again."));
    },
});

//--------- small UI helpers ---------
const onlineOverlay = document.getElementById("online-overlay");
const toastEl = document.getElementById("toast");
let toastTimer = null;

function showOnlineView(view) {
    onlineOverlay.dataset.view = view;
    onlineOverlay.style.display = "flex";
}

function hideOnlineOverlay() {
    onlineOverlay.style.display = "none";
    onlineOverlay.dataset.view = "";
}

// Closing a sheet (BACK, CANCEL, OK) with no game running goes back to the
// home: otherwise a failed join from an invite link, or a cancelled room,
// left the player on an empty board with nothing to tap.
function closeOnlineOverlay() {
    hideOnlineOverlay();
    if (!gameInProgress && !isHomeShown()) showHomeScreen();
}

function showMessage(title, text) {
    document.getElementById("message-title").textContent = title;
    document.getElementById("message-text").textContent = text;
    showOnlineView("message");
}

function showToast(text, ms = 2500) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}

function waitUntil(condition, pollMs = 80) {
    return new Promise((resolve) => {
        (function check() {
            if (condition()) resolve();
            else setTimeout(check, pollMs);
        })();
    });
}

//--------- consent (first run, and again whenever the text changes) ---------
const consentOverlay = document.getElementById("consent-overlay");
const consentCheck = document.getElementById("consent-check");
const consentContinue = document.getElementById("consent-continue");

function showConsent() {
    consentCheck.checked = false;
    consentContinue.setAttribute("aria-disabled", "true");
    consentOverlay.style.display = "flex";
}

consentCheck.addEventListener("change", () => {
    consentContinue.setAttribute("aria-disabled", String(!consentCheck.checked));
});

consentContinue.addEventListener("click", () => {
    if (!consentCheck.checked) return;
    saveConsent();
    consentOverlay.style.display = "none";
    if (onlineClient.socket) onlineClient.ensureConsentSent();
    autoJoinFromLink();
});

if (!hasConsent()) showConsent();

//--------- starting online games ---------
// Resolves true once there is a server connection that has our hello and our
// consent; otherwise shows why not and resolves false.
async function prepareOnline() {
    if (!hasConsent()) { showConsent(); return false; }
    if (!onlineClient.available()) {
        showMessage(t("Online unavailable"), t("This build isn't connected to a game server."));
        return false;
    }
    // The free hosted server sleeps when nobody has played for a while and
    // takes up to a minute to wake: say so instead of failing after a few
    // seconds. CANCEL on that screen closes it and stops the wait.
    const searchingText = document.getElementById("searching-text");
    const waiting = !onlineClient.socket?.connected;
    if (waiting) {
        searchingText.textContent = t("Connecting to the game server...");
        showOnlineView("searching");
    }
    const slow = setTimeout(() => {
        if (onlineOverlay.dataset.view === "searching") {
            searchingText.textContent = t("Waking up the game server. After a quiet spell this can take up to a minute.");
        }
    }, 4000);
    const hello = await Promise.race([
        onlineClient.connect(),
        new Promise((resolve) => setTimeout(() => resolve(null), 75000)),
    ]);
    clearTimeout(slow);
    if (waiting && onlineOverlay.style.display === "none") return false; // cancelled meanwhile
    if (!hello?.ok) {
        showMessage(t("Can't reach the server"), t("Check your connection and try again."));
        return false;
    }
    await onlineClient.ensureConsentSent();
    return true;
}

function describeOnlineError(res) {
    switch (res?.error) {
        case "consent_required": showConsent(); return null;
        case "pro_required":
            return ["Linotte Pro", t("Creating a private room is part of Linotte Pro. Your friend can always join a room for free.")];
        case "bad_code": return [t("Room not found"), t("Check the code and try again. Rooms close after 15 minutes.")];
        case "room_full": return [t("Room is full"), t("That game already has two players.")];
        case "own_room": return [t("That's your room"), t("Send the link or code to your friend instead.")];
        case "already_in_game": return null; // handled by rejoin()
        default: return [t("Something went wrong"), t("Please try again in a moment.")];
    }
}

function handleOnlineError(res) {
    if (res?.error === "already_in_game") { onlineClient.rejoin(); return; }
    if (res?.error === "pro_required") { showProSheet(); return; }
    const info = describeOnlineError(res);
    if (info) showMessage(info[0], info[1]);
    else closeOnlineOverlay();
}

// True while this player waits in the random queue (see onConnection).
let searchingRandom = false;

// Which kind of online game this is, for the stats (a game picked up again
// after a reload counts as a random one).
let onlineKind = "random";

async function startRandomOnline() {
    onlineKind = "random";
    if (!(await prepareOnline())) return;
    document.getElementById("searching-text").textContent = t("This usually takes a few seconds.");
    showOnlineView("searching");
    searchingRandom = true;
    const res = await onlineClient.joinQueue();
    if (!res.ok) { searchingRandom = false; handleOnlineError(res); }
}

async function createFriendRoom() {
    // Without Pro: what it is and how to get it, instead of a refusal from
    // the server (which checks too).
    if (ROOMS_NEED_PRO && !lastKnownPro()) { showProSheet(); return; }
    onlineKind = "friend";
    if (!(await prepareOnline())) return;
    const res = await onlineClient.createRoom();
    if (res.ok) showWaitingRoom(res.code);
    else handleOnlineError(res);
}

async function joinFriendByCode(code, { fromLink = false } = {}) {
    onlineKind = "friend";
    const errorEl = document.getElementById("code-error");
    errorEl.textContent = "";
    if (!(await prepareOnline())) return;
    document.getElementById("searching-text").textContent = t("Joining the game...");
    showOnlineView("searching");
    const res = await onlineClient.joinRoom(code);
    if (res.ok) return; // game_start follows right away
    if (res.error === "already_in_game") { onlineClient.rejoin(); return; }
    const info = describeOnlineError(res);
    // An old invite link: the game it was for is over.
    if (fromLink && res.error === "bad_code") return showMessage(t("Invite expired"), t("That game is over or the room has closed. Ask your friend for a new link, or play from the home screen."));
    if (info && res.error !== "pro_required") {
        showOnlineView("joincode");
        errorEl.textContent = info[1];
    } else {
        handleOnlineError(res);
    }
}

let currentRoomCode = null;
function showWaitingRoom(code) {
    setOnlineSession(true);
    currentRoomCode = code;
    document.getElementById("room-code").textContent = code;
    hideHomeScreen();
    showOnlineView("waiting");
}

// An invite link (https://host/j/ABCD -> /?join=ABCD) opens the app already
// joining that room, once the consent has been given.
let autoJoinDone = false;
function autoJoinFromLink() {
    const code = pendingJoinCode();
    if (!code || autoJoinDone || !hasConsent()) return;
    autoJoinDone = true;
    history.replaceState(null, "", location.pathname);
    joinFriendByCode(code, { fromLink: true }); // the home stays behind until the game starts
}

// ONLINE and FRIEND work wherever there is a game server to talk to (see
// ONLINE_AVAILABLE in config.js); elsewhere they only say "coming soon".
// A developer can force them on or off for one device by opening the page
// once with ?online=1 or ?online=0 (remembered on that device).
const DEV_ONLINE_KEY = "linotte-dev-online";
const onlineEnabled = (() => {
    try {
        const q = new URLSearchParams(location.search);
        if (q.has("online")) localStorage.setItem(DEV_ONLINE_KEY, q.get("online") === "0" ? "0" : "1");
        const forced = localStorage.getItem(DEV_ONLINE_KEY);
        if (forced === "1") return true;
        if (forced === "0") return false;
    } catch {
        // storage blocked: fall back to whether a server exists
    }
    return ONLINE_AVAILABLE;
})();
document.body.classList.toggle("online-enabled", onlineEnabled);

document.getElementById("home-online-btn").addEventListener("click", () => {
    if (onlineEnabled) startRandomOnline();
    else showToast(t("Online play is coming soon."));
});
document.getElementById("home-friend-btn").addEventListener("click", () => {
    if (onlineEnabled) showOnlineView("friend");
    else showToast(t("Playing with a friend is coming soon."));
});

//--------- home screen: the rest ---------
const byId = (id) => document.getElementById(id);
byId("home-vs-bot-btn").addEventListener("click", () => showOnlineView("bot"));
byId("home-settings").addEventListener("click", () => openOptions("home", "options"));
byId("home-help").addEventListener("click", () => openOptions("home", "help"));
//--------- sign in ---------
// Optional accounts (public/auth.js). The profile button opens the sign-in
// sheet for a guest and the account sheet once signed in.
document.body.classList.toggle("accounts-enabled", ACCOUNTS_AVAILABLE);
document.body.classList.toggle("rooms-need-pro", ROOMS_NEED_PRO);
byId("home-profile").addEventListener("click", async () => {
    if (!ACCOUNTS_AVAILABLE) return showToast(t("Sign-in is coming soon."));
    if (currentUser()) { fillAccountSheet(); return showOnlineView("account"); }
    // Only the ways switched on in Supabase (see enabledProviders).
    const on = await enabledProviders();
    byId("login-apple").hidden = !on.apple;
    byId("login-google").hidden = !on.google;
    byId("login-email").hidden = on.email === false;
    byId("login-error").textContent = "";
    showOnlineView("login");
});

// Until our own mail service is connected the email has only a link.
document.body.classList.toggle("email-link-only", !EMAIL_HAS_CODE);
if (!EMAIL_HAS_CODE) {
    byId("login-email-text").textContent = t("We'll email you a sign-in link. No password needed.");
    byId("login-email-send").querySelector(".text-button").textContent = t("SEND LINK");
}

let loginEmail = "";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Supabase's messages are written for developers; players get these.
function loginErrorText(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    if (msg.includes("rate") || msg.includes("too many") || msg.includes("security purposes")) return t("Too many tries. Wait a minute and try again.");
    if (msg.includes("expired") || msg.includes("invalid") || msg.includes("token")) return t("That code didn't work. Check it, or ask for a new one.");
    if (msg.includes("provider is not enabled") || msg.includes("unsupported provider")) return t("This way of signing in isn't ready yet.");
    // Supabase's built-in mailer only writes to the project's own team.
    if (msg.includes("not authorized")) return t("Signing in by email isn't open to everyone yet. Play as a guest for now.");
    if (msg.includes("unavailable") || msg.includes("fetch") || msg.includes("network")) return t("Can't reach the sign-in service. Check your connection.");
    return t("Something went wrong. Please try again.");
}

// Runs a sign-in step with its button dimmed until the answer comes back.
async function loginStep(btn, errEl, task) {
    if (btn.classList.contains("is-busy")) return;
    btn.classList.add("is-busy");
    errEl.textContent = "";
    try {
        await task();
    } catch (err) {
        console.error("sign-in:", err);
        errEl.textContent = loginErrorText(err);
    } finally {
        btn.classList.remove("is-busy");
    }
}

byId("login-google").addEventListener("click", (e) => loginStep(e.currentTarget, byId("login-error"), () => signInWith("google")));
byId("login-apple").addEventListener("click", (e) => loginStep(e.currentTarget, byId("login-error"), () => signInWith("apple")));
byId("login-email").addEventListener("click", () => {
    byId("login-email-error").textContent = "";
    showOnlineView("login-email");
    byId("login-email-input").focus();
});
byId("login-email-back").addEventListener("click", () => showOnlineView("login"));
byId("login-code-back").addEventListener("click", () => showOnlineView("login-email"));

function sendLoginCode() {
    const email = byId("login-email-input").value.trim();
    const errEl = byId("login-email-error");
    if (!EMAIL_RE.test(email)) { errEl.textContent = t("Enter a valid email address."); return; }
    loginStep(byId("login-email-send"), errEl, async () => {
        await sendEmailCode(email);
        loginEmail = email;
        if (EMAIL_HAS_CODE) byId("login-code-email").textContent = email;
        else byId("login-code-text").textContent = t("We sent a sign-in link to {email}. Open it on this device to sign in.", { email });
        byId("login-code-input").value = "";
        byId("login-code-error").textContent = "";
        showOnlineView("login-code");
        byId("login-code-input").focus();
    });
}

function submitLoginCode() {
    const code = byId("login-code-input").value.replace(/\D/g, "");
    const errEl = byId("login-code-error");
    if (code.length < 6) { errEl.textContent = t("Enter the code from the email."); return; }
    loginStep(byId("login-code-submit"), errEl, async () => {
        await verifyEmailCode(loginEmail, code);
        closeOnlineOverlay();
    });
}

byId("login-email-send").addEventListener("click", sendLoginCode);
byId("login-email-input").addEventListener("keydown", (e) => { if (e.key === "Enter") sendLoginCode(); });
byId("login-code-submit").addEventListener("click", submitLoginCode);
byId("login-code-input").addEventListener("keydown", (e) => { if (e.key === "Enter") submitLoginCode(); });
byId("account-signout").addEventListener("click", async () => {
    try { await signOut(); } catch (err) { console.error("sign-out:", err); }
    closeOnlineOverlay();
    showToast(t("Signed out. You're playing as a guest."));
});

byId("account-delete").addEventListener("click", () => {
    byId("account-delete-error").textContent = "";
    showOnlineView("account-delete");
});
byId("account-delete-back").addEventListener("click", () => showOnlineView("account"));

// The account says what it has: Linotte Pro, or the free version with a way
// to get Pro; and its level.
function fillAccountSheet() {
    const pro = document.body.classList.contains("is-pro");
    const plan = byId("account-plan");
    plan.textContent = pro ? `★ ${t("Linotte Pro")}` : t("Free version");
    plan.classList.toggle("is-pro", pro);
    byId("account-getpro").hidden = pro;
    byId("account-level").textContent = t("Level {n}", { n: levelOf(myXp()) });
}
byId("account-getpro").addEventListener("click", () => showProSheet());
byId("account-delete-confirm").addEventListener("click", (e) => loginStep(e.currentTarget, byId("account-delete-error"), async () => {
    await deleteAccount();
    closeOnlineOverlay();
    showToast(t("Your account has been deleted."));
}));

// The player's Google/Apple photo over the buddy. An <img> rather than a CSS
// background so it can go without a referrer: Google's photo server
// (lh3.googleusercontent.com) refuses requests that name the page they come
// from. If it still fails, the buddy stays.
function showAvatarPhoto(avatar, src) {
    let img = avatar.querySelector("img");
    if (!src) {
        img?.remove();
        avatar.classList.remove("has-photo");
        return;
    }
    if (img?.getAttribute("src") === src) return;
    img?.remove();
    img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.onload = () => avatar.classList.add("has-photo");
    img.onerror = () => { img.remove(); avatar.classList.remove("has-photo"); };
    img.src = src;
    avatar.appendChild(img);
}

//----------- PROFILE ---------------
// A signed-in player's name, picture and country (what opponents see, the
// server checks the name again), and the options that follow them to every
// device: dice, background, board and favorite piece. Stored in Supabase
// (profiles.sql).
var profile = null;       // the loaded profile, null as a guest or until loaded
var syncReady = false;    // true once this account's options have been applied
var prefsTimer = 0;

// The home screen's profile button: the chosen name and picture first, then
// the Google/Apple ones, then the email.
function showHomeProfile() {
    const user = currentUser();
    const name = user ? (profile?.name || user.name || user.email.split("@")[0] || t("Player")) : t("Guest");
    byId("home-pname").textContent = name;
    // The country's flag before "Signed in", not in the name.
    const flag = flagOf(profile?.country);
    byId("home-flag").textContent = flag;
    byId("home-flag").hidden = !flag;
    showAvatarPhoto(document.querySelector("#home-profile .home-avatar"), avatarUrl(profile?.avatar) || user?.avatar || "");
}

// The options that follow the account, as this page's option numbers.
function currentPrefs() {
    return { dice: Number(getCookie("diceFaces", 3)), background: Number(getCookie("background", 4)), board: Number(getCookie("tidyness", 2)), piece: favoritePiece() };
}

function applyPrefs(prefs) {
    const pick = (id) => { const el = document.getElementById(id); if (el && !el.classList.contains("selected")) el.click(); };
    if (Number.isInteger(prefs.dice)) pick("do" + prefs.dice);
    if (Number.isInteger(prefs.background)) pick("bg" + prefs.background);
    if (Number.isInteger(prefs.board)) pick("bo" + prefs.board);
    if (Number.isInteger(prefs.piece) && prefs.piece !== favoritePiece()) selectPiece(prefs.piece);
}

async function syncProfile(userId) {
    syncReady = false;
    try {
        const loaded = await loadProfile();
        if (currentUser()?.id !== userId) return; // signed out meanwhile
        profile = loaded || {};
        showHomeProfile();
        const saved = profile.prefs || {};
        // First sign-in on any device: this device's choices become the account's.
        if (Object.keys(saved).length) applyPrefs(saved);
        else await saveProfile({ prefs: currentPrefs() });
        syncReady = true;
        moveLocalGamesToAccount();
    } catch (err) {
        console.error("profile not loaded:", err.message);
    }
}

// Called by setCookie for every option; only the ones above are saved, a
// moment after the last change.
function prefChanged(cookie) {
    if (!syncReady || !(cookie in { diceFaces: 1, background: 1, tidyness: 1, piece: 1 })) return;
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(() => {
        const prefs = currentPrefs();
        saveProfile({ prefs }).then(() => { if (profile) profile.prefs = prefs; }).catch((err) => console.error("options not saved:", err.message));
    }, 1200);
}

// Edit profile (from the account sheet).
let chosenAvatar = "";

function buildProfileSheet() {
    const grid = byId("profile-avatars");
    if (!grid.childElementCount) {
        for (const id of avatarIds) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "profile-avatar";
            b.dataset.id = id;
            b.setAttribute("role", "radio");
            b.setAttribute("aria-label", "Picture " + Number(id.slice(1)));
            b.style.backgroundImage = `url("${avatarUrl(id)}")`;
            b.addEventListener("click", () => selectAvatar(chosenAvatar === id ? "" : id));
            grid.appendChild(b);
        }
        const select = byId("profile-country");
        let names = null;
        try { names = new Intl.DisplayNames([navigator.language, "en"], { type: "region" }); } catch { /* old browser: codes only */ }
        const options = COUNTRIES.map((c) => [c, `${flagOf(c)} ${names?.of(c) || c}`])
            .sort((a, b) => a[1].slice(5).localeCompare(b[1].slice(5)));
        select.add(new Option("No flag", ""));
        for (const [code, label] of options) select.add(new Option(label, code));
    }
}

function selectAvatar(id) {
    chosenAvatar = id;
    byId("profile-avatars").querySelectorAll(".profile-avatar")
        .forEach((b) => b.setAttribute("aria-checked", String(b.dataset.id === id)));
}

function nameHint() {
    const raw = byId("profile-name").value;
    byId("profile-name-hint").textContent = raw.trim()
        ? t(nameProblem(raw) || "This is the name your opponents see.")
        : !profile?.name && onlineClient.name
            ? t("Leave it empty to play as a random animal name (now {name}).", { name: onlineClient.name })
            : t("Leave it empty to play as a random animal name.");
}

byId("account-edit").addEventListener("click", () => {
    buildProfileSheet();
    byId("profile-name").value = profile?.name || "";
    byId("profile-country").value = profile?.country || "";
    selectAvatar(profile?.avatar || "");
    byId("profile-error").textContent = "";
    showOnlineView("profile");
    byId("profile-avatars").querySelector('[aria-checked="true"]')?.scrollIntoView({ block: "nearest" });
    nameHint();
});
byId("profile-name").addEventListener("input", nameHint);
byId("profile-cancel").addEventListener("click", () => showOnlineView("account"));

byId("profile-save").addEventListener("click", (e) => {
    const raw = byId("profile-name").value;
    if (raw.trim() && nameProblem(raw)) { nameHint(); return; }
    const fields = { name: cleanPlayerName(raw) || null, avatar: chosenAvatar || null, country: byId("profile-country").value || null };
    loginStep(e.currentTarget, byId("profile-error"), async () => {
        await saveProfile(fields);
        profile = { ...(profile || {}), ...fields };
        showHomeProfile();
        onlineClient.reauth(); // the game server picks up the new name and flag
        showOnlineView("account");
        showToast(t("Profile saved."));
    });
});

// The profile button follows the account; the game server is told too.
let lastUserId;
onUserChange((user) => {
    const avatar = document.querySelector("#home-profile .home-avatar");
    byId("home-psub").textContent = user ? t("Signed in") : t("Tap to sign in");
    profile = null;
    showHomeProfile();
    if (user) syncProfile(user.id);
    else syncReady = false;
    if (user) byId("account-email").textContent = user.email || user.name;
    // Signed in from the email link in another tab: this one stops waiting.
    if (user && /^login/.test(onlineOverlay.dataset.view || "")) closeOnlineOverlay();
    // Only a sign-in/out on this page: not the session found at start-up.
    const id = user?.id ?? null;
    if (lastUserId !== undefined && id !== lastUserId) {
        onlineClient.reauth();
        refreshPro();
        if (id) showToast(t("Signed in."));
    }
    if (lastUserId !== undefined) lastUserId = id;
});
// Start-up: a saved session (or one just back from Google/Apple) may arrive
// after the game server already got a guest hello.
initAuth().then(() => {
    lastUserId = currentUser()?.id ?? null;
    if (lastUserId) onlineClient.reauth();
    refreshPro();
});

byId("home-ad").addEventListener("click", () => showProSheet());
//----------- PRO ---------------
// Linotte Pro: one purchase, for life, tied to the account. It's bought in
// the store apps: their native layer (Capacitor + RevenueCat, logged in with
// the Supabase account id) puts window.LinotteNative.buyPro() and
// .restorePurchases() here, each resolving once the store is done. The game
// server is what decides who is Pro (/api/me, and the online games).
const store = () => window.LinotteNative?.buyPro ? window.LinotteNative : null;

function setPro(pro) {
    document.body.classList.toggle("is-pro", pro);
    showHomeBadge();
    showPieceChoice(favoritePiece()); // the favorite piece is Pro only
    if (onlineOverlay.dataset.view === "pro") fillProSheet();
}

// Also brings the level up to date, and celebrates when it went up.
async function refreshPro(options) {
    const before = lastKnownXp();
    setPro(await fetchPro(options));
    const after = lastKnownXp();
    if (before !== null && after !== null && levelOf(after) > levelOf(before)) {
        showToast(t("Level {n}!", { n: levelOf(after) }));
    }
}

function fillProSheet() {
    const pro = document.body.classList.contains("is-pro");
    const signedIn = Boolean(currentUser());
    const inApp = Boolean(store());
    byId("pro-price").textContent = t("One purchase, for life: {price}", { price: window.LinotteNative?.proPrice || PRO_PRICE });
    byId("pro-price").hidden = pro;
    byId("pro-thanks").hidden = !pro;
    byId("pro-buy").hidden = pro;
    byId("pro-restore").hidden = pro || !inApp;
    byId("pro-close-text").textContent = pro ? "OK" : t("NOT NOW");
    byId("pro-buy-text").textContent = inApp ? t("GET PRO") : t("GET IT IN THE APP");
    byId("pro-note").textContent = pro ? ""
        : !inApp ? t("Linotte Pro is sold in the Linotte app for iPhone and Android, coming soon. Bought it there? Sign in here with the same account.")
        : !signedIn ? t("Sign in first: Pro stays with your account, on every device.")
        : "";
}

function showProSheet() {
    fillProSheet();
    showOnlineView("pro");
}

byId("home-pro").addEventListener("click", showProSheet);

byId("pro-buy").addEventListener("click", (e) => {
    if (!store()) return showToast(t("Linotte Pro is coming with the app."));
    // Pro belongs to an account, so the store needs one to give it to.
    if (!currentUser()) return byId("home-profile").click();
    loginStep(e.currentTarget, byId("pro-note"), async () => {
        if (await store().buyPro()) {
            await refreshPro({ fresh: true });
            if (document.body.classList.contains("is-pro")) showToast(t("Welcome to Linotte Pro!"));
        }
    });
});

byId("pro-restore").addEventListener("click", (e) => {
    if (!store()) return;
    if (!currentUser()) return byId("home-profile").click();
    loginStep(e.currentTarget, byId("pro-note"), async () => {
        await store().restorePurchases();
        await refreshPro({ fresh: true });
        showToast(document.body.classList.contains("is-pro") ? t("Linotte Pro restored.") : t("No purchase found for this account."));
    });
});

// The badge by the name on the home screen: the level (see shared/level.js),
// the account's or, as a guest, the phone's. Gold with a star for Pro
// players, who show it to their opponents too; plain, and seen only by the
// player, without Pro.
function showHomeBadge() {
    const badge = byId("home-badge");
    const level = levelOf(myXp());
    badge.hidden = false;
    const pro = document.body.classList.contains("is-pro");
    badge.classList.toggle("is-pro", pro);
    badge.textContent = pro ? `★ ${level}` : String(level);
    badge.title = t("Level {n}", { n: level });
}

// The last answer at once (no flicker on start-up); the server confirms
// once sign-in has started (see initAuth below).
setPro(lastKnownPro());

byId("home-shop").addEventListener("click", () => showToast(t("The shop is coming soon.")));
//----------- STATS SCREEN ---------------
async function showStats() {
    let st;
    try {
        st = await loadStats();
    } catch (err) {
        console.error("stats not loaded:", err.message);
        return showMessage(t("Stats"), t("Can't load your stats right now. Please try again."));
    }
    const set = (id, v) => { byId(id).textContent = v; };
    set("stats-note", st.signedIn ? t("Saved with your account.") : t("Saved on this device. Sign in to keep them on every device."));
    byId("stats-signin").hidden = st.signedIn || !ACCOUNTS_AVAILABLE;
    byId("stats-empty").hidden = st.all.played > 0;
    byId("stats-body").hidden = st.all.played === 0;
    set("st-played", st.all.played);
    set("st-won", st.all.won);
    set("st-rate", st.all.rate + "%");
    set("st-streak", st.streak);
    set("st-best-streak", st.bestStreak);
    set("st-best", st.all.best);

    // The level and the way to the next one: the account's (from the
    // server, see refreshPro) or the guest's.
    const xp = myXp();
    const level = levelOf(xp);
    const from = levelStart(level), to = levelStart(level + 1);
    set("st-level", t("Level {n}", { n: level }));
    byId("st-level-guest").hidden = st.signedIn;
    set("st-level-points", `${xp - from} / ${to - from}`);
    byId("st-level-fill").style.width = `${((xp - from) / (to - from)) * 100}%`;

    const modes = byId("stats-modes");
    modes.replaceChildren();
    for (const [key, label] of [["random", t("Online")], ["friend", t("Friends")], ["bot", t("Vs bot")]]) {
        const m = st[key];
        const tr = modes.insertRow();
        for (const v of [label, m.played, m.played ? `${m.won} (${m.rate}%)` : "–", m.played ? m.average : "–"]) tr.insertCell().textContent = v;
    }

    const recent = byId("stats-recent");
    recent.replaceChildren();
    const day = new Intl.DateTimeFormat(LANG, { day: "numeric", month: "short" });
    for (const g of st.recent) {
        const li = document.createElement("li");
        const cells = [
            ["res " + (g.won ? "won" : "lost"), g.won ? t("Won") : t("Lost")],
            ["who", t("{score} vs {name}", { score: `${g.points}–${g.opponent_points}`, name: g.opponent || "?" })],
            ["when", day.format(new Date(g.played_at))],
        ];
        for (const [cls, text] of cells) {
            const span = document.createElement("span");
            span.className = cls;
            span.textContent = text;
            li.appendChild(span);
        }
        recent.appendChild(li);
    }
    showOnlineView("stats");
}

byId("home-stats").addEventListener("click", showStats);
// A guest's stats only live on this phone: one tap to keep them.
byId("stats-signin").addEventListener("click", () => byId("home-profile").click());
document.querySelectorAll("[data-sheet-close]").forEach((el) => el.addEventListener("click", closeOnlineOverlay));
// Sign-in and purchases come with the native apps; their buttons say so.
document.querySelectorAll("[data-soon]").forEach((el) => el.addEventListener("click", () => showToast(el.dataset.soon)));

// ✕ on "Continue your game": after asking, the paused game (in memory or
// saved by an earlier launch) is dropped. It doesn't count in the stats.
byId("home-continue-end").addEventListener("click", () => showOnlineView("endgame"));
byId("endgame-confirm").addEventListener("click", () => {
    clearSavedGame();
    if (gameInProgress && controller.mode !== "online") {
        gameInProgress = false;
        turnHandoverPending = false;
        stopTimer();
    }
    closeOnlineOverlay();
    refreshContinueCard();
});

byId("home-continue-btn").addEventListener("click", () => {
    hideHomeScreen();
    setPaused(false);
    // A game from an earlier launch: rebuilt from what was saved.
    if (!gameInProgress && resumeSavedGame()) return;
    applyFlip(); // back to whoever's turn it is, as the game was left
});

// HOME in the Game tab. An online game ends when you leave it, so that one
// asks first.
byId("game-home-btn").addEventListener("click", () => {
    if (controller.mode === "online" && gameInProgress && !isGameOver) {
        showOnlineView("leave");
        return;
    }
    showHomeScreen();
});

function leaveToHome() {
    leaveOnlineGameIfAny();
    if (controller.mode === "online") gameInProgress = false;
    closeOnlineOverlay();
    showHomeScreen();
}

byId("leave-confirm").addEventListener("click", leaveToHome);

// RESTART in the Game tab asks first; the new game is in the same mode
// (off-line only).
byId("restart-btn").addEventListener("click", () => showOnlineView("restart"));

byId("restart-confirm").addEventListener("click", () => {
    closeOnlineOverlay();
    if (controller.mode === "offline") {
        flipCoin("P1", "P2").then((startingPlayer) => {
            newGameOffline(startingPlayer);
            handleTab("back");
        });
    } else if (controller.mode === "bot") {
        const strategy = botStrategy;
        flipCoin(t("YOU"), "BOT").then((startingPlayer) => {
            newGameVsBot(strategy, startingPlayer);
            handleTab("back");
        });
    }
});

document.getElementById("searching-cancel").addEventListener("click", () => {
    searchingRandom = false;
    onlineClient.leaveQueue();
    onlineClient.leaveRoom();
    closeOnlineOverlay();
});
document.getElementById("friend-back").addEventListener("click", closeOnlineOverlay);
document.getElementById("friend-create").addEventListener("click", createFriendRoom);
document.getElementById("friend-join").addEventListener("click", () => {
    document.getElementById("code-error").textContent = "";
    showOnlineView("joincode");
    document.getElementById("code-input").focus();
});
document.getElementById("code-back").addEventListener("click", () => showOnlineView("friend"));
document.getElementById("code-submit").addEventListener("click", () => {
    const code = document.getElementById("code-input").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 4) {
        document.getElementById("code-error").textContent = t("The code has 4 characters.");
        return;
    }
    joinFriendByCode(code);
});
document.getElementById("code-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("code-submit").click();
});
document.getElementById("message-ok").addEventListener("click", closeOnlineOverlay);

document.getElementById("room-share").addEventListener("click", async () => {
    if (!currentRoomCode) return;
    const url = inviteLink(currentRoomCode);
    if (navigator.share) {
        try { await navigator.share({ title: "Linotte", text: t("Play Linotte with me! Code: {code}", { code: currentRoomCode }), url }); return; }
        catch { /* dismissed the share sheet -- nothing to do */ }
    }
    copyInviteLink();
});
document.getElementById("room-copy").addEventListener("click", copyInviteLink);
document.getElementById("room-cancel").addEventListener("click", () => {
    setOnlineSession(false);
    onlineClient.leaveRoom();
    currentRoomCode = null;
    closeOnlineOverlay();
});

async function copyInviteLink() {
    if (!currentRoomCode) return;
    const url = inviteLink(currentRoomCode);
    try {
        await navigator.clipboard.writeText(url);
        showToast(t("Link copied"));
    } catch {
        window.prompt("Copy this link", url);
    }
}

//--------- the game itself ---------
let onlineReady = false; // false until the game's screen is up (and the coin has landed)
let expectedSeq = 1;
let remoteGen = 0; // bumped on every (re)start so an old replay stops touching the screen
let remoteBusy = false;
const remoteQueue = [];

// Runs `fn` (which dispatches through the controller) with the "this came
// from the opponent" flag set just for its synchronous part -- never across an
// await, or the local player's next real tap would be swallowed.
function withReplay(fn) {
    controller.replaying = true;
    try { fn(); } finally { controller.replaying = false; }
}

async function beginOnlineGame(snap) {
    searchingRandom = false; // matched: no more queueing on reconnect
    setOnlineSession(true);
    remoteGen++;
    remoteQueue.length = 0;
    onlineReady = false;
    hideOnlineOverlay();
    hideHomeScreen();
    optionsOverlay.classList.add("hidden");
    document.getElementById("coin-flip-overlay").classList.add("hidden");

    gameInProgress = true;
    turnHandoverPending = false;
    setPaused(false);
    isGameOver = false;
    endGameSequenceStarted = false;
    clearInterval(rollAnimationID);
    clearInterval(stopRollID);
    rollBtnEnabled = true;
    doneBtnEnabled = true;
    pieceEnabled = true;
    possibleMovesLocal = Array.from({ length: 5 }, () => Array(5).fill(0));

    gameState = snap.state;
    LOCAL_PLAYER = snap.seat;
    gameState.players[snap.seat].name = t("YOU");
    startOnline();
    expectedSeq = snap.seq + 1;
    renderOnlineBoard();

    if (snap.fresh) {
        const label = (seat) => gameState.players[seat].name;
        await flipCoin(label(1), label(2), snap.starter);
        startTurnTimer();
    } else {
        resumeTurnTimer(Math.ceil(snap.timeLeftMs / 1000));
    }
    onlineReady = true;
    pumpRemote();
}

// Draws the whole screen from gameState: used for a new game and whenever
// the server's snapshot replaces what this screen thought was true.
function renderOnlineBoard() {
    forcedWinner = null;
    document.getElementById("winner-overlay").style.display = "none";
    document.getElementById("div-dice").classList.remove("game-over-dim");
    document.getElementById("div-resultsAndCalls").classList.remove("game-over-dim");
    rollBtn.classList.remove("game-over-dim");
    document.body.classList.remove("table-flipped");

    clearBoardVisuals();
    document.querySelectorAll(".wrapPiece").forEach((w) => {
        w.style.opacity = "";
        w.classList.remove("piece-jump", "piece-tap", "img-disappear");
    });
    prewPiece = null;
    selectedTileId = null;

    const showPiece = (r, c, player) => {
        const piece = document.getElementById(`p${r}${c}`);
        piece.style.backgroundImage = urlOf(gameState.players[player].pieceImage);
        applyTidyness(piece);
        piece.parentElement.style.opacity = "1";
        return piece;
    };
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (gameState.table[r][c]) showPiece(r, c, gameState.table[r][c]);
        }
    }
    if (gameState.currentPosition) { // a piece placed but not yet committed with DONE
        const [r, c] = [Number(gameState.currentPosition[0]), Number(gameState.currentPosition[1])];
        prewPiece = showPiece(r, c, gameState.currentPlayer);
        selectedTileId = prewPiece.id;
    }

    const rolled = gameState.dice.rollsLeft < 3;
    ddElements.forEach((dd, i) => {
        dd.style.backgroundPosition = dicePos[rolled ? gameState.dice.values[i] : 0];
        dd.classList.toggle("selected", Boolean(gameState.dice.locked[i]));
    });
    wdElements.forEach((wd) => { wd.style.transform = "rotate(0deg) translate(0px,0px)"; });
    ccElements.forEach((cc, i) => cc.classList.toggle("checked", i >= 3 && Boolean(gameState.called[i])));
    setRollsLeftUI(gameState.dice.rollsLeft);

    possibleMovesLocal = gameState.possibleMoves;
    renderResultsHighlight();
    renderTableHighlight();

    applyPlayerVisuals();
    renderPlayerBox(gameState.currentPlayer);
    renderPieceCounts();
    renderPointCounts();
    divsOpacity(gameState.currentPlayer);
}

function leaveOnlineGameIfAny() {
    if (controller.mode !== "online") return;
    // Leaving before the end abandons the game: it costs level points (the
    // server counts an account's; a guest's are kept here).
    if (gameInProgress && !isGameOver) {
        noteGuestAbandon();
        if (currentUser()) setTimeout(() => refreshPro({ fresh: true }), 1500);
    }
    setOnlineSession(false);
    onlineClient.leaveRoom();
    remoteGen++;
    remoteQueue.length = 0;
    onlineReady = false;
}

//--------- replaying the opponent ---------
function onRemoteAction({ seq, seat, action }) {
    if (controller.mode !== "online") return;
    if (seq < expectedSeq) return; // already part of the snapshot this screen was drawn from
    if (seq > expectedSeq) { onlineClient.rejoin(); return; } // missed one: redraw from the server's truth
    expectedSeq = seq + 1;

    if (seat === LOCAL_PLAYER) {
        // Our own moves were applied when we tapped. Two exceptions: the dice
        // (the server rolls them) and a turn the server ended for us because
        // our clock ran out while this screen was somewhere else.
        if (action.type === "ROLL_DICE") {
            controller.localAction(action);
            controller.rollArrived = true;
            return;
        }
        if (!(action.type === "END_TURN" && action.forced && gameState.currentPlayer === LOCAL_PLAYER)) return;
    }
    remoteQueue.push(action);
    pumpRemote();
}

async function pumpRemote() {
    if (remoteBusy || !onlineReady) return;
    remoteBusy = true;
    const gen = remoteGen;
    try {
        while (remoteQueue.length && gen === remoteGen) {
            // The previous turn's celebration still has to finish before the
            // next player's moves start showing.
            await waitUntil(() => !turnHandoverPending || gen !== remoteGen);
            if (gen !== remoteGen) break;
            await replayRemote(remoteQueue.shift(), gen);
        }
    } finally {
        remoteBusy = false;
        if (remoteQueue.length && onlineReady) pumpRemote();
    }
}

async function replayRemote(action, gen) {
    switch (action.type) {
        case "ROLL_DICE":
            if (isVolumeOn) new Audio("resources/sounds/roll.mp3").play();
            withReplay(() => controller.dispatch(action));
            setRollsLeftUI(gameState.dice.rollsLeft);
            tileElements.forEach((el) => el.classList.remove("tile_highlighted"));
            rrElements.forEach((el) => el.classList.remove("highlighted"));
            for (let i = 0; i < 12 && gen === remoteGen; i++) {
                renderDice([0, 0, 0, 0, 0].map(() => rndNum(1, 6)));
                await sleep(100);
            }
            renderDice(gameState.dice.values);
            break;
        case "STOP_ROLL":
            withReplay(() => controller.dispatch(action));
            renderDice(gameState.dice.values);
            possibleMovesLocal = gameState.possibleMoves;
            renderResultsHighlight();
            renderTableHighlight();
            break;
        case "LOCK_DICE":
            withReplay(() => controller.dispatch(action));
            ddElements.forEach((dd, i) => dd.classList.toggle("selected", Boolean(action.locked[i])));
            break;
        case "SELEC_CALL":
            withReplay(() => controller.dispatch(action));
            ccElements.forEach((cc, i) => cc.classList.toggle("checked", i >= 3 && Boolean(action.called[i])));
            break;
        case "PLACE_PIECE":
            if (action.player === 0) withReplay(() => removePiece("p" + action.coordinates));
            else withReplay(() => placePiece("p" + action.coordinates));
            break;
        case "END_TURN":
            withReplay(() => performEndTurn());
            await waitUntil(() => !turnHandoverPending || isGameOver || gen !== remoteGen);
            break;
    }
}

//--------- the game ending early ---------
function onRemoteGameOver({ winner, reason }) {
    setOnlineSession(false); // over: a relaunch has nothing to rejoin
    if (controller.mode !== "online" || isGameOver) return;
    if (reason === "normal") return; // both screens play their own ending
    lastOverReason = reason; // the opponent left or dropped: no rematch
    remoteGen++;
    remoteQueue.length = 0;
    clearInterval(rollAnimationID);
    clearInterval(stopRollID);
    stopTimer();
    turnHandoverPending = false;
    forcedWinner = winner;
    isGameOver = true;
    rollBtnEnabled = false;
    doneBtnEnabled = false;

    // Same end-of-game controls checkGameOver() leaves.
    document.getElementById("div-dice").classList.add("game-over-dim");
    document.getElementById("div-resultsAndCalls").classList.add("game-over-dim");
    rollBtn.classList.add("game-over-dim");
    rollBtn.style.display = "none";
    doneBtn.style.display = "none";
    turnLabelEl.style.display = "none";
    endGameDoneBtn.style.display = "flex";

    showWinnerPopup(winner);
    if (winner === LOCAL_PLAYER) {
        setWinnerText(reason === "disconnect" ? t("Your opponent disconnected. You win!") : t("Your opponent left. You win!"));
    }
}

document.addEventListener("DOMContentLoaded", autoJoinFromLink);
if (document.readyState !== "loading") autoJoinFromLink();

// Relaunched in the middle of an online game (or while a friend room was
// waiting): reconnect now -- the client asks the server for its room as soon
// as it's connected -- instead of waiting for a tap on ONLINE.
if (hasConsent() && wasInOnlineSession() && onlineClient.available()) onlineClient.connect();

// A game saved by an earlier launch shows on the home at once.
refreshContinueCard();

// Back from a language change: the options page again, scrolled where it
// was, before anything is shown (the page is still hidden, see index.html).
(function reopenAfterReload() {
    let reopen = null;
    try {
        reopen = JSON.parse(sessionStorage.getItem("linotte-reopen") || "null");
        sessionStorage.removeItem("linotte-reopen");
    } catch { /* nothing to reopen */ }
    if (reopen?.page === "options") {
        openOptions("home", "options");
        document.getElementById("page-options").scrollTop = reopen.scroll || 0;
    }
    document.documentElement.classList.remove("i18n-pending");
})();


//----------- COMBINATION DEMOS (help page) ---------------
// The ▶ next to each combination plays a short scripted turn in a copy of
// this screen (see demo.js), with this player's own piece and colour.
initCombinationDemos({
    getVisuals: () => {
        const me = gameState.players[LOCAL_PLAYER || 1];
        return { pieceImage: me.pieceImage, color: me.color };
    },
});
