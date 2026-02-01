//npm start //nella root per avviare il server
//http://localhost:3000


const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

let sockets = {};
server.listen(3000);

const rows = { a:0, b:1, c:2, d:3, e:4 };


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


const piecesPath = "resources/images/pieces/";
const imgExtention = ".svg";
let pieces =  [
    "p001_ed1c24ff",
    "p002_40b93cff",
    "p003_50ade5ff",
    "p004_e9dc01ff",
    "p005_c240fcff",
    "p006_f14be6ff",
    "p007_737373ff",
    "p008_ff7106ff",
    "p009_e3e3e3ff",
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
    "p023_ec9843ff",
    "p024_e6d448ff",
    "p025_ad8a72ff",
    "p026_e6d448ff",
    "p027_ad8a72ff",
    "p028_c5d4eaff",
    "p029_fd6c92ff",
];



  //assignes icon and color
  let p1p = rnd(0, pieces.length - 1);
  let p2p = p1p;
  while (p2p === p1p) {
    p2p = rnd(0, pieces.length - 1);
  }
  gameState.players[1].pieceImage = piecesPath + pieces[p1p] + imgExtention;
  gameState.players[1].color = "#" + pieces[p1p].split("_")[1];
  gameState.players[2].pieceImage = piecesPath + pieces[p2p] + imgExtention;
  gameState.players[2].color = "#" + pieces[p2p].split("_")[1];



//------------- HANDLE CONNECTIONS --------------
io.on("connection", socket => {
 let playerNumber = null;

  if (!sockets[1]) {
    playerNumber = 1;
    gameState.currentPlayer = 1;
    sockets[1] = socket.id;
  } else if (!sockets[2]) {
    playerNumber = 2;
    sockets[2] = socket.id;
  } else {
    socket.emit("full");
    socket.disconnect();
    return;
  }

  socket.emit("init", {
    playerNumber,
    gameState
  });

  socket.emit("state_update", gameState);


  //------------- HANDLE ACTIONS --------------
  socket.on("action", data => {
    if (data.localPlayer !== gameState.currentPlayer) return;
    console.log("Action received:", data);

    if (data.type === "STOP_ROLL") {
      gameState.dice.rollsLeft--;
      for(let i =0; i<5; i++) {
        if(!gameState.dice.locked[i]) {
            gameState.dice.values[i] = rndNum(1,6);
        }
      }
      findCombinations();
      io.emit("stopRoll_result", gameState);
    }

    else if (data.type === "LOCK_DICE") {
      gameState.dice.locked = data.lockedDice;
      socket.broadcast.emit("lockDice_result", gameState.dice.locked);
    }

    else if (data.type === "SELEC_CALL") {
      gameState.called = data.selectedCalls;
      socket.broadcast.emit("selectCall_result", gameState.called);
    }

    else if (data.type === "DONE") {
      tableFill(data.tileCoordinate, data.localPlayer); //tableFill updates gameState
      countPoints(gameState);
      countPieces(gameState);
      socket.broadcast.emit("place_piece", data.tileCoordinate);
    
      gameState.dice.rollsLeft = 3;
      gameState.dice.locked.fill(false);
      gameState.combinationsRealized.fill(0);
      gameState.possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
      gameState.called = [null,null,null,false,false,false,false,false];
      gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
      io.emit("state_update", gameState);
    }

  });

  socket.on("disconnect", () => {
    delete sockets[playerNumber];
  });

});


function findCombinations() {

  gameState.possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
  gameState.combinationsRealized.fill(0);

  //Puts the results in one single string and counts the amount of the same results
  let diceResultStr = gameState.dice.values.join(""); 
  let c1 = diceResultStr.split("1").length - 1; //Numers of ones
  let c2 = diceResultStr.split("2").length - 1;
  let c3 = diceResultStr.split("3").length - 1;
  let c4 = diceResultStr.split("4").length - 1;
  let c5 = diceResultStr.split("5").length - 1;
  let c6 = diceResultStr.split("6").length - 1;  //Number of sixs

  //brelan
  if(c1 >= 3) {
      possibleMovesFill("a1");
      possibleMovesFill("e4");
      gameState.combinationsRealized[0] = 1;
  } else if (c2 >= 3) {
      possibleMovesFill("a2");
      possibleMovesFill("b5");
      gameState.combinationsRealized[0] = 2;
  } else if (c3 >= 3) {
      possibleMovesFill("b1");
      possibleMovesFill("a5");
      gameState.combinationsRealized[0] = 3;
  } else if (c4 >= 3) {
      possibleMovesFill("d1");
      possibleMovesFill("e5");
      gameState.combinationsRealized[0] = 4;
  } else if (c5 >= 3) {
      possibleMovesFill("e2");
      possibleMovesFill("d5");
      gameState.combinationsRealized[0] = 5;
  } else if (c6 >= 3) {
      possibleMovesFill("e1");
      possibleMovesFill("a4");
      gameState.combinationsRealized[0] = 6;
  } 
  
  //full
  if(((c1 == 3) || (c2 == 3) || (c3 == 3) || (c4 == 3) || (c5 == 3) || (c6 == 3)) &&
      ((c1 == 2) || (c2 == 2) || (c3 == 2) || (c4 == 2) || (c5 == 2) || (c6 == 2))     )
  {   
      possibleMovesFill ("c2");
      possibleMovesFill ("b3");
      gameState.combinationsRealized[3] = 1;
  }
  
  //carre
  if((c1 >= 4) || (c2 >= 4) || (c3 >= 4) || (c4 >= 4) || (c5 >= 4) || (c6 >= 4))
  {
      possibleMovesFill ("b2");
      possibleMovesFill ("c5");
      gameState.combinationsRealized[4] = 1;
  }
  
  //petit
  let diceSum = gameState.dice.values.reduce((diceTotal, diceVal) => diceTotal + diceVal, 0);
  if(diceSum < 9){
      possibleMovesFill ("a3");
      possibleMovesFill ("d4");
      gameState.combinationsRealized[5] = 1;
  }

  //suite
  if(((c1 == 1) && (c2 == 1) && (c3 == 1) && (c4 == 1) && (c5 == 1) && (c6 == 0)) ||
      ((c1 == 0) && (c2 == 1) && (c3 == 1) && (c4 == 1) && (c5 == 1) && (c6 == 1))     )
  {
      possibleMovesFill ("e3");
      possibleMovesFill ("c4");
      gameState.combinationsRealized[6] = 1;
  }

  //yam
  if((c1 == 5) || (c2 == 5) || (c3 == 5) || (c4 == 5) || (c5 == 5) || (c6 == 5))
  {
      possibleMovesFill ("c3");
      gameState.combinationsRealized[7] = 1;
  }

  //sec
  if((!gameState.dice.locked.some(Boolean)) && (gameState.called.slice(3, 8).some(Boolean)))
  {
      possibleMovesFill ("d2");
      possibleMovesFill ("b4");
      gameState.combinationsRealized[1] = 1;
  }

  //appel
  for(let i = 3; i < 8; i++) {
      if(gameState.called[i] && gameState.combinationsRealized[i]) {
          gameState.combinationsRealized[2] = 1;
      }
  }
  if(gameState.combinationsRealized[2] == 1) {
      possibleMovesFill ("c1");
      possibleMovesFill ("d3");
  }

}




function countPoints(state)
{
    gameState.players[1].points = 0;
    gameState.players[2].points = 0;
    let tableArray = state.table.flat();

    //check Horizontal
    for (let y = 0; y < 25; y+=5) {
        for (let x = 0; x < 3; x++) {
            const tris = [tableArray[y + x], tableArray[y + x + 1],  tableArray[y + x + 2]].join("");
            if(tris == "111"){gameState.players[1].points++;}
            if(tris == "222"){gameState.players[2].points++;}
        }
    }

    //check Vertical 
    for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 25; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 5],  tableArray[y + x + 10]].join("");
            if(tris == "111"){gameState.players[1].points++;}
            if(tris == "222"){gameState.players[2].points++;}
        }
    }

    //check Diagonal
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 15; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 6],  tableArray[y + x + 12]].join("");
            if(tris == "111"){gameState.players[1].points++;}
            if(tris == "222"){gameState.players[2].points++;}
        }
    }

    //check Diagonal
    for (let x = 2; x < 5; x++) {
        for (let y = 0; y < 15; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 4],  tableArray[y + x + 8]].join("");
            if(tris == "111"){gameState.players[1].points++;}
            if(tris == "222"){gameState.players[2].points++;}
        }
    }
}



function countPieces(state){
    gameState.players[1].remainingPieces = 12 - state.table.flat().filter(v => v == "1").length;
    gameState.players[2].remainingPieces = 12 - state.table.flat().filter(v => v == "2").length;
}







// Utility Functions

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function tableFill(divId, value) {
  if(divId === null) {return -1;}

  const r = rows[divId[0]];    
  const c = Number(divId[1]) - 1; 
  gameState.table[c][r] = value;
}


function possibleMovesFill(coordinates) {
  const r = rows[coordinates[0]];    
  const c = Number(coordinates[1]) - 1; 
  gameState.possibleMoves[c][r] = 1;
}

function rndNum(numFrom, numTo) {
    let  spanNum = numTo - numFrom + 1;
    let num = Math.floor(Math.random() * spanNum) + numFrom; // numFrom to numTo
    if (num < numFrom) {num = numFrom;}
    if (num > numTo) {num = numTo;}
    return num;
}