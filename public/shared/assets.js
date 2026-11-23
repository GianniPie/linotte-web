


export const dicePath = "/resources/images/dice/";
export const diceFaces = [
    "traditional_sprite.png",
    "classic_sprite.svg",
    "red_sprite.png",
    "flat_sprite.svg",
    "chinese_sprite.png",
    "persian_sprite.png",
    "candy2_sprite.webp",
    "space_sprite.webp",
    "storm_sprite.svg", // the storm theme's dice (THEME_LOOKS.dice, level.js)
    "spring_sprite.svg", // the spring theme's dice
    "ice3_sprite.webp", // the ice theme's dice (photographs of cubes of ice)
];

// The corner radius of each die's drawing, as a share of its side (measured on the art: the
// outline included). The die on the board and its tile in the options take this radius, so the
// shadow and the yellow selection ring follow the die's own corners instead of one shared curve.
export const diceRadius = [15.5, 19.5, 14, 19.5, 14, 14.1, 19.3, 10.2, 19.5, 19.5, 10.5];

export const dicePos = [
    "0% 0%",
    "16.6667% 0%",
    "33.3333% 0%",
    "50% 0%",
    "66.6667% 0%",
    "83.3333% 0%",
    "100% 0%"
];

export const diceNames = [
    "TRADITIONAL",
    "CLASSIC",
    "RED",
    "FLAT",
    "CHINESE",
    "PERSIAN",
    "CANDY",
    "SPACE",
    "STORM",
    "SPRING",
    "ICE",
];


export const bgPath = "/resources/images/backgrounds/";
export const backgrounds = [
    "confetti-doodles.svg",
    "diamond-sunset.svg",
    "liquid-cheese.svg",
    "tortoise-shell.svg",
    "sun-tornado.svg",
    "pattern-randomized.svg",
    "subtle-prism.svg",
    "parabolic-ellipse.svg",
    "repeating-triangles.svg",
    "storm-clouds.svg",
    "spring-meadow.svg",
    "ice-glacier.svg"
];


// The look of the board (CSS: body.board-<id>); "classic" is the plain one. The others come with a theme (themes.js).
export const boardSkins = ["classic", "storm", "spring", "ice"];
export const boardSkinNames = ["Classic", "Storm", "Spring", "Ice"];

export const piecesPath = "/resources/images/pieces/";
export const pieces =  [
    "p001_ed1c24ff.svg",
    "p002_40b93cff.svg",
    "p003_50ade5ff.svg",
    "p004_e9dc01ff.svg",
    "p005_c240fcff.svg",
    "p006_f14be6ff.svg",
    "p007_e3e3e3ff.svg",
    "p008_ff7106ff.svg",
    "p009_737373ff.svg",
    "p010_ff0606ff.svg",
    "p011_b4aaaaff.svg",
    "p012_e1b27cff.svg",
    "p013_e06a51ff.svg",
    "p014_f7e764ff.svg",
    "p015_5c5cddff.svg",
    "p016_be1500ff.svg",
    "p017_fdc97aff.svg",
    "p018_eb7035ff.svg",
    "p019_bbcd46ff.svg",
    "p020_e9a233ff.svg",
    "p021_f3442eff.svg",
    "p022_a4c037ff.svg",
    "p023_dc5443ff.svg",
    "p024_336483ff.svg",
    "p025_ad8a72ff.svg",
    "p026_d75650ff.svg",
    "p027_babac3ff.svg",
    "p028_c5d4eaff.svg",
    "p029_fd6c92ff.svg",
    "p030_e49c5dff.svg",
    "p031_00a0d7ff.svg",
    "p032_eead46ff.svg",
    "p033_8b59d3ff.svg",
    "p034_8f542bff.svg",
    "p035_40b93cff.svg",
    "p036_ff8f23ff.svg",
    "p037_fcfcfaff.svg",
    "p038_5d6c7cff.svg",
    "p039_f14be6ff.svg",
    "p040_f9e6d2ff.svg",
    "p041_faebaaff.svg",
    "p042_83623bff.svg",
    "p043_aa8967ff.svg",
    "p044_b87cc7ff.svg",
    "p045_f1e9d6ff.svg",
    "p046_3d6df0ff.svg", // the storm theme's umbrella: a theme piece (themePieces), after all the others
    "p047_e63946ff.svg", // the spring theme's ladybird
    "p048_1b1d26ff.svg", // the ice theme's penguin
];
// Pieces that come with a theme (themes.js), not for everyone: piece index -> theme id. They are no profile picture and never
// come out of the random draw (see shared/pieces.js).
export const themePieces = { 45: "storm", 46: "spring", 47: "ice" };
// Profile pictures: for now the pieces themselves, named by their number
// ("p012" is pieces[11]). See public/shared/playerNames.js for the rest of
// the profile.
export const avatarIds = pieces.filter((f, i) => !(i in themePieces)).map((f) => f.slice(0, 4)); // (the theme pieces are the last ones)
export const isAvatar = (id) => typeof id === "string" && avatarIds.includes(id);
export const avatarUrl = (id) => (isAvatar(id) ? piecesPath + pieces[avatarIds.indexOf(id)] : "");

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
