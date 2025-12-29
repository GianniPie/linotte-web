const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let gameState = {
  table: Array.from({ length: 5 }, () => Array(5).fill(0)),
  currentPlayer: 1,
  players: {
    1: { points: 0, remainingPieces: 12 },
    2: { points: 0, remainingPieces: 12 }
  }
};

let sockets = {};

io.on("connection", socket => {
 let playerNumber = null;

  if (!sockets[1]) {
    playerNumber = 1;
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
    gameState,
    playersConfig
  });
 

  socket.on("action", data => {
    if (data.player !== gameState.currentPlayer) return;

    // applica azione
    if (data.type === "DONE") {
      countPoints();
      gameState.table = data.table;
      gameState.players = data.players;
      gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    }

    io.emit("stateUpdate", gameState);
  });

  socket.on("disconnect", () => {
    delete sockets[playerNumber];
  });
});

server.listen(3000);



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

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let p1p = rnd(0, pieces.length - 1);
let p2p = p1p;
while (p2p === p1p) {
  p2p = rnd(0, pieces.length - 1);
}

const playersConfig = {
  1: {
    pieceImage: piecesPath + pieces[p1p] + imgExtention,
    color: "#" + pieces[p1p].split("_")[1]
  },
  2: {
    pieceImage: piecesPath + pieces[p2p] + imgExtention,
    color: "#" + pieces[p2p].split("_")[1]
  }
};




function countPoints()
{ 
    gameState.players[1].points = 0;
    gameState.players[2].points = 0;
    let tableArray = gameState.table.flat();

    //check Horizontal
    for (var y = 0; y < 25; y+=5) {
        for (var x = 0; x < 3; x++) {
            const tris = [tableArray[y + x], tableArray[y + x + 1],  tableArray[y + x + 2]].join("");
            if(tris == "111"){gameState.players[1].points++;}
            if(tris == "222"){gameState.players[2].points++;}
        }
    }


    //check Vertical 
    for (var x = 0; x < 5; x++) {
        for (var y = 0; y < 25; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 5],  tableArray[y + x + 10]].join("");
            if(tris == "111"){gameState.players[1].points++;}
            if(tris == "222"){gameState.players[2].points++;}
        }
    }


    //check Diagonal
    for (var x = 0; x < 3; x++) {
        for (var y = 0; y < 15; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 6],  tableArray[y + x + 12]].join("");
            if(tris == "111"){gameState.players[1].points++;}
            if(tris == "222"){gameState.players[2].points++;}
        }
    }


    //check Diagonal
    for (var x = 2; x < 5; x++) {
        for (var y = 0; y < 15; y+=5) {
            const tris = [tableArray[y + x], tableArray[y + x + 4],  tableArray[y + x + 8]].join("");
            if(tris == "111"){gameStateplayers[1].points++;}
            if(tris == "222"){gameState.players[2].points++;}
        }
    }
}



function countPieces(){

    gameState.players[1].remainingPieces = 12 - gameState.table.flat().filter(v => v == "1").length;
    gameState.players[2].remainingPieces = 12 - gameState.table.flat().filter(v => v == "2").length;
}