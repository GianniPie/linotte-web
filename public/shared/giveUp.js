// Whether a player can still win a game: used to offer "Give up" against the bot only when it is
// a matter of the board, not of the dice.
//
// A game is won on points, and a point is a line of 3 in a row of one player's pieces (the five in a
// row only ends the game; it wins nothing by itself). Pieces never come off the board, so a player's
// points can only grow. So player A can no longer win when, with A's pieces left on the empty cells
// in the best way there is, A still can't pass the points B already has. Nothing here depends on
// what is rolled or on what B does next.

// The 48 lines of 3 (rows, columns, both diagonals) as cell indexes 0..24.
const TRIPLES = [];
for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
        for (const [dy, dx] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
            const cells = [];
            for (let k = 0; k < 3; k++) {
                const yy = y + dy * k, xx = x + dx * k;
                if (yy < 0 || yy > 4 || xx < 0 || xx > 4) { cells.length = 0; break; }
                cells.push(yy * 5 + xx);
            }
            if (cells.length === 3) TRIPLES.push(cells);
        }
    }
}

const bitCount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };

// Can `seat` (1 or 2) still reach `target` points, with `piecesLeft` pieces to put on the empty cells?
// `table` is the 5x5 board: 0 empty, 1 and 2 the players' pieces.
export function canReachPoints(table, seat, target, piecesLeft) {
    const flat = table.flat();
    const other = seat === 1 ? 2 : 1;
    let done = 0;
    const open = []; // for each line still possible: the empty cells it needs, as a bit mask
    for (const line of TRIPLES) {
        if (line.some((c) => flat[c] === other)) continue; // blocked for good
        let need = 0;
        for (const c of line) if (flat[c] === 0) need |= 1 << c;
        if (need === 0) done++;
        else if (bitCount(need) <= piecesLeft) open.push(need);
    }
    if (done >= target) return true;
    const missing = target - done;
    // Pick `missing` of the open lines whose empty cells together fit in the pieces left.
    const search = (from, picked, cells) => {
        if (picked >= missing) return true;
        if (picked + (open.length - from) < missing) return false;
        for (let i = from; i < open.length; i++) {
            const joined = cells | open[i];
            if (bitCount(joined) <= piecesLeft && search(i + 1, picked + 1, joined)) return true;
        }
        return false;
    };
    return search(0, 0, 0);
}

// True when `seat` can no longer win this game (a draw may still be possible).
export function cannotWin(state, seat) {
    const other = seat === 1 ? 2 : 1;
    return !canReachPoints(state.table, seat, state.players[other].points + 1, state.players[seat].remainingPieces);
}
