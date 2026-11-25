# Themes

A theme is a **package** of four finished elements, each in its own folder with everything that belongs to it
(drawings, previews, CSS, code, the script that makes a drawing if there is one):

```
public/themes/
  README.md            this file: the rules
  core/                what is the same for every theme (the global rules, the helpers the elements use)
    theme-core.js        state of the screen (flipping, covered, reduced), timers and layers for the elements
    core.css             the rules written in CSS (what hides, pauses or fades while the table turns, ...)
  registry.js          the list of the themes, with their code (browser only)
  manifests.js         the list of the themes, as plain data (the server reads it too: no DOM in there)
  <id>/                one folder per theme: classic (the main one, free), storm, spring, ice
    manifest.js          plain data: the theme's options for each element (each with its index, drawings, name, level that opens it)
    index.js             the manifest plus the code of what moves, by the option it belongs to
    background/          the sky: drawings, background.css, index.js (what moves on it)
    board/               the board: drawings, board.css, index.js (what moves on it)
    dice/                the dice: sprite and their look
    piece/               the pieces of the theme and their animation
```

The app handles all themes the same way; it only knows the four elements. Anything that changes for every
theme is changed in `core/`; the fine tuning of one element is changed in that element's folder.

## The four elements

Each element lives in its own folder, with its drawings, its CSS and (when it moves) its `index.js`. What the app asks of
it is a small plain object; what the theme only says (file names, option indexes, the dice's corner) is in `manifest.js`.

| element | folder | what the app asks of it |
|---|---|---|
| **background** | `background/` | `ink` (the text colour set, CSS `body.ink-<id>`), `layers` (the moving layers over the still picture, bottom to top, classes whose CSS is in `background.css`), `start(ctx)` (what is played now and then on it; `ctx.every(min, max, fn)`), `stop()`. The still picture is `background.svg`, its preview `preview.png` |
| **board** | `board/` | `skin` (the board's name, CSS `body.board-<id>`), `mount(ctx)` (builds its layers over the tiles: `ctx.grid`, `ctx.layer()`, `ctx.every()`, `ctx.table()`), `unmount()`, `onPlace(row, col)` (a piece landed), `onRedraw()` (the board was drawn again). Its CSS is `board.css` |
| **dice** | `dice/` | `sprite` (the picture of the faces), `preview`, `radius` (the corner, in % of the side), all in `manifest.js`; `dice.css` for what the dice change around them (the Ice shadow) |
| **piece** | `piece/` | `file` (the drawing of the theme's piece, in this folder), `fx` (what it does now and then: `layers`, `every` seconds, `play(layers)`). Its CSS is `piece.css` |

## The ink

A background says how the game's own colours (texts, panels, the symbols of the combinations) read over it: a dark sky wants
light texts, a pale one dark texts. That is its **ink**: a block `body.ink-<id>` in its `background.css`, switched on when
the background is chosen. The ink belongs to each background, not to the theme: the main theme has nine backgrounds and nine
blocks (`ink-classic-sun-tornado`...), because a pale one and a dark one do not read the same. **Every theme declares all of these, even the ones it leaves as the default** (the defaults are the
main theme's), so the day one changes nothing has to be remembered:

| variable | what it colours |
|---|---|
| `--ink` | the text on the panels |
| `--ink-bg` | the text written straight on the background (titles, names) |
| `--ink-bg-soft` | the same, a little fainter |
| `--ink-bg-shadow` | the shadow under that text |
| `--zone-bg` | the fill of the boxes of the combinations and the calls |
| `--zone-border` | their border |
| `--result-on` | the fill of a combination the dice make |
| `--result-icon` | the symbols of the combinations (one drawing for all, cut out by a mask) |
| `--result-icon-on` | the symbol of the combination the dice make |
| `--call-on-border` | the border of a call that lights up |

## The global rules (they live in `core/`, an element does not repeat them)

1. **Moving parts are layers marked `data-fx`.** Whatever moves by itself (a layer, a drop, a glint, a flipper) is
   inside an element that `ctx.layer()` made, so the rules below reach it without the element knowing.
2. **Everything that happens now and then goes through `ctx.every()`.** A timer made that way fires only when
   the screen is visible, the effects are on (the switch, the battery, the phone's "reduce motion"), the game is
   not under the home or the options, and the table is not turning. It never runs between two movements.
3. **While the table turns** (`body.flipping`) every `data-fx` layer is hidden and fades back in after the turn; the
   glow under the player on turn and the DONE/ROLL nudge wait. The still sky and the board turn as they always did.
   What turns at the table is decided here, not by the theme: the sky steps over in one go half way through the
   turn, the tile symbols turn smoothly with the page, the board and its frame never turn.
4. **Effects off** (`body.fx-off`): `ctx.every()` never fires and the CSS animations stop; the still drawings stay.
5. **One copy of the sky is drawn**: the one on top (`.bg-fx.live`).
6. **Only transform and opacity** are animated. Layers are small, and promoted (`will-change`) only for the length
   of a movement, never idle.
7. **Previews are 205 x 205 with a rounded corner of 14.4% (backgrounds) or the board's radius (boards).**

## The main theme is a theme like the others

`classic/` has the same four folders: nine backgrounds, eight dice, the plain board and the 45 plain pieces. The only
differences are in its manifest: it is `free: true`, it has several options for each element (the others, one for now), and
some options say which level opens them (`unlock`) and which one a new player has (`default`). Everything the app and the
server share (the names of the dice, the unlock levels, which look belongs to which theme, the files) is built from the
manifests in `shared/assets.js` and `shared/level.js`: nothing is listed twice. An option is known by its `index`, the
number saved in the player's options and sent to the server: never change it.

## Adding a theme

1. Make the folder `public/themes/<id>/` with the four elements (copy an existing theme).
2. Add its `manifest.js` to `manifests.js` and its `index.js` to `registry.js`.
3. Give each option its `index` in `manifest.js` (a new number, after the last one), and add its files to `sw.js`'s list.

## Where things are

Everything of a theme is in its folder (the first line of each folder is the one to read):

- `classic/`, `storm/`, `spring/`, `ice/`: background, board, dice, piece, all moved. The Ice pictures are made by
  `ice/background/make-ice.py` (change the script, run it, never edit the numbers in the pictures).
- `core/theme-core.js`: the state (reduced, covered, flipping), `scope()` (timers, layers, animations), `startFlip()`.
- `core/motion.js`: whether things may move at all (the player's switch, a low battery, the phone's "reduce motion").
- `core/theme-host.js`: what the app asks of the themes (show this background, show this board, a piece landed).
- `core/background.js`: mounts a background's layers on every place that shows it, keeps one copy drawn.
- `core/piece-fx.js`: the engine of the pieces' movements.
- `core/effects.js`: small movements shared by several themes (`twinkle`).
- `core/core.css`: the global rules written in CSS (what hides, pauses and fades while the table turns, what turns and how).

What is still outside, on purpose: the lists of option indexes the server shares (`shared/assets.js`, `shared/level.js`) read
the manifests; the options screen (`index.html`, `linotte.js`) picks a theme and hands its elements to the core.
