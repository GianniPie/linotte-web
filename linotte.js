//21 january

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
const optBtn = document.getElementById("options");

const body = document.getElementById("body");
const modal = document.getElementById("modal");
const overlay = document.getElementById("overlay");


let rollAnimationID;
let stopRollID;


function setRealVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setRealVh();
window.addEventListener('resize', setRealVh);
window.addEventListener('orientationchange', setRealVh);


const diceClassic = [
    "c100.svg",
    "c101.svg",
    "c102.svg",
    "c103.svg",
    "c104.svg",
    "c105.svg",
    "c106.svg"
];

const diceFlat = [
    "g100.svg",
    "g107.svg",
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

const diceTraditional = [
    "tr100.png",
    "tr101.png",
    "tr102.png",
    "tr103.png",
    "tr104.png",
    "tr105.png",
    "tr106.png"
];

const diceRed = [
    "re100.jpg",
    "re101.jpg",
    "re102.jpg",
    "re103.jpg",
    "re104.jpg",
    "re105.jpg",
    "re106.jpg"
];

const diceNames = [
    "TRADITIONAL",
    "CLASSIC",
    "RED",
    "FLAT",
    "CHINESE",
];


const dicePath = "resources/images/dice/";
const diceFaces = [diceTraditional, diceClassic, diceRed, diceFlat, diceChinese];

//dice in options section (it shows the number 1)
document.getElementById("do0").style.backgroundImage = urlOf(dicePath + diceFaces[0][1]);
document.getElementById("do1").style.backgroundImage = urlOf(dicePath + diceFaces[1][1]);
document.getElementById("do2").style.backgroundImage = urlOf(dicePath + diceFaces[2][1]);
document.getElementById("do3").style.backgroundImage = urlOf(dicePath + diceFaces[3][1]);
document.getElementById("do4").style.backgroundImage = urlOf(dicePath + diceFaces[4][1]);

const bgPath = "resources/images/backgrounds/";
const backgrounds = [
    "diamond-sunset.svg",
    "liquid-cheese.svg",
    "tortoise-shell.svg",
    "sun-tornado.svg",
    "pattern-randomized.svg",
    "subtle-prism.svg",
    "parabolic-ellipse.svg",
    "repeating-triangles.svg"
];

const piecesPath = "resources/images/pieces/";
const imgExtention = ".svg";
let pieces =  [
    "p001_ed1c24ff",
    "p002_40b93cff",
    "p003_50ade5ff",
    "p004_e9dc01ff",
    "p005_c240fcff",
    "p006_f14be6ff",
    "p007_e3e3e3ff",
    "p008_ff7106ff",
    "p009_737373ff",
    "p010_ff0606ff",
    "p011_b4aaaaff",
    "p012_e1b27cff",
    "p013_e06a51ff",
    "p014_f7e764ff",
    "p015_5c5cddff",
    "p016_be1500ff",
    "p017_fdc97aff",
    "p018_fdc5a3ff",
    "p019_bbcd46ff",
    "p020_e9a233ff",
    "p021_f6d74aff",
    "p022_a4c037ff",
    "p023_dc5443ff",
    "p024_e6d448ff",
    "p025_ad8a72ff",
    "p026_e6d448ff",
    "p027_ad8a72ff",
    "p028_c5d4eaff",
    "p029_fd6c92ff",
    "p030_e49c5dff",
    "p031_00a0d7ff",
    "p032_eead46ff",
    "p033_8b59d3ff",
    "p034_8f542bff",
    "p035_40b93cff",
    "p036_ff8f23ff",
    "p037_fcfcfaff",
    "p038_5d6c7cff",
    "p039_f14be6ff"
];

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

let p1p = rndNum(8, pieces.length - 1);
player1.pieceImage = piecesPath + pieces[p1p] + imgExtention;
let p2p = p1p;
while(p2p == p1p) {
    p2p = rndNum(8, pieces.length - 1);
}
player2.pieceImage = piecesPath + pieces[p2p] + imgExtention;

preload(player1.pieceImage);
preload(player2.pieceImage);

player1.color = "#" + player1.pieceImage.split("_")[1].slice(0, -6);
player2.color = "#" + player2.pieceImage.split("_")[1].slice(0, -6);
const selectedColor = [null, player1.color, player2.color];
document.getElementsByClassName("player p1")[0].style.backgroundColor = player1.color;
document.getElementsByClassName("player p2")[0].style.backgroundColor = player2.color;
let currentPlayer = 1;
document.getElementsByClassName("player p1")[0].style.boxShadow = player1.color + " 0px 0px 0px 5px";

const LOCAL_PLAYER = 1; // o 2
function isMyTurn() {return currentPlayer;}

const pawnP1Text = document.getElementById("pawnP1Text");
const coinP1Text = document.getElementById("coinP1Text");
const pawnP2Text = document.getElementById("pawnP2Text");
const coinP2Text = document.getElementById("coinP2Text");

pawnP1Text.textContent = player1.remainingPieces;
coinP1Text.textContent = player1.points;
pawnP2Text.textContent = player2.remainingPieces;
coinP2Text.textContent = player2.points;
 


//----------- COOCKIES ---------------
let tidyness = getCookie("tidyness", 3);
renderTidyness(tidyness); //it shows the selection in the option section

let selectedDie = getCookie("diceFaces", 3);
document.getElementById("do" + selectedDie).classList.add("selected"); //otion section
document.getElementById("dice-title").textContent =  diceNames[selectedDie];
let faces = diceFaces[selectedDie];  //faces of the selected die

for(let i = 0; i < diceResult.length; i++) {
    preload(urlOf(dicePath + faces[i]));
}

let selectedBg = getCookie("background", 3);
document.getElementById("bg" + selectedBg).classList.add("selected"); //option section
document.getElementById("bg-title").textContent =  backgrounds[selectedBg].slice(0, -4); 

body.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);
modal.style.backgroundImage = urlOf(bgPath + backgrounds[selectedBg]);



//----------- DICE TABLE AND GAME -----------------
let combinationaRealized = [0,0,0,0,0,0,0,0];
let brelan = 0;

let numRoll = 3;
let diceResult = [0,0,0,0,0];
let isRealized = false;

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







overlay.addEventListener("click", (e) => {
  if (e.target === overlay) {
    overlay.style.display = "none";
  }
});


optBtn.addEventListener("click", function() { 
    overlay.style.display = "flex";
});


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


const dieOptions = document.querySelectorAll(".die-options");

dieOptions.forEach(dieOption => {
    dieOption.addEventListener("click", () => {
        if(!dieOption.classList.contains("empty")) {

            dieOptions.forEach(t => t.classList.remove("selected"));
            dieOption.classList.add("selected");

            var dieId = Number(dieOption.id[2]);
            document.getElementById("dice-title").textContent =  diceNames[dieId];
            faces = diceFaces[dieId];
            dd1.style.backgroundImage = urlOf(dicePath + faces[diceResult[0]]);
            dd2.style.backgroundImage = urlOf(dicePath + faces[diceResult[1]]);
            dd3.style.backgroundImage = urlOf(dicePath + faces[diceResult[2]]);
            dd4.style.backgroundImage = urlOf(dicePath + faces[diceResult[3]]);
            dd5.style.backgroundImage = urlOf(dicePath + faces[diceResult[4]]);
            setCookie("diceFaces", dieId);
        }
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
    modal.style.backgroundImage = urlOf(bgPath + backgrounds[bgId]);
    setCookie("background", bgId);
  });
});


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



rollBtn.addEventListener("click", function() {  
    if (!isMyTurn()) return;
    if(rollBtnEnebled == false ) return;
    if(numRoll < 1) return;

    rollBtnEnebled = false;
    doneBtnEnebled = false;

    new Audio("resources/sounds/roll.mp3").play();
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

    if (tidyness == 1) { d= 0; e=0; }
    if (tidyness == 2) { d= 0; e=5; }
    if (tidyness == 3) { d= 7; e=10; }

    if(!dd1.classList.contains("selected")) {
        diceResult[0] = rndNum(1,6);
        dd1.style.backgroundImage = urlOf(dicePath + faces[diceResult[0]]);
        wr1.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd2.classList.contains("selected")) {
        diceResult[1] = rndNum(1,6);
        dd2.style.backgroundImage = urlOf(dicePath + faces[diceResult[1]]);
        wr2.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd3.classList.contains("selected")) {
        diceResult[2] = rndNum(1,6);
        dd3.style.backgroundImage = urlOf(dicePath + faces[diceResult[2]]);
        wr3.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd4.classList.contains("selected")) {
        diceResult[3] = rndNum(1,6);
        dd4.style.backgroundImage = urlOf(dicePath + faces[diceResult[3]]);
        wr4.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd5.classList.contains("selected")) {
        diceResult[4] = rndNum(1,6);
        dd5.style.backgroundImage = urlOf(dicePath + faces[diceResult[4]]);
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
        possibleMovesFill ("c2");
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
        possibleMovesFill ("d2");
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
        if(possibleMovesCheck("d2") && tableCheck("d2") == 0) { document.getElementById("d2").classList.add("tile_highlited");}
        if(possibleMovesCheck("b4") && tableCheck("b4") == 0) { document.getElementById("b4").classList.add("tile_highlited");}
    }   

    //appel
    if (combinationaRealized[2] == 1) {
        if(possibleMovesCheck("c1") && tableCheck("c1") == 0) { document.getElementById("c1").classList.add("tile_highlited");}
        if(possibleMovesCheck("d3") && tableCheck("d3") == 0) { document.getElementById("d3").classList.add("tile_highlited");}
    }

    //full
    if (combinationaRealized[3] == 1) {
        if(possibleMovesCheck("c2") && tableCheck("c2") == 0) { document.getElementById("c2").classList.add("tile_highlited");}
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
doneBtn.addEventListener("click", function() {  
    if (!isMyTurn()) return;
    if(rollBtnEnebled == false ) return;

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
        el.style.backgroundImage = urlOf(dicePath + faces[0]);

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

    if(currentPlayer === 1){
        currentPlayer = 2;
        document.getElementsByClassName("player p1")[0].style.boxShadow = "black 0px 0px 0px 0px";
        document.getElementsByClassName("player p2")[0].style.boxShadow = player2.color + " 0px 0px 0px 6px";
    } else {
        currentPlayer = 1;
        document.getElementsByClassName("player p2")[0].style.boxShadow = "black 0px 0px 0px 0px";
        document.getElementsByClassName("player p1")[0].style.boxShadow = player1.color + " 0px 0px 0px 6px";
    }
});



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


document.querySelectorAll(".result.selectable").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;

        const elemId = document.getElementById(this.id).id;
        const targetId = "cc" + elemId.slice(2);
        const targetDiv = document.getElementById(targetId);

        if (targetDiv.classList.contains("checked")) {
            targetDiv.classList.remove("checked"); 
        } else {
            document.querySelectorAll(".call.selectable").forEach(el => {
                el.classList.remove("checked"); // reset
            });
            targetDiv.classList.add("checked");
        }
    });
});


document.querySelectorAll(".call.selectable").forEach(el => {
    el.addEventListener("click", function() {
        if (!isMyTurn()) return;

        const elemId = document.getElementById(this.id);

        if (elemId.classList.contains("checked")) {
            elemId.classList.remove("checked"); 
        } else {
            document.querySelectorAll(".call.selectable").forEach(el => {
                el.classList.remove("checked"); // reset
            });
            elemId.classList.add("checked");
        }
    });
});


function countPieces(){

    console.log("table " + table.flat());
    player1.remainingPieces = 12 - table.flat().filter(v => v == "1").length;
    player2.remainingPieces = 12 - table.flat().filter(v => v == "2").length;
    console.log("P1 PIECES " + player1.remainingPieces);

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