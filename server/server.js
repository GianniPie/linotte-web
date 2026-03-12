//npm init -y  //crea file json
//npm install express socket.io
//npm start //nella root per avviare il server
//http://localhost:3000


//----------- SERVER SETTINGS ---------------

import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// cartella con html/css/js del client
app.use(express.static("public"));

// cartella con codice condiviso client/server
app.use("/shared", express.static("shared"));

io.on("connection", (socket) => {
  console.log("player connected");
});

server.listen(3000, () => {
  console.log("server running on port 3000");
});





//----------- GAME STATE ---------------
import { urlOf, rndNum, idToCoo, matrixCheck, matrixFill, toBoolean } from "/shared/utils.js";
import { dicePath, diceFaces, dicePos, diceNames, bgPath, backgrounds, piecesPath, pieces } from "/shared/assets.js";

import { createInitialGameState } from '/shared/utils.js';
let gameState = createInitialGameState();
startOffline();

let p1p = rndNum(8, pieces.length - 1);
gameState.players[1].pieceImage = piecesPath + pieces[p1p];
let p2p = p1p;
while (p2p == p1p) {
  p2p = rndNum(8, pieces.length - 1);
}
gameState.players[2].pieceImage = piecesPath + pieces[p2p];

gameState.players[1].color = "#" + gameState.players[1].pieceImage.split("_")[1].slice(0, 6);
gameState.players[2].color = "#" + gameState.players[2].pieceImage.split("_")[1].slice(0, 6);



// metodo                    chi riceve
// socket.emit()             solo il client
// io.emit()                 tutti
// socket.broadcast.emit()   tutti tranne mittente
// io.to(room).emit()        una room
// socket.to(room).emit()    room tranne mittente
// io.to(socketId).emit()    un client specifico


//------------- HANDLE CONNECTIONS --------------
const sockets = {};

io.on("connection", socket => {
  console.log("CONNECT", socket.id, "sockets:", Object.keys(sockets));

  let playerNumber = null;

  if (!sockets[1]) {
    playerNumber = 1;
    sockets[1] = socket;
  } else if (!sockets[2]) {
    playerNumber = 2;
    sockets[2] = socket;
  } else {
    socket.emit("roomFull");
    return;
  }
  socket.playerNumber = playerNumber;
  console.log("ASSIGNED player", playerNumber);
  gameState.currentPlayer = 1;

  //------------- GAME INIT --------------
  socket.emit("init", {
    playerNumber,
    gameState
    // socket.emit("state_update", gameState);
  });

  //------------- HANDLE ACTIONS --------------
  socket.on("action", action => {
    if (action.localPlayer !== gameState.currentPlayer) return;
    console.log("Action received:", action);
    updateGame(action);
    io.emit("state_update", gameState);

  });

  //------------- CLOSE CONNECTION --------------
  socket.on("disconnect", () => {
    console.log("DISCONNECT", socket.id, "player", socket.playerNumber);
    delete sockets[playerNumber];
  });
});


function updateGame(action) {
  switch (action.type) {
    case "STOP_ROLL":
      gameState.dice.rollsLeft--;
      for (let i = 0; i < 5; i++) {
        if (!gameState.dice.locked[i]) {
          gameState.dice.values[i] = rndNum(1, 6);
        }
      }
      findCombinations();
      break;

    case "LOCK_DICE":
      gameState.dice.locked = action.lockedDice;
      break;

    case "SELECT_CALL":
      gameState.called = action.selectedCalls;
      break;

    case "DONE":
      if (action.selectedTile != null) {
      //   matrixFill(action.tileCoordinate, action.localPlayer, gameState.table);
      //   countPoints(gameState);
      //   countPieces(gameState);
      //   socket.broadcast.emit("place_piece", action.tileCoordinate);
      // }
      
      // gameState.dice.rollsLeft = 3;
      // gameState.dice.locked.fill(false);
      // gameState.dice.values.fill(0);
      // gameState.combinationsRealized.fill(0);
      // gameState.possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
      // gameState.called = [null, null, null, false, false, false, false, false];
      // gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
      break;

  }
}

