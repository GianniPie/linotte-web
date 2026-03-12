
import { tile, rndNum, matrixFill } from "../shared/utils.js";


export function updateGame(state, action) {
    switch (action.type) {
        case "ROLL_DICE":
            return rollDice(state);
        case "STOP_ROLL":
            return stopRoll(state);
        case "LOCK_DICE":
            return lockDice(state, action.locked);
        case "PLACE_PIECE":
            return placePiece(state, action.coordinates, action.player);
        case "END_TURN":
            return endTurn(state);
        default:
            return state;
    }
}


function rollDice(state) {
    if (state.dice.rollsLeft <= 0) return state;
    for (let i = 0; i < 5; i++) {
        if (!state.dice.locked[i]) {
            state.dice.values[i] = rndNum(1, 6);
        }
    }
    state.dice.rollsLeft--;
    return state;
}


function lockDice(state, locked) {
    state.dice.locked = locked;
    return state;
}


function stopRoll(state) {
    findCombinations(state);
    return state;
}


function placePiece(state, coordinates, player) {
    matrixFill(coordinates, player, state.table);
    return state;
}


function endTurn(state) {
    countPoints(state);
    countPieces(state);
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    state.dice.rollsLeft = 3;
    state.dice.locked.fill(false);
    state.combinationsRealized.fill(0);
    state.possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
    return state;
}



    //    matrixFill(action.tileCoordinate, action.localPlayer, gameState.table);
    //     countPoints(gameState);
    //     countPieces(gameState);
    //     socket.broadcast.emit("place_piece", action.tileCoordinate);
    //   }
      
    //   gameState.dice.rollsLeft = 3;
    //   gameState.dice.locked.fill(false);
    //   gameState.dice.values.fill(0);
    //   gameState.combinationsRealized.fill(0);
    //   gameState.possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
    //   gameState.called = [null, null, null, false, false, false, false, false];
    //   gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;




function findCombinations(state) {
    let isRealized = false;
    state.possibleMoves = Array.from({ length: 5 }, () => Array(5).fill(0));
    state.combinationsRealized.fill(0);

    const dice = state.dice.values;
    let c1 = dice.filter(v => v === 1).length; //Numers of ones
    let c2 = dice.filter(v => v === 2).length;
    let c3 = dice.filter(v => v === 3).length;
    let c4 = dice.filter(v => v === 4).length;
    let c5 = dice.filter(v => v === 5).length;
    let c6 = dice.filter(v => v === 6).length; //Number of sixs

    //brelan
    if (c1 >= 3) {
        matrixFill(tile.b11, 1, state.possibleMoves);
        matrixFill(tile.b12, 1, state.possibleMoves);
        state.combinationsRealized[0] = 1;
    } else if (c2 >= 3) {
        matrixFill(tile.b21, 1, state.possibleMoves);
        matrixFill(tile.b22, 1, state.possibleMoves);
        state.combinationsRealized[0] = 2;
    } else if (c3 >= 3) {
        matrixFill(tile.b31, 1, state.possibleMoves);
        matrixFill(tile.b32, 1, state.possibleMoves);
        state.combinationsRealized[0] = 3;
    } else if (c4 >= 3) {
        matrixFill(tile.b41, 1, state.possibleMoves);
        matrixFill(tile.b42, 1, state.possibleMoves);
        state.combinationsRealized[0] = 4;
    } else if (c5 >= 3) {
        matrixFill(tile.b51, 1, state.possibleMoves);
        matrixFill(tile.b52, 1, state.possibleMoves);
        state.combinationsRealized[0] = 5;
    } else if (c6 >= 3) {
        matrixFill(tile.b61, 1, state.possibleMoves);
        matrixFill(tile.b62, 1, state.possibleMoves);
        state.combinationsRealized[0] = 6;
    }

    //full
    if (((c1 == 3) || (c2 == 3) || (c3 == 3) || (c4 == 3) || (c5 == 3) || (c6 == 3)) &&
        ((c1 == 2) || (c2 == 2) || (c3 == 2) || (c4 == 2) || (c5 == 2) || (c6 == 2))) {
        matrixFill(tile.fu1, 1, state.possibleMoves);
        matrixFill(tile.fu2, 1, state.possibleMoves);
        state.combinationsRealized[3] = 1;
        isRealized = true;
    }

    //carre
    if ((c1 >= 4) || (c2 >= 4) || (c3 >= 4) || (c4 >= 4) || (c5 >= 4) || (c6 >= 4)) {
        matrixFill(tile.ca1, 1, state.possibleMoves);
        matrixFill(tile.ca2, 1, state.possibleMoves);
        state.combinationsRealized[4] = 1;
        isRealized = true;
    }

    //petit
    let diceSum = state.dice.values.reduce((diceTotal, diceVal) => diceTotal + diceVal, 0);
    if (diceSum < 9) {
        matrixFill(tile.pe1, 1, state.possibleMoves);
        matrixFill(tile.pe2, 1, state.possibleMoves);
        state.combinationsRealized[5] = 1;
        isRealized = true;
    }

    //suite
    if (((c1 == 1) && (c2 == 1) && (c3 == 1) && (c4 == 1) && (c5 == 1) && (c6 == 0)) ||
        ((c1 == 0) && (c2 == 1) && (c3 == 1) && (c4 == 1) && (c5 == 1) && (c6 == 1))) {
        matrixFill(tile.su1, 1, state.possibleMoves);
        matrixFill(tile.su2, 1, state.possibleMoves);
        state.combinationsRealized[6] = 1;
        isRealized = true;
    }

    //yam
    if ((c1 == 5) || (c2 == 5) || (c3 == 5) || (c4 == 5) || (c5 == 5) || (c6 == 5)) {
        matrixFill(tile.yam, 1, state.possibleMoves);
        state.combinationsRealized[7] = 1;
        isRealized = true;
    }

    //sec
    if ((!state.dice.locked.some(Boolean)) && (isRealized == true)) {
        matrixFill(tile.se1, 1, state.possibleMoves);
        matrixFill(tile.se2, 1, state.possibleMoves);
        state.combinationsRealized[1] = 1;
    }

    //appel
    for (let i = 3; i < 8; i++) {
        if (state.called[i] && state.combinationsRealized[i]) {
            state.combinationsRealized[2] = 1;
            matrixFill(tile.ap1, 1, state.possibleMoves);
            matrixFill(tile.ap2, 1, state.possibleMoves);
            break;
        }
    }

    //possibleMoves ready to use
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if(state.table[r][c] !== 0) {
                state.possibleMoves[r][c] = 0;
            }
        }
    }
    //console.log(state.possibleMoves);
}


function countPoints(state) {
    state.players[1].points = 0;
    state.players[2].points = 0;
    let tableArray = state.table.flat();

    //check Horizontal
    for (var y = 0; y < 25; y += 5) {
        for (var x = 0; x < 3; x++) {
            const tris = [tableArray[y + x], tableArray[y + x + 1], tableArray[y + x + 2]].join("");
            if (tris == "111") { state.players[1].points++; }
            if (tris == "222") { state.players[2].points++; }
        }
    }


    //check Vertical 
    for (var x = 0; x < 5; x++) {
        for (var y = 0; y < 25; y += 5) {
            const tris = [tableArray[y + x], tableArray[y + x + 5], tableArray[y + x + 10]].join("");
            if (tris == "111") { state.players[1].points++; }
            if (tris == "222") { state.players[2].points++; }
        }
    }


    //check Diagonal
    for (var x = 0; x < 3; x++) {
        for (var y = 0; y < 15; y += 5) {
            const tris = [tableArray[y + x], tableArray[y + x + 6], tableArray[y + x + 12]].join("");
            if (tris == "111") { state.players[1].points++; }
            if (tris == "222") { state.players[2].points++; }
        }
    }


    //check Diagonal
    for (var x = 2; x < 5; x++) {
        for (var y = 0; y < 15; y += 5) {
            const tris = [tableArray[y + x], tableArray[y + x + 4], tableArray[y + x + 8]].join("");
            if (tris == "111") { state.players[1].points++; }
            if (tris == "222") { state.players[2].points++; }
        }
    }

    //check 5 in a row
    var five = 0;
    //check Horizontal
    for (var i = 0; i < 25; i += 5) {
        five = [tableArray[i + 0], tableArray[i + 1], tableArray[i + 2], tableArray[i + 3], tableArray[i + 4]].join("");
        if (five == "11111") { state.isFive = true; return; }
        if (five == "22222") { state.isFive = true; return; }
    }

    //check Vertical 
    for (var i = 0; i < 25; i++) {
        five = [tableArray[i + 0], tableArray[i + 5], tableArray[i + 10], tableArray[i + 15], tableArray[i + 20]].join("");
        if (five == "11111") { state.isFive = true; return; }
        if (five == "22222") { state.isFive = true; return; }
    }

    //check Diagonal
    five = [tableArray[0], tableArray[6], tableArray[12], tableArray[18], tableArray[24]].join("");
    if (five == "11111") { state.isFive = true; return; }
    if (five == "22222") { state.isFive = true; return; }

    five = [tableArray[4], tableArray[8], tableArray[12], tableArray[16], tableArray[20]].join("");
    if (five == "11111") { state.isFive = true; return; }
    if (five == "22222") { state.isFive = true; return; }
}


function countPieces(state) {
    state.players[1].remainingPieces = 12 - state.table.flat().filter(v => v === 1).length;
    state.players[2].remainingPieces = 12 - state.table.flat().filter(v => v === 2).length;
}