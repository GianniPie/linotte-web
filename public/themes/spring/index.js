// The spring theme, wired: the manifest (plain data) and the code of its moving parts, by the option they belong to (the
// background by its index, the board by its skin, the piece by its file). What the app asks of each element: ../README.md.
import manifest from "./manifest.js";
import background from "./background/index.js";
import board from "./board/index.js";
import piece from "./piece/index.js";

export default {
  ...manifest,
  code: {
    background: { [manifest.background[0].index]: background },
    board: { [manifest.board[0].skin]: board },
    piece: { [manifest.piece[0].file]: { dir: "themes/spring/piece/", ...piece.fx } },
  },
};
