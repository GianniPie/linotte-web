// The themes with their code (the page only: the server reads manifests.js, which has no code in it).
import classic from "./classic/index.js";
import storm from "./storm/index.js";
import spring from "./spring/index.js";
import ice from "./ice/index.js";
import { optionsOf } from "./manifests.js";

const THEME_DEFS = [classic, storm, spring, ice];
const BACKGROUNDS = optionsOf("background");
const codeOf = (kind) => Object.assign({}, ...THEME_DEFS.map((t) => t.code[kind]));
const BACKGROUND_CODE = codeOf("background"), BOARD_CODE = codeOf("board");

/** Background option `index`: what the manifest says of it (`ink`, `title`, ...) and, when it moves, its code (`layers`, `start`). */
export const backgroundOf = (index) => (BACKGROUNDS[index] ? { ...BACKGROUNDS[index], ...BACKGROUND_CODE[index] } : null);
/** The code of the board that has this skin (null: a board that does not move, like the classic one). */
export const boardOf = (skin) => BOARD_CODE[skin] ?? null;
/** Every text colour set a background can ask for (body.ink-<name>). */
export const INKS = [...new Set(BACKGROUNDS.map((b) => b?.ink).filter(Boolean))];
/** What every theme's pieces do now and then, by the piece's file (see core/piece-fx.js). */
export const PIECE_FX = codeOf("piece");
