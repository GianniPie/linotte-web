// The Ice board: clean frosted tiles in a glacier-blue frame; the ice on the frame is a drawing (frame.svg) laid over it
// by board.css, and little glints twinkle on the tiles now and then.
import { twinkle } from "../../core/effects.js";

let ctx = null;

function glintBoardOnce() {
    const layer = document.querySelector(".board-glint");
    if (!layer) return;
    const count = Math.random() < 0.35 ? 2 : 1;
    for (let n = 0; n < count; n++) {
        const el = document.createElement("i");
        // in the margins of the tiles: near a tile's edge, away from its symbol
        const tx = Math.floor(Math.random() * 5), ty = Math.floor(Math.random() * 5);
        const x = tx * 20 + (Math.random() < 0.5 ? 2 + Math.random() * 3 : 14 + Math.random() * 3), y = ty * 20 + 2 + Math.random() * 14;
        el.style.cssText = `left:${x}%;top:${y}%`;
        layer.append(el);
        twinkle(el, 900 + Math.random() * 700);
    }
}

export default {
    skin: "ice",
    mount(c) {
        ctx = c;
        ctx.layer(ctx.grid, "div", "board-glint");
        ctx.every(900, 3100, glintBoardOnce, { first: 1500 + Math.random() * 2000 });
    },
    unmount() {
        ctx?.stop();
        document.querySelectorAll(".board-glint").forEach((el) => el.remove());
        ctx = null;
    },
};
