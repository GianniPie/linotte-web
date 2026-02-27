//Version
const VERSION = "1.68";
document.getElementById("version").innerHTML += VERSION;


const dd1 = document.getElementById("dd1");
const dd2 = document.getElementById("dd2");
const dd3 = document.getElementById("dd3");
const dd4 = document.getElementById("dd4");
const dd5 = document.getElementById("dd5");

const wr1 = document.getElementById("wr1");
const wr2 = document.getElementById("wr2");
const wr3 = document.getElementById("wr3");
const wr4 = document.getElementById("wr4");
const wr5 = document.getElementById("wr5");

const rollBtn = document.getElementById("rollBtn");
const doneBtn = document.getElementById("doneBtn");
const openBtn = document.getElementById("options");

// const body = document.getElementById("body");
const optionsOverlay = document.getElementById("options-overlay");

const body = document.getElementById('body');
const tile = document.querySelector('.tile');

let rollAnimationID;
let stopRollID;

function setRealVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setRealVh();
window.addEventListener('resize', setRealVh);
window.addEventListener('orientationchange', setRealVh);



//------ PLAYERS ---------------
var player1 = {
    name: "",
    pieceImage: "",
    color: "",
    points: 0,
    remainingPieces: 12,
    local: true
};

var player2 = {
    name: "",
    pieceImage: "",
    color: "",
    points: 0,
    remainingPieces: 12,
    local: true
};
var players = [player1, player2];

let p1p = rndNum(8, pieces.length - 1);
player1.pieceImage = piecesPath + pieces[p1p] + imgExtention;
let p2p = p1p;
while(p2p == p1p) {
    p2p = rndNum(8, pieces.length - 1);
}
player2.pieceImage = piecesPath + pieces[p2p] + imgExtention;

preload(player1.pieceImage);
preload(player2.pieceImage);

player1.color = "#" + player1.pieceImage.split("_")[1].slice(0, 6);
player2.color = "#" + player2.pieceImage.split("_")[1].slice(0, 6);
const selectedColor = [null, player1.color, player2.color];
document.getElementsByClassName("player p1")[0].style.backgroundColor = player1.color;
document.getElementsByClassName("player p2")[0].style.backgroundColor = player2.color;

let currentPlayer = 1;
document.getElementsByClassName("player p1")[0].style.setProperty("--glow", player1.color);
document.getElementsByClassName("player p1")[0].classList.add("current"); 

const LOCAL_PLAYER = 1; 
function isMyTurn() {return currentPlayer;}

const pawnP1Text = document.getElementById("pawnP1Text");
const coinP1Text = document.getElementById("coinP1Text");
const pawnP2Text = document.getElementById("pawnP2Text");
const coinP2Text = document.getElementById("coinP2Text");

pawnP1Text.textContent = player1.remainingPieces;
coinP1Text.textContent = player1.points;
pawnP2Text.textContent = player2.remainingPieces;
coinP2Text.textContent = player2.points;
 


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
let combinationaRealized = [0,0,0,0,0,0,0,0];
let brelan = 0;

let numRoll = 3;
let diceResult = [0,0,0,0,0];
let isRealized = false;
var isFive = false;

let prewWrapper = null;
let prewPiece = null;
let selectedTile = null;
let table =         Array.from({ length: 5 }, () => Array(5).fill(0));
let possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
const rows = { a:0, b:1, c:2, d:3, e:4 };

rollBtnEnebled = true;
doneBtnEnebled = true;
pieceEnebled = true;

var gameState = {
    table,
    currentPlayer,
    player1,
    player2
}
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

    if(id == 0 || id == 1) {
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
    if(winner) {
        document.getElementsByClassName("piece-popup-container")[0].classList.add("pulse");
        document.getElementsByClassName("piece-popup-container")[0].style.setProperty("--glow", players[winner-1].color);
        document.getElementById("piece-popup").style.backgroundImage = urlOf(players[winner-1].pieceImage);
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


//----------- PIECES AND TABLE -----------------

document.querySelectorAll(".piece").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;
        if(pieceEnebled == false) return;

        let piece = document.getElementById(this.id);
        let wrapper = piece.parentElement;
        let tile = wrapper.parentElement;

        if(tableCheck(tile.id) !== 0) return;
        if(possibleMovesCheck(tile.id) !== 1) return;
        
        if(tableCheck(tile.id) == 0) {
            if (piece.classList.contains("img-bounce")) {
                //remove the piece
                wrapper.classList.add("img-disappear");
                selectedTile = null;

                wrapper.addEventListener("animationend", (e) => {
                    if (e.animationName === "bounceOut") {
                        piece.classList.remove("img-bounce");
                        wrapper.classList.remove("img-disappear");
                        pieceEnebled = true;
                    }
                }, { once: true });
                
            } else {    
                //place the piece
                if(currentPlayer == 1) {piece.style.backgroundImage = urlOf(player1.pieceImage);}
                if(currentPlayer == 2) {piece.style.backgroundImage = urlOf(player2.pieceImage);}

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
        }
    });
});



function tableFill(divId, value) {
    if(!divId) return;

    const r = rows[divId[0]];    
    const c = Number(divId[1]) - 1; 
    table[c][r] = value;
}


function tableCheck(divId) {
    const r = rows[divId[0]];    
    const c = Number(divId[1]) - 1; 
    return table[c][r];
}


//----------- ROLL BUTTON -----------------
rollBtn.addEventListener("click", function() {  
    if (!isMyTurn()) return;
    if(rollBtnEnebled == false ) return;
    if(numRoll < 1) return;

    rollBtnEnebled = false;
    doneBtnEnebled = false;

    //startTurnTimer();

    if(isVolumeOn) {
        new Audio("resources/sounds/roll.mp3").play();
    }
    document.querySelector("#rollBtn .text-button").innerText = "ROLL " + --numRoll;
    rollAnimationID = setInterval(rollAnimation, 100);
    stopRollID = setInterval(stopRoll, 1200);

    document.querySelectorAll(".tile").forEach(el => {
        el.classList.remove("tile_highlited"); // reset
    });
    possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
    combinationaRealized.fill(0);
    brelan = 0;
    isRealized = false;
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

    if (tidyness == 0) { d= 0; e=0; }
    if (tidyness == 1) { d= 0; e=10; }
    if (tidyness == 2) { d= 7; e=10; }

    if(!dd1.classList.contains("selected")) {
        diceResult[0] = rndNum(1,6);
        dd1.style.backgroundPosition = dicePos[diceResult[0]];
        wr1.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd2.classList.contains("selected")) {
        diceResult[1] = rndNum(1,6);
        dd2.style.backgroundPosition = dicePos[diceResult[1]];
        wr2.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd3.classList.contains("selected")) {
        diceResult[2] = rndNum(1,6);
        dd3.style.backgroundPosition = dicePos[diceResult[2]];
        wr3.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd4.classList.contains("selected")) {
        diceResult[3] = rndNum(1,6);
        dd4.style.backgroundPosition = dicePos[diceResult[3]];
        wr4.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd5.classList.contains("selected")) {
        diceResult[4] = rndNum(1,6);
        dd5.style.backgroundPosition = dicePos[diceResult[4]];
        wr5.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
} 



function rndNum(numFrom, numTo) {
    var  spanNum = numTo - numFrom + 1;
    var num = Math.floor(Math.random() * spanNum) + numFrom; // numFrom to numTo
    if (num < numFrom) {num = numFrom;}
    if (num > numTo) {num = numTo;}
    return num;
}

    
function possibleMovesFill(coordinates) {
    const r = rows[coordinates[0]];    
    const c = Number(coordinates[1]) - 1; 
    possibleMoves[c][r] = 1;
}


function possibleMovesCheck(coordinates) {
    const r = rows[coordinates[0]];    
    const c = Number(coordinates[1]) - 1; 
    return possibleMoves[c][r];
}


//----------- STOP ROLL -----------------
function stopRoll() {
    clearInterval(rollAnimationID);
    clearInterval(stopRollID);

    let diceSum = diceResult.reduce((diceTotal, diceVal) => diceTotal + diceVal, 0);
    let diceResultStr = diceResult.join(""); 

    let c1 = diceResultStr.split("1").length - 1;
    let c2 = diceResultStr.split("2").length - 1;
    let c3 = diceResultStr.split("3").length - 1;
    let c4 = diceResultStr.split("4").length - 1;
    let c5 = diceResultStr.split("5").length - 1;
    let c6 = diceResultStr.split("6").length - 1;

    document.querySelectorAll(".result").forEach(el => {
        el.classList.remove("higlited"); // reset
    });

    //brelan
    if(c1 >= 3) {
        brelan = 1;
        possibleMovesFill ("a1");
        possibleMovesFill ("e4");
        combinationaRealized[0] = 1;
    } else if (c2 >= 3) {
        brelan = 2;
        possibleMovesFill ("a2");
        possibleMovesFill ("b5");
        combinationaRealized[0] = 1;
    } else if (c3 >= 3) {
        brelan = 3;
        possibleMovesFill ("b1");
        possibleMovesFill ("a5");
        combinationaRealized[0] = 1;
    } else if (c4 >= 3) {
        possibleMovesFill ("d1");
        possibleMovesFill ("e5");
        combinationaRealized[0] = 1;
        brelan = 4;
    } else if (c5 >= 3) {
        possibleMovesFill ("e2");
        possibleMovesFill ("d5");
        combinationaRealized[0] = 1;
        brelan = 5;
    } else if (c6 >= 3) {
        brelan = 6;
        possibleMovesFill ("e1");
        possibleMovesFill ("a4");
        combinationaRealized[0] = 1;
    } 
    
    //full
    if(((c1 == 3) || (c2 == 3) || (c3 == 3) || (c4 == 3) || (c5 == 3) || (c6 == 3)) &&
       ((c1 == 2) || (c2 == 2) || (c3 == 2) || (c4 == 2) || (c5 == 2) || (c6 == 2))     )
    {   
        possibleMovesFill ("d2");
        possibleMovesFill ("b3");
        combinationaRealized[3] = 1;
        isRealized = true;
    }
    
    //carre
    if((c1 >= 4) || (c2 >= 4) || (c3 >= 4) || (c4 >= 4) || (c5 >= 4) || (c6 >= 4))
    {
        possibleMovesFill ("b2");
        possibleMovesFill ("c5");
        combinationaRealized[4] = 1;
        isRealized = true;
    }
    
    //petit
    if(diceSum < 9){
        possibleMovesFill ("a3");
        possibleMovesFill ("d4");
        combinationaRealized[5] = 1;
        isRealized = true;
    }

    //suite
    if(((c1 == 1) && (c2 == 1) && (c3 == 1) && (c4 == 1) && (c5 == 1) && (c6 == 0)) ||
        ((c1 == 0) && (c2 == 1) && (c3 == 1) && (c4 == 1) && (c5 == 1) && (c6 == 1))     )
    {
        possibleMovesFill ("e3");
        possibleMovesFill ("c4");
        combinationaRealized[6] = 1;
        isRealized = true;
    }

    //yam
    if((c1 == 5) || (c2 == 5) || (c3 == 5) || (c4 == 5) || (c5 == 5) || (c6 == 5))
    {
        possibleMovesFill ("c3");
        combinationaRealized[7] = 1;
        isRealized = true;
    }

    //sec
    const count = document.querySelectorAll(".die.selected").length;
    if((count === 0) && (isRealized == true))
    {
        possibleMovesFill ("c2");
        possibleMovesFill ("b4");
        combinationaRealized[1] = 1;
    }

    //appel
    if(document.getElementById("cc4").classList.contains("checked") && combinationaRealized[3] == 1) {
        combinationaRealized[2] = 1;
    }
    if(document.getElementById("cc5").classList.contains("checked") && combinationaRealized[4] == 1) {
        combinationaRealized[2] = 1;
    }
    if(document.getElementById("cc6").classList.contains("checked") && combinationaRealized[5] == 1) {
        combinationaRealized[2] = 1;
    }
    if(document.getElementById("cc7").classList.contains("checked") && combinationaRealized[6] == 1) {
        combinationaRealized[2] = 1;
    }
    if(document.getElementById("cc8").classList.contains("checked") && combinationaRealized[7] == 1) {
        combinationaRealized[2] = 1;
    }

    if(combinationaRealized[2] == 1) {
        possibleMovesFill ("c1");
        possibleMovesFill ("d3");
    }

    resultsHighlite();
    tableHighlite();
    rollBtnEnebled = true;
    doneBtnEnebled = true;
}     



function resultsHighlite() {
    if (combinationaRealized[0] == 1) {
        document.getElementById("rr1").classList.add("higlited");
    }
    if (combinationaRealized[1] == 1) {
        document.getElementById("rr2").classList.add("higlited");
    }
    if (combinationaRealized[2] == 1) {
        document.getElementById("rr3").classList.add("higlited");
    }
    if (combinationaRealized[3] == 1) {
        document.getElementById("rr4").classList.add("higlited");
    }
    if (combinationaRealized[4] == 1) {
        document.getElementById("rr5").classList.add("higlited");
    }
    if (combinationaRealized[5] == 1) {
        document.getElementById("rr6").classList.add("higlited");
    }
    if (combinationaRealized[6] == 1) {
        document.getElementById("rr7").classList.add("higlited");
    }
    if (combinationaRealized[7] == 1) {
        document.getElementById("rr8").classList.add("higlited");
    }
}


function tableHighlite() {

    if (combinationaRealized[0] == 1) {
        switch (brelan) {
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
    if (combinationaRealized[1] == 1) {
        if(possibleMovesCheck("c2") && tableCheck("c2") == 0) { document.getElementById("c2").classList.add("tile_highlited");}
        if(possibleMovesCheck("b4") && tableCheck("b4") == 0) { document.getElementById("b4").classList.add("tile_highlited");}
    }   

    //appel
    if (combinationaRealized[2] == 1) {
        if(possibleMovesCheck("c1") && tableCheck("c1") == 0) { document.getElementById("c1").classList.add("tile_highlited");}
        if(possibleMovesCheck("d3") && tableCheck("d3") == 0) { document.getElementById("d3").classList.add("tile_highlited");}
    }

    //full
    if (combinationaRealized[3] == 1) {
        if(possibleMovesCheck("d2") && tableCheck("d2") == 0) { document.getElementById("d2").classList.add("tile_highlited");}
        if(possibleMovesCheck("b3") && tableCheck("b3") == 0) { document.getElementById("b3").classList.add("tile_highlited");}
    }

    //carre
    if (combinationaRealized[4] == 1) {
        if(possibleMovesCheck("b2") && tableCheck("b2") == 0) { document.getElementById("b2").classList.add("tile_highlited");}
        if(possibleMovesCheck("c5") && tableCheck("c5") == 0) { document.getElementById("c5").classList.add("tile_highlited");}
    }

    //petit
    if (combinationaRealized[5] == 1) {
        if(possibleMovesCheck("a3") && tableCheck("a3") == 0) { document.getElementById("a3").classList.add("tile_highlited");}
        if(possibleMovesCheck("d4") && tableCheck("d4") == 0) { document.getElementById("d4").classList.add("tile_highlited");}
    }

    //suite
    if (combinationaRealized[6] == 1) {
        if(possibleMovesCheck("e3") && tableCheck("e3") == 0) { document.getElementById("e3").classList.add("tile_highlited");}
        if(possibleMovesCheck("c4") && tableCheck("c4") == 0) { document.getElementById("c4").classList.add("tile_highlited");}
    }

    //yam
    if (combinationaRealized[7] == 1) {
        if(possibleMovesCheck("c3") && tableCheck("c3") == 0) { document.getElementById("c3").classList.add("tile_highlited");}         
    }

    document.querySelectorAll(".tile_highlited").forEach(el => {
        el.style.outlineColor = selectedColor[currentPlayer];
    });
}


//------------------DONE BUTTON----------------------
doneBtn.addEventListener("click", doneButton);
    
function doneButton(e) {   
    if (!isMyTurn()) return;
    if(doneBtnEnebled == false ) return;

    if(selectedTile != null){
        tableFill(selectedTile.id, currentPlayer);
        countPieces();
        countPoint();
    }


    prewPiece = null;
    prewWrapper = null;
    selectedTile = null;
    diceResult = [0,0,0,0,0];

    wr1.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr2.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr3.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr4.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr5.style.transform = 'rotate(0deg) translate(0px,0px)';

    document.querySelectorAll(".die").forEach(el => {
        el.classList.remove("selected"); // reset
        el.style.backgroundPosition = dicePos[0];

        document.querySelector("#rollBtn .text-button").innerText = "ROLL 3";
        numRoll = 3;
    });

    brelan = 0;
    combinationaRealized.fill(0);
    document.querySelectorAll(".result").forEach(el => {
        el.classList.remove("higlited"); // reset
    });

    document.querySelectorAll(".call.selectable").forEach(el => {
        el.classList.remove("checked"); // reset
    });

    document.querySelectorAll(".tile").forEach(el => {
        el.classList.remove("tile_highlited"); // reset
    });

    possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
    numDicesThrowed = 0;
    isRealized = false;

        //end of the game
    if(player1.remainingPieces == 0 ||  player2.remainingPieces == 0 || isFive == true) { 
        stopTimer()
        rollBtnEnebled = false;
        doneBtnEnebled = true;

        if(player1.points > player2.points) {   
            showWinnerPopup(1);
        } else if(player1.points < player2.points) {
            showWinnerPopup(2);
        } else {
            //it's a tie
            showWinnerPopup(0);
        }
        return;
    }

    if(currentPlayer === 1){
        currentPlayer = 2;
        document.getElementsByClassName("player p2")[0].style.setProperty("--glow", player2.color);
        document.getElementsByClassName("player p1")[0].style.boxShadow = "black 0px 0px 0px 0px";

        document.getElementsByClassName("player p2")[0].classList.add("current");
        document.getElementsByClassName("player p1")[0].classList.remove("current");           
    } else {
        currentPlayer = 1;
        document.getElementsByClassName("player p1")[0].style.setProperty("--glow", player1.color);
        document.getElementsByClassName("player p2")[0].style.boxShadow = "black 0px 0px 0px 0px";

        document.getElementsByClassName("player p1")[0].classList.add("current");
        document.getElementsByClassName("player p2")[0].classList.remove("current");
    }

    startTurnTimer();
}

document.querySelectorAll(".die").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;
        if(numRoll === 3) return;

        elem = document.getElementById(this.id);

        if (elem.classList.contains("selected")) {
            elem.classList.remove("selected"); // reset
        } else {
            elem.classList.add("selected");
        }
    });
});

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
        if(numRoll === 3) return;

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
            if(combinationaRealized[4] === 1 && targetId === "cc5") return;
            //Only if at least one die is rolled
            if(document.querySelectorAll(".die.selected").length === 5) return;

            targetDiv.classList.add("checked");
        }
    });
});


// document.querySelectorAll(".call.selectable").forEach(el => {
//     el.addEventListener("click", function() {
//         if (!isMyTurn()) return;

//         const elemId = document.getElementById(this.id);

//         if (elemId.classList.contains("checked")) {
//             elemId.classList.remove("checked"); 
//         } else {
//             document.querySelectorAll(".call.selectable").forEach(el => {
//                 el.classList.remove("checked"); // reset
//             });
//             elemId.classList.add("checked");
//         }
//     });
// });

function countPieces(){
    player1.remainingPieces = 12 - table.flat().filter(v => v == "1").length;
    player2.remainingPieces = 12 - table.flat().filter(v => v == "2").length;
    pawnP1Text.textContent = player1.remainingPieces;
    pawnP2Text.textContent = player2.remainingPieces;
}

function countPoint()
{ 
    player1.points = 0;
    player2.points = 0;
    tableArray = table.flat();

    //check Horizontal
    for (var y = 0; y < 25; y+=5) {
        for (var x = 0; x < 3; x++) {
            const tris = [tableArray[y + x], tableArray[y + x + 1],  tableArray[y + x + 2]].join("");
            if(tris == "111"){player1.points++;}
            if(tris == "222"){player2.points++;}
        }
    }


    //check Vertical 
    for (var x = 0; x < 5; x++) {
        for (var y = 0; y < 25; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 5],  tableArray[y + x + 10]].join("");
            if(tris == "111"){player1.points++;}
            if(tris == "222"){player2.points++;}
        }
    }


    //check Diagonal
    for (var x = 0; x < 3; x++) {
        for (var y = 0; y < 15; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 6],  tableArray[y + x + 12]].join("");
            if(tris == "111"){player1.points++;}
            if(tris == "222"){player2.points++;}
        }
    }


    //check Diagonal
    for (var x = 2; x < 5; x++) {
        for (var y = 0; y < 15; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 4],  tableArray[y + x + 8]].join("");
            if(tris == "111"){player1.points++;}
            if(tris == "222"){player2.points++;}
        }
    }

    coinP1Text.textContent = player1.points;
    coinP2Text.textContent = player2.points;

    //check 5 in a row
    var five = 0;
    //check Horizontal
    for (var i = 0; i < 25; i+=5) {
        five = [tableArray[i + 0], tableArray[i + 1],  tableArray[i + 2], tableArray[i + 3],  tableArray[i + 4]].join("");
        if(five == "11111"){isFive = true; return;}
        if(five == "22222"){isFive = true; return;}  
    }

    //check Vertical 
    for (var i = 0; i < 25; i++) {
        five = [tableArray[i + 0], tableArray[i + 5],  tableArray[i + 10], tableArray[i + 15],  tableArray[i + 20]].join("");
        if(five == "11111"){isFive = true; return;}
        if(five == "22222"){isFive = true; return;}  
    }

    //check Diagonal
        five = [tableArray[0], tableArray[6],  tableArray[12], tableArray[18],  tableArray[24]].join("");
        if(five == "11111"){isFive = true; return;}
        if(five == "22222"){isFive = true; return;}  

        five = [tableArray[4], tableArray[8],  tableArray[12], tableArray[16],  tableArray[20]].join("");
        if(five == "11111"){isFive = true; return;}
        if(five == "22222"){isFive = true; return;}  
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



function urlOf(path) {
    return "url('" + path + "')";
}


function preload(url) {
  const img = new Image();
  img.src = url;
}

function toBoolean(val) {
  return String(val).toLowerCase() === "true";
}


