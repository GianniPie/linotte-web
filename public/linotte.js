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
const optBtn = document.getElementById("options");

const body = document.getElementById("body");
const modal = document.getElementById("modal");
const overlay = document.getElementById("overlay");

let rollAnimationID;
let stopRollID;

const diceNames = [
    "CLASSIC",
    "FLAT",
    "ONE RED",
    "CHINESE",
    "PERSIAN",
];

const dicePath = "resources/images/dice/";
const diceClassic = [
    "c100.svg",
    "c101.svg",
    "c102.svg",
    "c103.svg",
    "c104.svg",
    "c105.svg",
    "c106.svg"
];

const diceOneRed = [
    "g100.svg",
    "g107.svg",
    "g102.svg",
    "g103.svg",
    "g104.svg",
    "g105.svg",
    "g106.svg"
];

const diceFlat = [
    "g100.svg",
    "g101.svg",
    "g102.svg",
    "g103.svg",
    "g104.svg",
    "g105.svg",
    "g106.svg"
];

const diceChinese = [
    "g100.svg",
    "ch101.svg",
    "ch102.svg",
    "ch103.svg",
    "ch104.svg",
    "ch105.svg",
    "ch106.svg"
];

const dicePersian = [
    "g100.svg",
    "p101.svg",
    "p102.svg",
    "p103.svg",
    "p104.svg",
    "p105.svg",
    "p106.svg"
];
const diceFaces = [diceClassic, diceFlat, diceOneRed, diceChinese, dicePersian];
let faces = diceFaces[getCookie("diceFaces")];

const bgPath = "resources/images/backgrounds/";
const backgrounds = [
    "diamond-sunset.svg",
    "liquid-cheese.svg",
    "tortoise-shell.svg",
    "sun-tornado.svg",
    "pattern-randomized.svg",
    "subtle-prism.svg",
    "varying-stripes.svg",
    "repeating-triangles.svg"
];
body.style.backgroundImage = urlOf(bgPath + backgrounds[getCookie("background")]);
modal.style.backgroundImage = urlOf(bgPath + backgrounds[getCookie("background")]);



//----------- GAME STATE ---------------
let gameState = {
  table: Array.from({ length: 5 }, () => Array(5).fill(0)),
  possibleMoves: Array.from({ length: 5 }, () => Array(5).fill(0)),
  currentPlayer: 0,
  combinationsRealized: [0,0,0,0,0,0,0,0],
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
const boxPlayer1 = document.querySelector(".player.p1");
const boxPlayer2 = document.querySelector(".player.p2");

let LOCAL_PLAYER = null;

function isMyTurn() {return gameState.currentPlayer == LOCAL_PLAYER;}

const textPlayerP1 = document.getElementById("textPlayerP1");
const textPlayerP2 = document.getElementById("textPlayerP2");
const pawnP1Text = document.getElementById("pawnP1Text").textContent = gameState.players[1].remainingPieces;
const coinP1Text = document.getElementById("coinP1Text").textContent = gameState.players[1].points;
const pawnP2Text = document.getElementById("pawnP2Text").textContent = gameState.players[2].remainingPieces;
const coinP2Text = document.getElementById("coinP2Text").textContent = gameState.players[2].points;



//----------- DICE TABLE AND GAME -----------------

let prewWrapper = null;
let prewPiece = null;
let selectedTile = null;

rollBtnEnebled = true;
doneBtnEnebled = true;
pieceEnebled = true;



//----------- COOCKIES ---------------
let tidyness = getCookie("tidyness", 1);
renderTidyness(tidyness);

let selectedDie = getCookie("diceFaces", 2);
document.getElementById("do" + selectedDie).classList.add("selected");
document.getElementById("dice-title").textContent =  diceNames[selectedDie];

let selectedBg = getCookie("background", "3");
document.getElementById("bg" + selectedBg).classList.add("selected");
document.getElementById("bg-title").textContent =  backgrounds[selectedBg].slice(0, -4); 





//----------- ROLL DICE ---------------
rollBtn.addEventListener("click", function() {  
    if (!isMyTurn()) return;
    if(rollBtnEnebled == false ) return;
    if(gameState.dice.rollsLeft < 1) return;
    
    rollBtnEnebled = false;
    doneBtnEnebled = false;

    new Audio("resources/sounds/roll.mp3").play();
    document.querySelector("#rollBtn .text-button").innerText = "ROLL " + (gameState.dice.rollsLeft-1);

    //Reset highlights from tiles
    document.querySelectorAll(".tile").forEach(el => {
        el.classList.remove("tile_highlited"); // reset
    });

    //Reset highlights from results
    document.querySelectorAll(".result").forEach(el => {
        el.classList.remove("higlited"); // reset
    });

    if(selectedTile !== null) {
        //if any piece is pleced and not confirmed, it removes it
        if(tableCheck(selectedTile.id) == 0) {
            wrapper = selectedTile.querySelector(".wrapPiece");
            piece = selectedTile.querySelector(".piece");

            selectedTile.querySelector(".wrapPiece").classList.add("img-disappear");
            wrapper.addEventListener("animationend", (e) => {
            if (e.animationName === "bounceOut") {
                piece.classList.remove("img-bounce");
                wrapper.classList.remove("img-disappear");
                selectedTile = null;
            }
            }, { once: true });
        } 
    }

    //the action is actually realized in socket.on("stopRoll_result"... funcion
    rollAnimationID = setInterval(rollAnimation, 100);
    stopRollID = setInterval(stopRoll, 1200);

});



function rollAnimation() {
    let d = 0;
    let e = 0;
    let rndValues = [0,0,0,0,0];

    if (tidyness == 1) { d= 0; e=0; }
    if (tidyness == 2) { d= 0; e=5; }
    if (tidyness == 3) { d= 7; e=10; }

    for(let i =0; i<5; i++) {
        if(!gameState.dice.locked[i]) {
            rndValues[i] = rndNum(1,6);
            ddElements[i].style.backgroundImage = urlOf(dicePath + faces[rndValues[i]]);
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
    if (tidyness == 1) { d= 0; e=0; }
    if (tidyness == 2) { d= 0; e=5; }
    if (tidyness == 3) { d= 7; e=10; }

    for(let i=0; i<5; i++) {
        if(!gameState.dice.locked[i]) {
            ddElements[i].style.backgroundImage = urlOf(dicePath + faces[gameState.dice.values[i]]);
            wwElements[i].style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
        }
    }
    //highlite results
    for(let i = 0; i < 8; i++) {
        if (gameState.combinationsRealized[0] != 0) {
            rrElements[0].classList.add("higlited");
        }
    }

    tableHighlite();
    rollBtnEnebled = true;
    doneBtnEnebled = true;
});    




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

    if(tidyness == 1) {wrapper.style.transform = "rotate 0deg";}
    if(tidyness == 2) {wrapper.style.transform = "rotate(" + rndNum(-7, 7) + "deg)";}
    if(tidyness == 3) {wrapper.style.transform = "rotate(" + rndNum(0, 359) + "deg)";}

    if(tidyness == 1) {piece.style.backgroundPosition = "50% 50%";}
    if(tidyness == 2) {piece.style.backgroundPosition = rndNum(40, 60) + "% " + rndNum(25, 75) + "%";}
    if(tidyness == 3) {piece.style.backgroundPosition = rndNum(25, 75) + "% " + rndNum(25, 75) + "%";}
    
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
        if(possibleMovesCheck("d2") && tableCheck("d2") == 0) { document.getElementById("d2").classList.add("tile_highlited");}
        if(possibleMovesCheck("b4") && tableCheck("b4") == 0) { document.getElementById("b4").classList.add("tile_highlited");}
    }   

    //appel
    if (gameState.combinationsRealized[2] == 1) {
        if(possibleMovesCheck("c1") && tableCheck("c1") == 0) { document.getElementById("c1").classList.add("tile_highlited");}
        if(possibleMovesCheck("d3") && tableCheck("d3") == 0) { document.getElementById("d3").classList.add("tile_highlited");}
    }

    //full
    if (gameState.combinationsRealized[3] == 1) {
        if(possibleMovesCheck("c2") && tableCheck("c2") == 0) { document.getElementById("c2").classList.add("tile_highlited");}
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


//----------- DONE BUTTON ---------------
doneBtn.addEventListener("click", function() {  
    if (!isMyTurn()) return;
    if(rollBtnEnebled == false ) return;

    console.log("done_click");
    //send to the server where the player placed the piece
    socket.emit("action", {
        type: "DONE",
        localPlayer: LOCAL_PLAYER,
        tileCoordinate: selectedTile === null ? null : selectedTile.id
    });
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
        el.style.backgroundImage = urlOf(dicePath + faces[0]);
    });

    //Roll button reset
    document.querySelector("#rollBtn .text-button").innerText = "ROLL 3";

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
document.querySelectorAll(".result.selectable").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;

        const elemId = document.getElementById(this.id).id; //relative to the indicator under the icon
        const targetId = elemId.slice(2);

        gameState.called[targetId] === true ? gameState.called[targetId] = false : gameState.called[targetId] = true;
        let mem = gameState.called[targetId];
        gameState.called = [null,null,null,false,false,false,false,false];
        gameState.called[targetId] = mem;
        highlighteCall(gameState.called);

        socket.emit("action", {
            type: "SELEC_CALL",
            localPlayer: LOCAL_PLAYER,
            selectedCalls: gameState.called
        });
    });
});


document.querySelectorAll(".call.selectable").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;

        const elemId = document.getElementById(this.id).id;
        const targetId = elemId.slice(2);
        gameState.called[targetId] === true ? gameState.called[targetId] = false : gameState.called[targetId] = true;
        let mem = gameState.called[targetId];
        gameState.called = [null,null,null,false,false,false,false,false];
        gameState.called[targetId] = mem;
        highlighteCall(gameState.called);
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


function divPlayerShadow (player){
    if(player== 1){
        boxPlayer1.style.boxShadow = gameState.players[1].color + " 0px 0px 8px 8px";
        boxPlayer2.style.boxShadow = "black 0px 0px 0px 0px";
    } else {
        boxPlayer1.style.boxShadow = "black 0px 0px 0px 0px";
        boxPlayer2.style.boxShadow = gameState.players[2].color + " 0px 0px 8px 8px";
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


socket.on("selectCall_result", state => {
        highlighteCall(state);
});


//----------- OVERLAY AND OPTIONS ---------------
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) {
    overlay.style.display = "none";
  }
});

optBtn.addEventListener("click", function() { 
    overlay.style.display = "flex";
});


//----------- TIDYNESS ---------------
document.querySelectorAll('.board-options-text').forEach(boardText => {
  boardText.addEventListener('click', () => {
      
    if(boardText.id == "natural") {
        tidyness=3;
    }
     if(boardText.id == "tidy") {
        tidyness=2; 
     }
      if(boardText.id == "perfect") {
        tidyness=1;  
    }

    renderTidyness(tidyness);
    setCookie("tidyness", tidyness);
  });
});
    

function renderTidyness(tidyness){
    const boardTexts = document.querySelectorAll('.board-options-text');
    boardTexts.forEach(t => t.classList.remove('selected'));

    document.querySelectorAll(".piece").forEach(el => {
        let wrapper = el.parentElement;
        if(tidyness == 1) {
            document.getElementById("perfect").classList.add("selected");
            document.getElementById("board-option").style.backgroundImage = "url('resources/images/g11853.svg')";
            wrapper.style.transform = "rotate(0deg)";
            el.style.backgroundPosition = "50% 50%";
        }
        if(tidyness == 2) {
            document.getElementById("tidy").classList.add("selected");
            document.getElementById("board-option").style.backgroundImage = "url('resources/images/g11852.svg')";
            wrapper.style.transform = "rotate(" + rndNum(-7, 7) + "deg)";
            el.style.backgroundPosition = rndNum(40, 60) + "% " + rndNum(25, 75) + "%";
        }
        if(tidyness == 3) {
            document.getElementById("natural").classList.add("selected");
            document.getElementById("board-option").style.backgroundImage = "url('resources/images/g11851.svg')";
            wrapper.style.transform = "rotate(" + rndNum(0, 359) + "deg)";
            el.style.backgroundPosition = rndNum(25, 75) + "% " + rndNum(25, 75) + "%";
        }
    });
}


//----------- DIE OPTIONS ---------------
const dieOptions = document.querySelectorAll(".die-options");
dieOptions.forEach(dieOption => {
  dieOption.addEventListener("click", () => {
      if(!dieOption.classList.contains("empty")) {

        dieOptions.forEach(t => t.classList.remove("selected"));
        dieOption.classList.add("selected");
        
        let dieId = Number(dieOption.id[2]);
        document.getElementById("dice-title").textContent =  diceNames[dieId];
        faces = diceFaces[dieId];
        setCookie("diceFaces", dieId);
      }
  });
});


//----------- BACKGROUND OPTIONS ---------------
const bgOptions = document.querySelectorAll(".bg-options");
bgOptions.forEach(bgOption => {
  bgOption.addEventListener("click", () => {
    bgOptions.forEach(t => t.classList.remove("selected"));
    bgOption.classList.add("selected");

    let bgId = Number(bgOption.id[2]);
    document.getElementById("bg-title").textContent =  backgrounds[bgId].slice(0, -4); 
    
    body.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
    modal.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
    setCookie("background", bgId);
  });
});




//----------- UTILITY FUNCIONS ---------------

function urlOf(path) {
    return "url('" + path + "')";
}


const rows = { a:0, b:1, c:2, d:3, e:4 };

function tableCheck(divId) {
    if(!divId) {return -1;}

    const r = rows[divId[0]];    
    const c = Number(divId[1]) - 1; 
    return gameState.table[c][r];
}


function rndNum(numFrom, numTo) {
    let  spanNum = numTo - numFrom + 1;
    let num = Math.floor(Math.random() * spanNum) + numFrom; // numFrom to numTo
    if (num < numFrom) {num = numFrom;}
    if (num > numTo) {num = numTo;}
    return num;
}


function possibleMovesCheck(coordinates) {
    const r = rows[coordinates[0]];    
    const c = Number(coordinates[1]) - 1; 
    return gameState.possibleMoves[c][r];
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
    divPlayerShadow(state.currentPlayer);
});


socket.on("place_piece", tileCoordinate => {
    if(tileCoordinate) placePiece("piece_" + tileCoordinate);
});




