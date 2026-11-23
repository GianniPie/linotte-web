// Themes: a package of looks sold apart (not earned with levels). Whoever has a theme picks it in the
// options ("Themes") and gets all its looks at once; each look then also appears, as a new item, in its own
// field (Background, Dice style...), where it can be changed on its own, freely.
//
// `looks` says which item of each kind the theme brings: { background, board, dice } hold an option index
// (see assets.js); the kinds a theme does not have yet are left out. Its looks are marked in level.js
// (THEME_LOOKS): they never unlock by level.
export const THEMES = [
  { id: "storm", name: "Storm", preview: "resources/images/backgrounds/storm-clouds-prev.png", looks: { background: 9, board: 1, piece: 45, dice: 8 } },
  { id: "spring", name: "Spring", preview: "resources/images/backgrounds/spring-meadow-prev.png", looks: { background: 10, board: 2, piece: 46, dice: 9 } },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || null;
