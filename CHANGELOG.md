# Changelog

Every version of Linotte and what changed in it, newest first. The number
shown in the app comes from `public/version.js`.

- **patch** (2.8.0 → 2.8.1): fixes only
- **minor** (2.8.0 → 2.9.0): new features
- **major** (2.8.0 → 3.0.0): big or breaking changes

New work is noted under **Unreleased** as it lands; `npm run release -- patch|minor|major`
then turns it into a numbered, dated version and bumps the number everywhere.

## [Unreleased]

## [2.9.1] - 2026-11-05

### Fixed
- Winner screen in landscape: the card's corners have the same roundness as in portrait (they measured the screen instead of the card and came out far too round).
- A new game no longer starts with the dice and combinations half transparent when the previous game ended on the bot's or the online opponent's turn.

## [2.9.0] - 2026-11-05

### Added
- A new home screen: a top bar with the profile (guest for now, with a sign-in panel for Apple and Google), Linotte Pro and settings; the logo; "Continue your game" when a game was left in progress; the four modes as equal buttons (Online, Friend, Vs Bot, Same table) with a line on what each is; shortcuts to How to play, Shop and Stats (the last two marked SOON); and the place for a banner ad at the bottom, which promotes Pro until ads come with the native apps.
- The home can be reached from a game: HOME in the Game tab. An off-line game is kept, paused, and continues from the home; leaving an online game asks first, since the opponent wins.
- The Pro panel (monthly, for life, restore purchases) and the sign-in panel, as graphics: purchases and accounts come with the native apps, and their buttons say so.
- A temporary Stats icon drawn in the style of the menu icons.

### Changed
- Home: ONLINE and FRIEND carry a SOON badge (online play needs a game server, which the published site doesn't have yet), and the four mode buttons have more room under them (about twice the gap between their rows).
- Everything marked SOON on the home (sign-in, Pro, the banner, Online, Friend, Shop, Stats) only shows a short "... is coming soon" message instead of opening a panel that can't do anything yet. For local tests, opening the page once with ?online=1 switches Online and Friend back on for that device (?online=0 turns them off).
- Anyone can create a private room for a friend: it was locked behind Linotte Pro, which can't be bought yet. The PRO labels on Friend and CREATE ROOM are gone, and the Pro offer no longer lists private rooms. The server keeps a switch (ROOMS_NEED_PRO=1) to put it behind Pro again once purchases are live.
- The guest's avatar on the home is a generic buddy (head and shoulders, in the menu icons' style) instead of a red piece.
- Everything shown but not working yet carries a SOON badge: sign-in (the profile and the Apple/Google buttons), Linotte Pro (the PRO button, the banner, and the Monthly, For life and Restore purchases buttons), Shop and Stats. One badge style everywhere, in proportion with what it sits on.
- The home logo is the vector one (favicon.svg), sharp at any size; it was a 192px picture that looked soft on high-resolution screens.
- The 2.7.0 animations are back for selecting a die (0.3s: in, out, settle), lighting a call (0.3s, it swells), placing a piece (0.5s, it pops in with a few bounces) and removing one (0.2s, it swells and fades). 2.8.0 had made them shorter and flatter. The die and call animations no longer stay applied once finished (as they did in 2.7.0), so their edges stay sharp.
- The highlight on the board's free tiles is 10px on a phone, half inside the tile and half outside (it was 11px, mostly outside), growing with the board on larger screens.
- The board's corner tiles curve exactly with the board's frame (their corners were slightly tighter), and so does the highlight on a corner tile.
- RESTART in the Game tab asks "Restart?" before ending the game in progress.
- The combination tiles blur the background behind them, so its shapes don't mix with the symbols.
- Options: the sound section's title says "Sound" or "No sound", following the selected button.
- The dice and background carousels scroll to the current choice again whenever the Options tab opens, and when a new one is picked (only sideways; the page doesn't jump).
- Home: the logo and its title fill the room between the top bar and the modes, centred in it (up to 190px, with the title a quarter of the logo's height); the modes sit just above the banner.
- FLIP waits for the menu: toggling it (or a turn handed over) while the menu is open turns the game only once the menu closes, never the menu under the player's finger. The home screen is never shown upside down.
- Nothing from the game shows over an open menu: the "-1" pieces tick and the "+N" points popup now sit below every menu (they used to float on top when the bot played), and an opponent's thrown emoji waits until the menu is closed.
- The Game tab only holds what belongs to the game in progress: pause, FLIP (same table only), RESTART (same mode, off-line) and HOME. The modes moved to the home screen. Opened from the home, the settings menu shows only Options and How to play.
- Vs Bot asks how the bot plays (POINTS or SPEED) in a panel, like Friend.
- NEW GAME on the winner screen goes back to the home screen instead of reloading the page.
- Landscape home screen: the logo stays square on taller screens (it was stretched to 190x240 on a 1024x768 tablet).
- Every button (ROLL, DONE, home modes, online screens, NEW GAME, chat, the help page's play button, the demos' restart, close and ROLL/DONE) has the same border: black at 50% over the button's own colour, 3px on a phone (4px for ROLL and DONE), growing in proportion with the game, the demos and the winner screen on a tablet. They used to range from 2 to 8px with hand-picked dark colours of different strength.
- The options and back icons are drawn with one line thickness, 13 units like the other menu icons: the back icon's circle was thinner than its arrow, and the options icon's lines were thinner than the menu icons.
- The demos' restart and close buttons are as tall as the title next to them, and their symbols are single shapes with the same line as the border (the arrow's head is part of the arc, so nothing shows darker where they meet), turning counterclockwise.
- In the combination demos, ROLL/DONE's border is in proportion with the demo (a smaller copy of the game), and the demo's board, dice and ROLL/DONE can't be tapped (they used to react to a press).
- Opening or closing a combination demo with a tap no longer leaves a black focus ring around the close button or the play button (the focus still moves into the demo for keyboard users).
- Touching a placed piece makes it wobble like a soft jelly (840ms, from its base) as soon as the finger lands, instead of a small hop when the finger lifts. Placing and removing a piece still happen on release.
- Every button sinks and darkens while it's pressed, also on iPhone, on quick taps, on the help page's buttons and on the taps the demos show.
- DONE is greyed out and does nothing until the turn's first roll (it used to pass the turn without rolling); ROLL is greyed out once the rolls are used up. The consent screen's CONTINUE uses the same greyed-out look. The turn clock running out still ends the turn as before.
- Tablets in portrait show the phone's layout scaled up: board, player boxes, combinations, dice, ROLL/DONE and the countdown all grow by the same factor. Before, the board and the combination strip grew with the width while everything else was held back by the height, so ROLL/DONE were flat, the player boxes squarer, the countdown squashed, borders and corners thinner than on the phone, and DONE touched the bottom edge.
- Tablets and desktops in landscape keep the landscape phone's balance between board and side column (the column about 1.1 to 1.2 times the board): on a 1024x768 tablet the column was the size of a phone's next to a much larger board.
- The player boxes', buttons' and combination tiles' corners, the countdown tiles and the gaps in the combination strip scale with the game instead of being fixed pixels.
- Every line thickness keeps its proportion when its element is scaled: borders of buttons, player boxes, combination tiles and calls, the board's frame and the lines between tiles, the tile highlight, the selection rings, the current player's pulsing glow, the dice shadows, the countdown's split line, the combination tooltip, the winner card's piece frame, the online screens' card and code field, the demos' frame and finger. They keep the phone's values on the phone. The lines between board tiles grow with the board again (2px on a phone, 2.5px on a tablet), instead of staying 2px everywhere.
- The combination demos scale as one piece on tablets: title, restart/close buttons, captions and frame grow with the board instead of staying phone-sized.
- "Before you play" opens with the age requirement (16 or older) and explains it: the game suits any age, but it has ads and online play, and under GDPR younger players may need a parent's consent. The Terms of Service give the same reason. The line about computer-controlled opponents in random games is plain text instead of bold. The Terms of Service still describe it in section 3.

### Fixed
- Online: rolling again after placing a piece now takes the piece back and the dice roll as usual. Before, the app sent the roll before taking the piece back, the server refused the take-back while the dice were rolling, and the screen was redrawn with the piece still on the board and no dice animation (and the piece could stay at the end of the turn). The app now takes the piece back first, and the server accepts a take-back at any time.

## [2.8.1] - 2026-11-04

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
