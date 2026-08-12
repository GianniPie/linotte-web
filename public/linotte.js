//Version 
const VERSION = "2.6.0";
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

function setRealVh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setRealVh();
window.addEventListener('resize', setRealVh);
window.addEventListener('orientationchange', setRealVh);




//----------- SERVER SIDE ---------------
// socket.on("init", data => {
//     LOCAL_PLAYER = data.playerNumber;
//     gameState = data.gameState;
//     console.log("You are player " + LOCAL_PLAYER);

//     if (LOCAL_PLAYER == 1) {
//         textPlayerP1.textContent = "YOU";
//     } else if (LOCAL_PLAYER == 2) {
//         textPlayerP2.textContent = "YOU";
//     }
// });


// socket.on("state_update", state => {
//     gameState = state;
//     clearForNextTurn();
//     divsOpacity(state.currentPlayer);
//     renderPlayerBox(state.currentPlayer);
// });




//----------- GAME STATE ---------------
import { createInitialGameState, urlOf, rndNum, idToCoo, matrixCheck, matrixFill, toBoolean, preload, idToIndex } from "../shared/utils.js";
import { dicePath, diceFaces, dicePos, diceNames, bgPath, backgrounds, piecesPath, pieces } from "../shared/assets.js";
import { updateGame } from "../shared/gameEngine.js";
import { chooseDiceToLock, shouldStopRolling, chooseBestMove } from "../shared/botAI.js";
import GameController from '../shared/gameController.js';
let gameState = createInitialGameState();




//----------- GAME CONTROLLER ---------------
let controller;
startOffline();

let botStrategy = "points";

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
assignRandomPieces(gameState);

const selectedColor = [null, gameState.players[1].color, gameState.players[2].color];
applyPlayerVisuals();
renderPlayerBox(gameState.currentPlayer);

function assignRandomPieces(state) {
    const p1p = rndNum(8, pieces.length - 1);
    state.players[1].pieceImage = piecesPath + pieces[p1p];
    let p2p = p1p;
    while (p2p === p1p) {
        p2p = rndNum(8, pieces.length - 1);
    }
    state.players[2].pieceImage = piecesPath + pieces[p2p];

    state.players[1].color = "#" + state.players[1].pieceImage.split("_")[1].slice(0, 6);
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
    pawnP1Text.textContent = gameState.players[1].remainingPieces;
    pawnP2Text.textContent = gameState.players[2].remainingPieces;
    coinP1Text.textContent = gameState.players[1].points;
    coinP2Text.textContent = gameState.players[2].points;
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


//----------- AI OPPONENT ---------------
const botStrategyButtons = document.querySelectorAll(".bot-strategy");
botStrategyButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        botStrategyButtons.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");

        newGameVsBot(btn.dataset.strategy);
        handleTab("back");
    });
});

function newGameVsBot(strategy) {
    gameState = createInitialGameState();
    gameState.players[1].name = "YOU";
    gameState.players[2].name = "BOT";
    assignRandomPieces(gameState);

    startBot(strategy);

    clearBoardVisuals();
    clearForNextTurn();
    applyPlayerVisuals();
    renderPlayerBox(gameState.currentPlayer);
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

    if (gameState.players[1].points > gameState.players[2].points) {
        showWinnerPopup(1);
    } else if (gameState.players[1].points < gameState.players[2].points) {
        showWinnerPopup(2);
    } else {
        showWinnerPopup(0);
    }
    return true;
}


function showWinnerPopup(winner) {
    if (winner) { // both player 1 or 2
        document.getElementsByClassName("piece-popup-container")[0].classList.add("pulse");
        document.getElementsByClassName("piece-popup-container")[0].style.setProperty("--glow", gameState.players[winner].color);
        document.getElementById("piece-popup").style.backgroundImage = urlOf(gameState.players[winner].pieceImage);
        document.getElementById("winner-text").textContent = "Player " + winner + " won!";
        document.getElementById("winner-overlay").style.display = "flex";
        fireWinnerConfetti(3000);
    } else {
        document.getElementsByClassName("piece-popup-container")[0].classList.remove("pulse");
        document.getElementsByClassName("piece-popup-container")[0].style.setProperty("--glow", "rgba(0, 0, 0, .2)");
        document.getElementById("piece-popup").style.backgroundImage = urlOf("resources/images/tie.svg");
        document.getElementById("winner-text").textContent = "It's a tie!";
        document.getElementById("winner-overlay").style.display = "flex";
        fireWinnerConfetti(500);
    }
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
        piece.style.backgroundImage = "";
        pieceEnabled = true;
        selectedTileId = null;
    }, { once: true });

    const coor = idToCoo(pieceId);
    controller.dispatch({ type: "PLACE_PIECE", coordinates: coor, player: 0 });
    console.log(`Coordinates ${coor}`);
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
    }, { once: true });

    const coor = idToCoo(pieceId);
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
    if (!isMyTurn()) return;
    if (doneBtnEnabled == false) return;
    performEndTurn();
}

function performEndTurn() {
    console.log("doneButton");

    possibleMovesLocal = Array.from({ length: 5 }, () => Array(5).fill(0));
    controller.dispatch({ type: "END_TURN" });
    clearForNextTurn()
    renderPlayerBox(gameState.currentPlayer);
    divsOpacity(gameState.currentPlayer);

    if (checkGameOver()) {
        stopTimer();
        return;
    }

    if (controller.mode === "bot" && gameState.currentPlayer === 2) {
        stopTimer(); // pause the clock during the bot's own turn
        playBotTurn();
    } else {
        startTurnTimer(); // fresh 60s for whoever's turn it is now
    }
    //stateUpdate();


    //send to the server where the player placed the piece
    // socket.emit("action", {
    //     type: "DONE",
    //     localPlayer: LOCAL_PLAYER,
    //     tileCoordinate: selectedTile === null ? null : selectedTile.id
    // });
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

async function playBotTurn() {
    if (controller.mode !== "bot") return;
    if (gameState.currentPlayer !== 2) return;

    setBotControlsDisabled(true);
    try {
        await sleep(800); // small pause so the bot's move doesn't feel instant

        let keepRolling = true;
        while (keepRolling) {
            await botRoll();

            if (gameState.dice.rollsLeft <= 0) break;
            if (shouldStopRolling(gameState, 2, botStrategy)) break;

            // Give the player a moment to read the dice before the bot starts
            // choosing which ones to keep.
            await sleep(700);
            const locked = chooseDiceToLock(gameState.dice.values, gameState, 2, botStrategy);
            await applyBotLock(locked);
            await sleep(800);
        }

        await sleep(600);
        const coordinates = chooseBestMove(gameState, 2, botStrategy);
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

















