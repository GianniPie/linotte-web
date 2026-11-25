// What the game has to choose from (dice, backgrounds, boards, pieces) is not listed here: it is read from the themes' manifests
// (public/themes/<id>/manifest.js), the main theme's and the others'. An option is known by its `index`, the number saved
// in the player's options and sent to the server. See public/themes/README.md.
import { ALL_THEMES, optionsOf } from "../themes/manifests.js";

const DICE = optionsOf("dice");
const BACKGROUNDS = optionsOf("background");
const BOARDS = optionsOf("board");
const PIECES = optionsOf("piece");

// ----- dice -----
export const diceNames = DICE.map((d) => d.name);
// A die's picture: its theme's folder (public/themes/<id>/dice).
export const diceSrc = (index) => "/" + DICE[index].sprite;
// The corner radius of each die's drawing, as a share of its side (measured on the art: the
// outline included). The die on the board and its tile in the options take this radius, so the
// shadow and the yellow selection ring follow the die's own corners instead of one shared curve.
export const diceRadius = DICE.map((d) => d.radius);

export const dicePos = [
    "0% 0%",
    "16.6667% 0%",
    "33.3333% 0%",
    "50% 0%",
    "66.6667% 0%",
    "83.3333% 0%",
    "100% 0%"
];

// ----- backgrounds -----
export const backgroundCount = BACKGROUNDS.length;
export const bgSrc = (index) => "/" + BACKGROUNDS[index].src;
export const bgTitle = (index) => BACKGROUNDS[index].title;

// ----- boards -----
// The look of the board (CSS: body.board-<id>); "classic" is the plain one.
export const boardSkins = BOARDS.map((b) => b.skin);
export const boardSkinNames = BOARDS.map((b) => b.name);

// ----- pieces -----
export const pieces = PIECES.map((p) => p.file);
// A piece's picture: its theme's folder (public/themes/<id>/piece).
export const pieceSrc = (index) => `/themes/${PIECES[index].theme}/piece/${PIECES[index].file}`;
// Pieces that come with a theme, not for everyone: piece index -> theme id. They are no profile picture and never
// come out of the random draw (see shared/pieces.js).
export const themePieces = Object.fromEntries(PIECES.filter((p) => !p.free).map((p) => [p.index, p.theme]));
// Profile pictures: for now the pieces themselves, named by their number
// ("p012" is pieces[11]). See public/shared/playerNames.js for the rest of
// the profile.
export const avatarIds = pieces.filter((f, i) => !(i in themePieces)).map((f) => f.slice(0, 4)); // (the theme pieces are the last ones)
export const isAvatar = (id) => typeof id === "string" && avatarIds.includes(id);
export const avatarUrl = (id) => (isAvatar(id) ? pieceSrc(avatarIds.indexOf(id)) : "");

// A player who has not chosen a picture gets one of the first eight pieces, always the same for the same
// account (or device, for a guest): the server and the app work it out the same way from the id. The photo
// of a Google or Apple account is never used.
export const DEFAULT_AVATARS = avatarIds.slice(0, 8);
export function defaultAvatar(seed) {
    let h = 2166136261;
    for (const ch of String(seed ?? "")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return DEFAULT_AVATARS[(h >>> 0) % DEFAULT_AVATARS.length];
}
export const avatarOrDefault = (id, seed) => (isAvatar(id) ? id : defaultAvatar(seed));
