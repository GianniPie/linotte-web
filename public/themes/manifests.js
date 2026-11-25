// The themes as plain data. Read by the app and by the game server (no page in here).
import classic from "./classic/manifest.js";
import storm from "./storm/manifest.js";
import spring from "./spring/manifest.js";
import ice from "./ice/manifest.js";

const KINDS = ["background", "board", "dice", "piece"];
// the looks a theme brings when it is picked: the first option of each element
// (and its card in the options: the preview of its first background)
const withLooks = (theme) => ({ ...theme, preview: theme.background[0].preview, looks: Object.fromEntries(KINDS.map((kind) => [kind, theme[kind][0].index])) });

/** The main theme: free, with several options of each element. */
export const CLASSIC = withLooks(classic);
/** The themes sold apart, in the order of the options. */
export const THEMES = [storm, spring, ice].map(withLooks);
/** All of them, the main theme first. */
export const ALL_THEMES = [CLASSIC, ...THEMES];
export const themeById = (id) => THEMES.find((t) => t.id === id) || null;

/** Every option of an element across all themes, by its index: `optionsOf("dice")[8]` is the Storm dice. Each carries `theme` (the theme's id). */
export function optionsOf(kind) {
  const list = [];
  for (const theme of ALL_THEMES) for (const option of theme[kind]) list[option.index] = { ...option, theme: theme.id, free: Boolean(theme.free) };
  return list;
}
