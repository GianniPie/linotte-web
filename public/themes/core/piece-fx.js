// The pieces of the themes come alive. Each piece starts the moment it is put on the board (its drawing is set): a few seconds
// later it moves for the first time, then rarely (a movement every 15 to 30 seconds), at a pace a little different from the
// next, so they never move together. Their moving parts are layers of their own over (or instead of) the piece's drawing.
// Nothing runs between two movements: a timer starts a short animation of the layers (transform, opacity: the GPU's), and
// that is all. The still drawing stays as the piece's background-image, for everything else that reads it.
// What each piece does is in its theme's folder (themes/<id>/piece); when it may move is global (theme-core.js): a movement
// in progress when the table turns rests where it ends (data-fx-live).
import { motionAllowed, isReduced } from "./theme-core.js";

let table = {};          // piece file -> { dir, every, over, layers: [[class, file]], play(layers) }
let findPieces = () => [];
let observer = null;

function sync(piece) {
    const url = piece.style.backgroundImage || "";
    const file = Object.keys(table).find((f) => url.includes(f));
    if (piece.dataset.pieceFx === (file || "")) return; // already as it should be (the observer fires for every change of the style)
    clearTimeout(piece.fxTimer);
    piece.querySelectorAll(":scope > .pfx").forEach((el) => el.remove());
    piece.classList.remove("pfx-on");
    delete piece.dataset.pieceFx;
    if (!file || isReduced()) return;
    const fx = table[file];
    piece.dataset.pieceFx = file;
    if (!fx.over) piece.classList.add("pfx-on"); // the layers draw the whole piece: its own drawing steps aside
    for (const [cls, img] of fx.layers) {
        const layer = document.createElement("i");
        layer.className = "pfx " + cls;
        layer.dataset.fxLive = "";
        layer.style.backgroundImage = `url("/${fx.dir}${img}")`;
        piece.append(layer);
    }
    const tick = () => {
        if (!piece.isConnected || piece.dataset.pieceFx !== file) return;
        if (motionAllowed()) fx.play([...piece.querySelectorAll(":scope > .pfx")]);
        piece.fxTimer = setTimeout(tick, fx.every * (0.85 + Math.random() * 0.3) * 1000);
    };
    piece.fxTimer = setTimeout(tick, (5 + Math.random() * 9) * 1000); // the first movement comes a few seconds after the piece lands
}

/** Starts watching the pieces: `pieceFx` is the table of every theme's pieces, `pieces()` finds the pieces on the board. */
export function watchPieces(pieceFx, pieces) {
    table = pieceFx;
    findPieces = pieces;
    observer = new MutationObserver((list) => { for (const m of list) sync(m.target); });
    pieces().forEach((piece) => observer.observe(piece, { attributes: true, attributeFilter: ["style"] }));
}

/** The effects were switched on or off: every piece is set again. */
export function resyncPieces() {
    findPieces().forEach((piece) => { delete piece.dataset.pieceFx; clearTimeout(piece.fxTimer); sync(piece); });
}
