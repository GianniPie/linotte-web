// Themes: a package of looks sold apart (not earned with levels). Whoever has a theme picks it in the options
// ("Themes") and gets all its looks at once; each look then also appears, as a new item, in its own field
// (Background, Dice style...), where it can be changed on its own, freely.
//
// The themes live in public/themes (see the README there); this file only keeps the import path the app and
// the server have always used. Its looks are marked in level.js (THEME_LOOKS): they never unlock by level.
export { THEMES, themeById } from "../themes/manifests.js";
