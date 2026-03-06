//Version jjjj
const VERSION = "2.5";
document.getElementById("version").innerHTML += VERSION;

const socket = io();

const dd1 = document.getElementById("dd1");
const dd2 = document.getElementById("dd2");
const dd3 = document.getElementById("dd3");
const dd4 = document.getElementById("dd4");
const dd5 = document.getElementById("dd5");
const ddElements = [dd1, dd2, dd3, dd4, dd5];

const wr1 = document.getElementById("wr1");
const wr2 = document.getElementById("wr2");
const wr3 = document.getElementById("wr3");
const wr4 = document.getElementById("wr4");
const wr5 = document.getElementById("wr5");
const wwElements = [wr1, wr2, wr3, wr4, wr5];

const rr0 = document.getElementById("rr0");
const rr1 = document.getElementById("rr1");
const rr2 = document.getElementById("rr2");
const rr3 = document.getElementById("rr3");
const rr4 = document.getElementById("rr4");
const rr5 = document.getElementById("rr5");
const rr6 = document.getElementById("rr6");
const rr7 = document.getElementById("rr7");
const rrElements = [rr1, rr2, rr3, rr4, rr5, rr6, rr7, rr8];

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

const body = document.getElementById("body");
const modal = document.getElementById("modal");
const optionsOverlay = document.getElementById("options-overlay");


let rollAnimationID;
let stopRollID;

function setRealVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setRealVh();
window.addEventListener('resize', setRealVh); 
window.addEventListener('orientationchange', setRealVh);



//----------- GAME STATE ---------------
let gameState = {
  table: Array.from({ length: 5 }, () => Array(5).fill(0)),
  possibleMoves: Array.from({ length: 5 }, () => Array(5).fill(0)),
  currentPlayer: 0,
  combinationsRealized: [0,0,0,0,0,0,0,0],
  isFive: false,
  called: [null,null,null,false,false,false,false,false],
  players: {
    1: {
        name: "",
        pieceImage: "",
        color: "",
        points: 0,
        remainingPieces: 12,
        local: true
    },
    2: {
        name: "",
        pieceImage: "",
        color: "",
        points: 0,
        remainingPieces: 12,
        local: true
    },
  },
  dice: {
    values: [0,0,0,0,0],
    locked: [false,false,false,false,false],
    rollsLeft: 3
  },
};


//------ PLAYERS ---------------

let p1p = rndNum(8, pieces.length - 1);
gameState.players[1].pieceImage = piecesPath + pieces[p1p];
let p2p = p1p;
while(p2p == p1p) {
    p2p = rndNum(8, pieces.length - 1);
}
gameState.players[2].pieceImage = piecesPath + pieces[p2p];

preload(gameState.players[1].pieceImage);
preload(gameState.players[2].pieceImage);

gameState.players[1].color = "#" + gameState.players[1].pieceImage.split("_")[1].slice(0, 6);
gameState.players[2].color = "#" + gameState.players[2].pieceImage.split("_")[1].slice(0, 6);
document.getElementsByClassName("player p1")[0].style.backgroundColor = gameState.players[1].color;
document.getElementsByClassName("player p2")[0].style.backgroundColor = gameState.players[2].color;
renderPlayerBox(gameState.currentPlayer);

let LOCAL_PLAYER = null;
function isMyTurn() {return gameState.currentPlayer == LOCAL_PLAYER;}

const boxPlayer1 = document.querySelector(".player.p1");
const boxPlayer2 = document.querySelector(".player.p2");
const textPlayerP1 = document.getElementById("textPlayerP1");
const textPlayerP2 = document.getElementById("textPlayerP2");
const pawnP1Text = document.getElementById("pawnP1Text").textContent = gameState.players[1].remainingPieces;
const coinP1Text = document.getElementById("coinP1Text").textContent = gameState.players[1].points;
const pawnP2Text = document.getElementById("pawnP2Text").textContent = gameState.players[2].remainingPieces;
const coinP2Text = document.getElementById("coinP2Text").textContent = gameState.players[2].points;

function renderPlayerBox(currentPlayer) {
    if(currentPlayer === 1){
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
}




//----------- COOKIES ---------------

let tidyness = getCookie("tidyness", 2);
document.getElementById("bo" + tidyness).classList.add("selected"); //option section
renderTidyness(tidyness);

let dieCookie = getCookie("diceFaces", 3);
document.getElementById("do" + dieCookie).classList.add("selected"); //option section
document.getElementById("dice-title").textContent =  diceNames[dieCookie];
let faces = diceFaces[dieCookie];  //faces of the selected die

let selectedDie = dicePath + faces;
preload(selectedDie);

let selectedBg = getCookie("background", 4);
document.getElementById("bg" + selectedBg).classList.add("selected"); //option section
document.getElementById("bg-title").textContent =  backgrounds[selectedBg].slice(0, -4); 
for(let i = 0; i < backgrounds.length; i++) {
    preload(bgPath + backgrounds[i]);
}

body.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);
document.getElementById("opt-bg").style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);
document.getElementById("modal").style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);

let isVolumeOn = true;
isVolumeOn = toBoolean(getCookie("volumeOn", "true"));
if(isVolumeOn == true) {
    document.getElementById("sound-on").classList.add("selected"); 
} else {
    document.getElementById("sound-off").classList.add("selected");
}



//----------- TIMER -----------------
const MAX_TIMER = 60;
let value = MAX_TIMER;
let timerId = null;

function flip(tile, newVal){
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

    setTimeout(()=>{
        topFlip.remove();
        bottomFlip.remove();
        bottom.textContent = newVal;
    },300);
}

function tick(){
    const [t,u] = String(value).padStart(2,"0").split("");
    flip(document.getElementById("tens"), t);
    flip(document.getElementById("units"), u);
    if(value === 0){
        timerId = null;
        doneBtnEnebled = true;
        doneButton();
        return;
    }
    value--;
    timerId = setTimeout(tick,1000);
}

function startTurnTimer() {
    value = MAX_TIMER;
    if(timerId !== null){
        clearTimeout(timerId);
        timerId = null;
    }
    startTimer();
}

function startTimer(){
    if(timerId !== null) return;
    tick();
}

function stopTimer() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
    tick();
});




//----------- DICE TABLE AND GAME -----------------
let prewWrapper = null;
let prewPiece = null;
let selectedTile = null;

rollBtnEnebled = true;
doneBtnEnebled = true;
pieceEnebled = true;

renderDice(dieCookie);
document.querySelectorAll(".die").forEach(el => {
    el.style.backgroundPosition = dicePos[0];
    });

function renderDice(id) {
    document.querySelectorAll(".die").forEach(el => {
        el.style.backgroundImage = `url(${selectedDie})`;
     });

    document.querySelectorAll(".die").forEach(el => {
        el.classList.remove("black-shadow", "red-shadow");
    });

    if(id == 0 || id == 1 || id == 4 || id == 5) {
        document.querySelectorAll(".die").forEach(el => {
            el.classList.add("black-shadow");
        });
    }
    if(id == 2) {
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

        if(volumeOption.id == "sound-off") {
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

const dieOptions = document.querySelectorAll(".die-options");
dieOptions.forEach(dieOption => {
    dieOption.addEventListener("click", () => {
        dieOptions.forEach(t => t.classList.remove("selected"));
        dieOption.classList.add("selected");

        var dieId = Number(dieOption.id[2]);
        document.getElementById("dice-title").textContent =  diceNames[dieId];
        faces = diceFaces[dieId];
        selectedDie = dicePath + faces;
        const diceSpriteImg = new Image();
        diceSpriteImg.src = selectedDie;
        setCookie("diceFaces", dieId);
        renderDice(dieId);
    });
});

const bgOptions = document.querySelectorAll(".bg-options");
bgOptions.forEach(bgOption => {
  bgOption.addEventListener("click", () => {
    bgOptions.forEach(t => t.classList.remove("selected"));
    bgOption.classList.add("selected");

    var bgId = Number(bgOption.id[2]);
    document.getElementById("bg-title").textContent =  backgrounds[bgId].slice(0, -4); 
    
    body.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
    document.getElementById("opt-bg").style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
    document.getElementById("modal").style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
    setCookie("background", bgId);
  });
});


function renderTidyness(tidyness){
    const boardTitle = document.getElementById("board-title");
    const boardTexts = document.querySelectorAll('.board-options-text');
    boardTexts.forEach(t => t.classList.remove('selected'));

    document.querySelectorAll(".piece").forEach(el => {
        let wrapper = el.parentElement;
        if(tidyness == 0) {
            boardTitle.textContent = "Perfect";
            wrapper.style.transform = "rotate(0deg)";
            el.style.backgroundPosition = "50% 50%";
        }
        if(tidyness == 1) {
            boardTitle.textContent = "Tidy";
            wrapper.style.transform = "rotate(" + rndNum(-7, 7) + "deg)";
            el.style.backgroundPosition = rndNum(40, 60) + "% " + rndNum(25, 75) + "%";
        }
        if(tidyness == 2) {
            boardTitle.textContent = "Natural";
            wrapper.style.transform = "rotate(" + rndNum(0, 359) + "deg)";
            el.style.backgroundPosition = rndNum(25, 75) + "% " + rndNum(25, 75) + "%";
        }
    });
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
function showWinnerPopup(winner) {
    if(winner) { // both player 1 or 2
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

function fireWinnerConfetti (duration) {
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
rollBtn.addEventListener("click", function() {  
    if (!isMyTurn()) return;
    if(rollBtnEnebled == false ) return;
    if(gameState.dice.rollsLeft < 1) return;

    rollBtnEnebled = false;
    doneBtnEnebled = false;

    //startTurnTimer();

    if(isVolumeOn) {
        new Audio("resources/sounds/roll.mp3").play();
    }
    document.querySelector("#rollBtn .text-button").innerText = "ROLL " + --gameState.dice.rollsLeft;
    rollAnimationID = setInterval(rollAnimation, 100);
    stopRollID = setInterval(stopRoll, 1200);

    document.querySelectorAll(".tile").forEach(el => {
        el.classList.remove("tile_highlited"); // reset
    });
    gameState.possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
    gameState.combinationsRealized.fill(0);

    document.querySelectorAll(".result").forEach(el => {
        el.classList.remove("higlited"); // reset
    });

    if(selectedTile != null) {
        if(tableCheck(selectedTile.id) == 0) {
            wrapper = selectedTile.querySelector(".wrapPiece");
            piece = selectedTile.querySelector(".piece");

            selectedTile.querySelector(".wrapPiece").classList.add("img-disappear");
            wrapper.addEventListener("animationend", (e) => {
            if (e.animationName === "bounceOut") {
                piece.classList.remove("img-bounce");
                wrapper.classList.remove("img-disappear");
            }
            }, { once: true });
        } 
    }
});



function rollAnimation() {
    let d = 0;
    let e = 0;
    let rndValues = [0,0,0,0,0];

    if (tidyness == 0) { d= 0; e=0; }
    if (tidyness == 1) { d= 0; e=10; }
    if (tidyness == 2) { d= 7; e=10; }

    for(let i =0; i<5; i++) {
        if(!gameState.dice.locked[i]) {
            rndValues[i] = rndNum(1,6);
            ddElements[i].style.backgroundPosition = dicePos[rndValues[i]];
            wwElements[i].style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
        }
    }
} 





//--------------- STOP ROLL ------------------
function stopRoll() {
    clearInterval(rollAnimationID);
    clearInterval(stopRollID);

    socket.emit("action", {
        type: "STOP_ROLL",
        localPlayer: LOCAL_PLAYER,
    });
}


socket.on("stopRoll_result", state => {
    gameState = state;

    let d = 0;
    let e = 0;
    if (tidyness == 0) { d= 0; e=0; }
    if (tidyness == 1) { d= 0; e=5; }
    if (tidyness == 2) { d= 7; e=10; }

    for(let i=0; i<5; i++) {
        if(!gameState.dice.locked[i]) {
            ddElements[i].style.backgroundPosition = dicePos[gameState.dice.values[i]];
            wwElements[i].style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
        }
    }

    resultsHighlite();
    tableHighlite();
    rollBtnEnebled = true;
    doneBtnEnebled = true;
});    



function resultsHighlite() {
    for(let i = 0; i < 8; i++) {
        if (gameState.combinationsRealized[0] != 0) {
            rrElements[0].classList.add("higlited");
        }
    }
}


//----------- PIECE PLACEMENT ---------------
document.querySelectorAll(".piece").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;
        if(pieceEnebled == false) return;

        let piece = document.getElementById(this.id);
        console.log("piece clicked: " + piece.id);
        handlePiece(piece.id);
    });
});


function handlePiece(pieceId) {
    if(!pieceId) return;

    let piece = document.getElementById(pieceId);
    let wrapper = piece.parentElement;
    let tile = wrapper.parentElement;


    if(possibleMovesCheck(tile.id) !== 1) return;
    if(tableCheck(tile.id) !== 0) return;
 
    if(tableCheck(tile.id) == 0) {
        if (piece.classList.contains("img-bounce"))  {
            wrapper.classList.add("img-disappear"); //remove the piece

            wrapper.addEventListener("animationend", (e) => {
                if (e.animationName === "bounceOut") {
                    piece.classList.remove("img-bounce");
                    wrapper.classList.remove("img-disappear");
                    pieceEnebled = true;
                    selectedTile = null;
                }
            }, { once: true });
        
        } else {    
            //place the piece
            placePiece(pieceId);
        }
    }
}


function placePiece(pieceId) {

    let piece = document.getElementById(pieceId);
    let wrapper = piece.parentElement;
    let tile = wrapper.parentElement;

    if(gameState.currentPlayer == 1) {piece.style.backgroundImage = urlOf(gameState.players[1].pieceImage);}
    if(gameState.currentPlayer == 2) {piece.style.backgroundImage = urlOf(gameState.players[2].pieceImage);}

    if(tidyness == 0) {wrapper.style.transform = "rotate 0deg";}
    if(tidyness == 1) {wrapper.style.transform = "rotate(" + rndNum(-7, 7) + "deg)";}
    if(tidyness == 2) {wrapper.style.transform = "rotate(" + rndNum(0, 359) + "deg)";}

    if(tidyness == 0) {piece.style.backgroundPosition = "50% 50%";}
    if(tidyness == 1) {piece.style.backgroundPosition = rndNum(40, 60) + "% " + rndNum(25, 75) + "%";}
    if(tidyness == 2) {piece.style.backgroundPosition = rndNum(25, 75) + "% " + rndNum(25, 75) + "%";}
    
    wrapper.classList.remove("img-disappear");
    piece.classList.add("img-bounce");

    selectedTile = wrapper.parentElement;

    if(prewPiece !== null) {
        if(prewPiece !== piece) {
            prewPiece.classList.remove("img-bounce");
            prewWrapper.classList.remove("img-disappear");
        }
    }
    prewWrapper = wrapper;
    prewPiece = piece;

    wrapper.addEventListener("animationend", (e) => {
        pieceEnebled = true;
    }, { once: true });

}


function tableHighlite() {

    document.querySelectorAll(".result").forEach(el => {
        el.classList.remove("higlited"); // reset
    });

    //brelan
    if (gameState.combinationsRealized[0] != 0) {
        switch (gameState.combinationsRealized[0]) {
            case 1:
                if(possibleMovesCheck("a1") && tableCheck("a1") == 0) { document.getElementById("a1").classList.add("tile_highlited");}
                if(possibleMovesCheck("e4") && tableCheck("e4") == 0) { document.getElementById("e4").classList.add("tile_highlited");}
                break;

            case 2:
                if(possibleMovesCheck("a2") && tableCheck("a2") == 0) { document.getElementById("a2").classList.add("tile_highlited");}
                if(possibleMovesCheck("b5") && tableCheck("b5") == 0) { document.getElementById("b5").classList.add("tile_highlited");}
                break;

            case 3:
                if(possibleMovesCheck("b1") && tableCheck("b1") == 0) { document.getElementById("b1").classList.add("tile_highlited");}
                if(possibleMovesCheck("a5") && tableCheck("a5") == 0) { document.getElementById("a5").classList.add("tile_highlited");}
                break;

            case 4:
                if(possibleMovesCheck("d1") && tableCheck("d1") == 0) { document.getElementById("d1").classList.add("tile_highlited");}
                if(possibleMovesCheck("e5") && tableCheck("e5") == 0) { document.getElementById("e5").classList.add("tile_highlited");}
                break;

            case 5:
                if(possibleMovesCheck("e2") && tableCheck("e2") == 0) { document.getElementById("e2").classList.add("tile_highlited");}                 
                if(possibleMovesCheck("d5") && tableCheck("d5") == 0) { document.getElementById("d5").classList.add("tile_highlited");}
                break;

            case 6:
                if(possibleMovesCheck("e1") && tableCheck("e1") == 0) { document.getElementById("e1").classList.add("tile_highlited");}
                if(possibleMovesCheck("a4") && tableCheck("a4") == 0) { document.getElementById("a4").classList.add("tile_highlited");}
                break;
        }
    }

    //sec
    if (gameState.combinationsRealized[1] == 1) {
        if(possibleMovesCheck("c2") && tableCheck("c2") == 0) { document.getElementById("c2").classList.add("tile_highlited");}
        if(possibleMovesCheck("b4") && tableCheck("b4") == 0) { document.getElementById("b4").classList.add("tile_highlited");}
    }   

    //appel
    if (gameState.combinationsRealized[2] == 1) {
        if(possibleMovesCheck("c1") && tableCheck("c1") == 0) { document.getElementById("c1").classList.add("tile_highlited");}
        if(possibleMovesCheck("d3") && tableCheck("d3") == 0) { document.getElementById("d3").classList.add("tile_highlited");}
    }

    //full
    if (gameState.combinationsRealized[3] == 1) {
        if(possibleMovesCheck("d2") && tableCheck("d2") == 0) { document.getElementById("d2").classList.add("tile_highlited");}
        if(possibleMovesCheck("b3") && tableCheck("b3") == 0) { document.getElementById("b3").classList.add("tile_highlited");}
    }

    //carre
    if (gameState.combinationsRealized[4] == 1) {
        if(possibleMovesCheck("b2") && tableCheck("b2") == 0) { document.getElementById("b2").classList.add("tile_highlited");}
        if(possibleMovesCheck("c5") && tableCheck("c5") == 0) { document.getElementById("c5").classList.add("tile_highlited");}
    }

    //petit
    if (gameState.combinationsRealized[5] == 1) {
        if(possibleMovesCheck("a3") && tableCheck("a3") == 0) { document.getElementById("a3").classList.add("tile_highlited");}
        if(possibleMovesCheck("d4") && tableCheck("d4") == 0) { document.getElementById("d4").classList.add("tile_highlited");}
    }

    //suite
    if (gameState.combinationsRealized[6] == 1) {
        if(possibleMovesCheck("e3") && tableCheck("e3") == 0) { document.getElementById("e3").classList.add("tile_highlited");}
        if(possibleMovesCheck("c4") && tableCheck("c4") == 0) { document.getElementById("c4").classList.add("tile_highlited");}
    }

    //yam
    if (gameState.combinationsRealized[7] == 1) {
        if(possibleMovesCheck("c3") && tableCheck("c3") == 0) { document.getElementById("c3").classList.add("tile_highlited");}         
    }

    document.querySelectorAll(".tile_highlited").forEach(el => {
        el.style.outlineColor = gameState.players[gameState.currentPlayer].color;
    });
}


//------------------DONE BUTTON----------------------
doneBtn.addEventListener("click", doneButton);
    
function doneButton(e) {   
    if (!isMyTurn()) return;
    if(doneBtnEnebled == false ) return;

    console.log("done_click");
    //send to the server where the player placed the piece
    socket.emit("action", {
        type: "DONE",
        localPlayer: LOCAL_PLAYER,
        tileCoordinate: selectedTile === null ? null : selectedTile.id
    });
}

socket.on("place_piece", tileCoordinate => {
    if(tileCoordinate) placePiece("piece_" + tileCoordinate);

    //end of the game
    if(gameState.players[1].remainingPieces == 0 ||  gameState.players[2].remainingPieces == 0 || gameState.isFive == true) { 
        stopTimer()
        rollBtnEnebled = false;
        doneBtnEnebled = true;

        if(gameState.players[1].points > gameState.players[2].points) {   
            showWinnerPopup(1);
        } else if(gameState.players[1].points < gameState.players[2].points) {
            showWinnerPopup(2);
        } else {
            //it's a tie
            showWinnerPopup(0);
        }
        return;
    }
    startTurnTimer();

});


function clearForNextTurn() {
    console.log;("clearForNextTurn");

    prewPiece = null;
    prewWrapper = null;
    selectedTile = null;

    console.log;("Tranform before is " + wr1.style.transform);

    //dice position reset
    wr1.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr2.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr3.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr4.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr5.style.transform = 'rotate(0deg) translate(0px,0px)';

    console.log;("Tranform after is " + wr1.style.transform);

    //dice highlight reset
    document.querySelectorAll(".die").forEach(el => {
        el.classList.remove("selected"); // reset
        el.style.backgroundPosition = dicePos[0];
    });

    //Roll button reset
    document.querySelector("#rollBtn .text-button").innerText = "ROLL 3";
    gameState.numRoll = 3;

    //result highlights reset
    document.querySelectorAll(".result").forEach(el => {
        el.classList.remove("higlited"); // reset
    });

    //call highlights reset
    document.querySelectorAll(".call.selectable").forEach(el => {
        el.classList.remove("checked"); // reset
    });

    //table tiles highlights reset
    document.querySelectorAll(".tile").forEach(el => {
        el.classList.remove("tile_highlited"); // reset
    });
}



//----------- LOCK DICE ---------------
document.querySelectorAll(".die").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;

        elem = document.getElementById(this.id);
        if (elem.classList.contains("selected")) {
            gameState.dice.locked[Number(this.id[2]) - 1] = false;
            elem.classList.remove("selected"); // reset
        } else {
            gameState.dice.locked[Number(this.id[2]) - 1] = true;
            elem.classList.add("selected");
        }

        socket.emit("action", {
            type: "LOCK_DICE",
            localPlayer: LOCAL_PLAYER,
            lockedDice: gameState.dice.locked
        });
    });
});

socket.on("lockDice_result", state => {
        gameState.dice.locked = state;
        diceIds = ["dd1", "dd2", "dd3", "dd4", "dd5"];

        for(let i=0; i<5; i++) {
            elem = document.getElementById(diceIds[i]);

            if( gameState.dice.locked[i]) {
                if (!elem.classList.contains("selected")) {
                    elem.classList.add("selected");
                }

            } else {
                elem.classList.remove("selected");
            }
                
        }
});


//----------- SELECT CALL ---------------
document.querySelectorAll(".result").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;

        el.classList.add("tip-on");
        setTimeout(() => {
        el.classList.remove("tip-on");
        }, 800); // durata visibilità

        //Only for selectable results
        if (!el.classList.contains("selectable")) return;
        //Only if not firts throw
        if(gameState.dice.rollsLeft === 3) return;

        const elemId = document.getElementById(this.id).id;
        const targetId = "cc" + elemId.slice(2);
        const targetDiv = document.getElementById(targetId);

        if (targetDiv.classList.contains("checked")) {
            targetDiv.classList.remove("checked"); 
        } else {
            document.querySelectorAll(".call.selectable").forEach(el => {
                el.classList.remove("checked"); // reset
            });
            //Not possible to call carre if 4 dice are locked
            if(document.querySelectorAll(".die.selected").length === 4 && targetId === "cc5") return;
            //Not possible to call carre on carre
            if(gameState.combinationsRealized[4] === 1 && targetId === "cc5") return;
            //Only if at least one die is rolled
            if(document.querySelectorAll(".die.selected").length === 5) return;

            targetDiv.classList.add("checked");
        }
    });
});




function highlighteCall (state) {
    for(let i=3; i<8; i++) {
        if( state[i]) {
            if (!ccElements[i].classList.contains("checked")) {
                ccElements[i].classList.add("checked");
            }
        } else {
            ccElements[i].classList.remove("checked");
        }   
    }

}


function stateUpdate() {

    coinP1Text.textContent = gameState.players[1].points;
    coinP2Text.textContent = gameState.players[2].points;
    pawnP1Text.textContent = gameState.players[1].remainingPieces;
    pawnP2Text.textContent = gameState.players[2].remainingPieces;

    divPlayerShadow(gameState.currentPlayer); 
    renderBoardFromState(gameState.table);
}


function divsOpacity(state) {
    if (!state) return;

    const opacity = (state.currentPlayer === LOCAL_PLAYER) ? 1 : 0.5;
    document.getElementById("div-dice").style.opacity = opacity;
    document.getElementById("div-resultsAndCalls").style.opacity = opacity;
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


socket.on("selectCall_result", state => {
        highlighteCall(state);
});




function renderDice(id) {
    document.querySelectorAll(".die").forEach(el => {
        el.style.backgroundImage = `url(${selectedDie})`;
     });

    document.querySelectorAll(".die").forEach(el => {
        el.classList.remove("black-shadow", "red-shadow");
    });

    if(id == 0 || id == 1 || id == 4 || id == 5) {
        document.querySelectorAll(".die").forEach(el => {
            el.classList.add("black-shadow");
        });
    }
    if(id == 2) {
        document.querySelectorAll(".die").forEach(el => {
            el.classList.add("red-shadow");
        });
    }
}






//----------- COOCKIES FUNCIONS ---------------

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
        if(cookieValue == "undefined") {
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




//----------- UTILITY FUNCIONS ---------------

function urlOf(path) {
    return "url('" + path + "')";
}


const rows = { a:0, b:1, c:2, d:3, e:4 };


function rndNum(numFrom, numTo) {
    let  spanNum = numTo - numFrom + 1;
    let num = Math.floor(Math.random() * spanNum) + numFrom; // numFrom to numTo
    if (num < numFrom) {num = numFrom;}
    if (num > numTo) {num = numTo;}
    return num;
}


function possibleMovesCheck(coordinates) {
    if(!coordinates) {return -1;}

    const r = rows[coordinates[0]];    
    const c = Number(coordinates[1]) - 1; 
    return gameState.possibleMoves[c][r];
}


function tableCheck(divId) {
    if(!divId) {return -1;}

    const r = rows[divId[0]];    
    const c = Number(divId[1]) - 1; 
    return gameState.table[c][r];
}


function tableFill(divId, value) {
    if(!divId) return;

    const r = rows[divId[0]];    
    const c = Number(divId[1]) - 1; 
    gameState.table[c][r] = value;
}


function toBoolean(val) {
  return String(val).toLowerCase() === "true";
}


function preload(url) {
  const img = new Image();
  img.src = url;
}





//----------- SERVER SIDE ---------------

socket.on("init", data => {
    LOCAL_PLAYER = data.playerNumber;
    gameState = data.gameState;
    console.log("You are player " + LOCAL_PLAYER);

    if(LOCAL_PLAYER == 1) {
        textPlayerP1.textContent = "YOU";
    } else {
        textPlayerP2.textContent = "YOU";
    }

    boxPlayer1.style.backgroundColor = gameState.players[1].color;
    boxPlayer2.style.backgroundColor = gameState.players[2].color;
});


socket.on("state_update", state => {
    gameState = state;
    clearForNextTurn();
    divsOpacity(state);
    renderPlayerBox(state.currentPlayer);
});






