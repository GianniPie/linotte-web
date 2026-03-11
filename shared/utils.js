

//----------- GAME STATE ---------------

export function createInitialGameState() {
  return {
    table: Array.from({ length: 5 }, () => Array(5).fill(0)),
    possibleMoves: Array.from({ length: 5 }, () => Array(5).fill(0)),
    currentPlayer: 1,
    combinationsRealized: [0, 0, 0, 0, 0, 0, 0, 0],
    isFive: false,
    called: [null, null, null, false, false, false, false, false],
    players: {
      1: {
        name: "P1",
        pieceImage: "/public/resources/images/pieces/p001_ed1c24ff.svg",
        color: "#ed1c24",
        points: 0,
        remainingPieces: 12,
      },
      2: {
        name: "P2",
        pieceImage: "/public/resources/images/pieces/p003_50ade5ff.svg",
        color: "#50ade5",
        points: 0,
        remainingPieces: 12,
      }
    },
    dice: {
      values: [0, 0, 0, 0, 0],
      locked: [false, false, false, false, false],
      rollsLeft: 3
    }
  }
}




//----------- UTILITY FUNCIONS ---------------

export const tile = { 
b11 : "00",
b31 : "01",
ap1 : "02",
b41 : "03",
b61 : "04",
b21 : "10",
ca1 : "11",
se1 : "12",
fu1 : "13",
b51 : "14",
pe1 : "20",
fu2 : "21",
yam : "22",
ap2 : "23",
su1 : "24",
b62 : "30",
se2 : "31",
su2 : "32",
pe2 : "33",
b12 : "34",
b32 : "40",
b22 : "41",
ca2 : "42",
b52 : "43",
b42 : "44"
};


export function urlOf(path) {
  return `url('${path}')`;
}


export function rndNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


export function matrixCheck(coordinates, matrix) {
  if (!coordinates) return -1;

  const r = Number(coordinates[0]);
  const c = Number(coordinates[1]);
  return matrix[r][c];
}


export function matrixFill(coordinates, value, matrix) {
  if (!coordinates) return false;

  const r = Number(coordinates[0]);
  const c = Number(coordinates[1]);
  if (r === undefined || isNaN(c)) return false;
  matrix[r][c] = value;
  return true;
}

export function toBoolean(val) {
  return String(val).toLowerCase() === "true";
}


export function preload(url) {
  const img = new Image();
  img.src = url;
}