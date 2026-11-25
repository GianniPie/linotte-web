// What the app asks of the themes, in one place: show this background, show this board, and tell the board what happens on
// it. The app gives the places that show the background and the table of the game; everything else is the themes' and the
// global rules'.
import { scope, setReduced } from "./theme-core.js";
import { mountBackground, watchOverlays } from "./background.js";
import { backgroundOf, boardOf, INKS } from "../registry.js";
import { reducedMotion } from "./motion.js";

let hosts = () => [document.body];
let table = () => null;
let bgId = null;
let boardSkin = null;
let board = null;       // { def, scope }

/** `backgroundHosts()` gives every place that shows the background; `gameTable()` the table of the game on screen. */
export function initThemeHost({ backgroundHosts, gameTable }) {
    hosts = backgroundHosts;
    table = gameTable;
    watchOverlays();
}

/** The texts follow the background: a dark sky wants light texts on it and a slate ink on the panels (CSS: body.ink-*). */
function paintInk(def) {
    for (const name of INKS) document.body.classList.toggle("ink-" + name, name === def?.ink);
}

export function showBackground(id) {
    bgId = id;
    const def = backgroundOf(id);
    setReduced(reducedMotion());
    paintInk(def);
    mountBackground(def, hosts());
}

function unmountBoard() {
    board?.def.unmount?.();
    board?.scope.stop();
    board = null;
}

/** The board's own moving parts (its water, flowers, glints), from the theme that has this skin ("classic": none). */
export function showBoard(skin) {
    boardSkin = skin;
    unmountBoard();
    const def = boardOf(skin);
    const grid = document.querySelector(".grid");
    if (!def || !grid) return;
    const s = scope();
    board = { def, scope: s };
    def.mount({ grid, table, every: s.every, layer: s.layer, animate: s.animate, stop: s.stop });
}

/** Motion went on or off: the background and the board are mounted again. */
export function remount() {
    showBackground(bgId);
    showBoard(boardSkin);
}

/** A piece landed on this tile / the board was drawn again (what each board does with it is the theme's). */
export const boardPlace = (row, col) => board?.def.onPlace?.(row, col);
export const boardRedraw = () => board?.def.onRedraw?.();
