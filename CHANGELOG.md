# Changelog

Every version of Linotte and what changed in it, newest first. The number
shown in the app comes from `public/version.js`.

- **patch** (2.8.0 → 2.8.1): fixes only
- **minor** (2.8.0 → 2.9.0): new features
- **major** (2.8.0 → 3.0.0): big or breaking changes

New work is noted under **Unreleased** as it lands; `npm run release -- patch|minor|major`
then turns it into a numbered, dated version and bumps the number everywhere.

## [Unreleased]

### Fixed
- Landscape: the side column is the phone's column at the same size relative to the board (it had grown oversized and didn't fit with the browser bars), with square combination tiles, unsquashed player boxes, the four rows (players, combinations, dice, ROLL/DONE) at one width on one centre line, and rows lined up with the top and bottom of the board.
- Landscape: no more zoomed-in page after rotating the phone (the height is re-measured once the rotation settles, and the page can't be auto-zoomed or double-tap zoomed).
- The lines between board tiles are as thin on tablets and desktops as on phones (they had grown to 8 and 12 px).
- Landscape home screen: the four mode buttons are the same size with every label on one line ("SAME TABLE" used to wrap and grow taller), the buttons are larger, and the logo is bigger.
- Landscape, same table with FLIP: the board stays exactly where it is; only the game column (players, combinations, dice, ROLL/DONE), the options panel and the winner screen turn upside down, in place. Before, the whole page turned and the board jumped to the other side.
- Landscape: the player boxes, combinations and dice are about 20% larger, using some of the space between the rows; ROLL/DONE keep their size. The combination tiles are square again.
- Landscape: the yellow "+N" points popup is sized off the game column (it was more than twice its portrait size), and the call pills keep their portrait proportions.
- Winner screen: the card scales as one piece, so on every screen and after rotating it keeps the portrait phone's layout (back arrow in the corner, piece, title, points, NEW GAME). Before, its parts had fixed pixel sizes and offsets and drifted apart or off the card in landscape and on tablets. It stops growing at 480px.
- Winner screen: tapping the dimmed backdrop throws confetti too, not only the card.
- Landscape winner screen: the confetti is aimed further toward the middle instead of nearly straight up along the edges.

## [2.8.0] - 2026-11-04

### Added
- Online play: a server that runs the game (dice, rules, turn clock), random opponents, private rooms for friends with a 4-letter code or a link, reconnecting to a game after a drop, and forfeit when a player leaves.
- Every tap of the player whose turn it is now plays live on the opponent's screen.
- A bot that fills random games when nobody else is online, with human pacing, small mistakes and emoji replies.
- First-run consent screen (terms, privacy, age, notice about computer-controlled opponents) and draft legal pages.
- Help page: short animated demos of every combination, played with the game's own board, dice and buttons.
- Help page: credits (confetti, backgrounds, emoji, font) and a notice about piece designs.
- Version tracking: this changelog and `npm run release`.

### Changed
- Help page rewritten and restyled to match the rest of the options menu.
- Landscape layout: the side column fills the board's height, ROLL/DONE sit where the right thumb is, touch targets are at least 44 px.
- Tap feedback (dice, buttons, calls, pieces) is shorter and quieter: 150 ms.
- Layout scales properly on tablets and desktops; safe areas for notches and home indicators.
- Chat emoji redrawn for Linotte: flat colours with a solid outline like the coin and buttons, built into the app (no download, work offline, no licence to credit).
- Carré demo uses 2s instead of 4s, so "four of a kind" isn't confused with the dice value.
- Appel demo: the call is Full, the second roll makes a Carré (Appel stays off), the third makes the Full (Appel lights up).
- Demo captions can be scrolled by hand to reread, with room above the first line so it is clear of the top fade; a new line only scrolls the box when you are already at the bottom.
- Help page: rules, demo captions and credits use Atkinson Hyperlegible, a typeface designed for legibility, slightly larger and on a slightly more opaque background.
- Help page: credits sit further apart from the rules.

### Fixed
- Uneven, blurry borders on buttons and dice (especially on iPhone and iPad).
- Tile highlights and dice selection rings looked thin and square on tablets.
- The options menu could not be reopened after tapping outside it.
- The tab indicator stayed under the wrong tab after rotating the screen.
- Since 2.7.0 (already committed): animations finish before the turn passes or the page flips; tap a placed piece to make it bounce; end-game shake and line sweep; same-table polish; service worker no longer pins old app code.
- Help page credits spell the developer's name GianniPie.

### Removed
- An old, unused confetti script.
- Twemoji: the chat emoji are now drawn for Linotte (see Changed).

## [2.7.0] - 2026-10-13

### Added
- Pause, same-table FLIP and a reworked options menu.

## Earlier

2.6.1 and 2.6.0 (2026-08-12), 2.5.8 (2026-08-12), 1.77 to 1.83 (2026-07-11 to 2026-08-11): see the git history.
