# Changelog

Every version of Linotte and what changed in it, newest first. The number
shown in the app comes from `public/version.js`.

- **patch** (2.8.0 → 2.8.1): fixes only
- **minor** (2.8.0 → 2.9.0): new features
- **major** (2.8.0 → 3.0.0): big or breaking changes

New work is noted under **Unreleased** as it lands; `npm run release -- patch|minor|major`
then turns it into a numbered, dated version and bumps the number everywhere.

## [Unreleased]

## [2.23.3] - 2026-11-14

### Fixed
- Ranking and Stats are the same kind of island as Options, How to play and the Level road: same border (thin, black at low opacity), same corners (.9em), same background and padding. They had the thicker border and rounder corners of the dialogs' sheet.

## [2.23.2] - 2026-11-14

### Fixed
- The app opens on one clean page. Until the app has run and filled the home in, the page stays hidden (it already was for the languages other than English): before, the first paint showed the SOON tags on ONLINE, FRIEND and the profile, no level badge and no banner, and a moment later all of that changed. The home's level badge is right at once, also after a game (the badge of an account is asked of the server as soon as the game's points count, not when the celebration ends).
- The menu's islands: the first island of every page starts at the same height (the Level road's started 10 px lower and narrower), and the space between two islands is the same everywhere (11 px): the title island of Options and the Level road had a different space to the next one.
- The sign-in sentence is shorter and clearer: "Keep everything you've earned, even on a new phone." (the NOT NOW button already says you can play as a guest).

## [2.23.1] - 2026-11-14

### Changed
- A game's points now come after a video. Right after the board's shake at the end of a game that can earn points (an online game played to the end, or a win against the bot), a video starts by itself, before the winner card (none for Pro: the points come at once). It closes only with its ✕, which asks first ("You won't get the points"). Watched to the end, the card then shows its own confetti and, about 3 seconds later (so the two don't pile up), the stack of points badges and the level bar; closed early, the game is still in the record but earns nothing, for guests and accounts alike. For an account it is enforced by the server: a new column `earns_xp` on `game_results` (run `supabase/game_results_xp.sql` in Supabase BEFORE deploying), written false for a non-Pro player's online game and set true when the app says the video was watched (`claim_points`; the day's first-game bonus comes with it); abandoned games always count (they cost points), and an app that doesn't announce `claims` gets its points at once. The weekly leaderboard counts only games that earn. The video at the next step out is gone for those games.
- Losing a level now buzzes the phone for much longer and more tragically: a heavy blow, then a heart giving out (beats shorter and further apart), only when the sound is on.
- The phone buzzes during a game too (when the sound is on, Android only): a light tick for every hop of the piece along a line, fine ticks that quicken while the trail flies to the points counter, a firm one (two for 8 points or more) the exact moment the number changes, a build-up with the board's shake at the end of the game, a heavy one as the winner popup lands, and ticks while the points advance on the winner card (one heavy one when points are lost). The ticks are firm enough to be felt (a pulse under about 30 ms hardly is), and placing a piece gives a thud.
- In the account sheet (tap your name on the home), tapping the level badge takes you to Your stats.

## [2.23.0] - 2026-11-14

### Changed
- The points celebration is bolder and now a stack: every source of points gets its own gold badge, one below the other as they come, each with its own chime (a tone higher each time, now as loud as the fanfare) and cascade. The badge is bigger, with a spreading ring and a shine (no star: the star means Pro), and the confetti cascade is much fuller: a fountain from under each badge, a cannon at each side and a rain from the top of the screen, all gold and behind the badges. The game's own points ("+2 Victory", "+1 Game played", for a bot win too) now have a badge, before the day's first-game bonus ("+2 Daily bonus") or an ad's point ("+1 Ad reward"). The stack leaves together a moment after the last badge, and a level reached waits for it to be gone. The phone gives a short buzz with each badge's chime and a longer one with the level-up fanfare (when the sound is on; Android only, iOS browsers have no vibration). Developers can replay it by opening the app with `?pointsdemo=1` and tapping.

## [2.22.0] - 2026-11-14

### Added
- The bot lab, a developer tool (`public/botlab.html`, `server/botlab.js`, `public/botlab-client.js`): a page for the computer that shows, live, every turn of the "speed" bot played on a phone, with the list of turns on the left and the board on the right (click a turn to see the board as it was). For each turn: V validates it, ? explains why the bot chose that cell (which rule decided, every legal cell with its signals and rank), and "place the piece" lets you click the cell where it should have gone (the board wears the game's own tile pictures). The header shows the address to open on the phone (the computer's current one on the Wi-Fi, looked up again as the network changes; click to copy). The dice rolled, kept and called are shown too. Those reviews teach the bot: they are turned into weights for the speed placement (`public/shared/botLearning.js`) and the phone plays with them at once; a review the signals can't explain, or that the bot's filters rule out, is reported instead of forced. Off in production unless `BOTLAB_KEY` is set; on the phone it needs the app opened once with `?botlab=1`. Each roll can be reviewed too: click a roll (or press 1, 2, 3; 0 goes back to the piece) and say what the bot should have aimed at, whether it should have called something (or nothing), whether it should have stopped or rolled again, and which dice it should have kept (click the dice, then "teach this keep"); V validates the roll as the bot played it. Those three decisions are learned like the placement (the bot starts from its built-in rules and a correction mostly becomes "here I prefer this combo / this call / stopping"), the phone plays with them at once, and the lab shows what the bot would do now next to what it did. Appel is not a combo you throw, you reach its tiles by calling a combo and landing it, so "going for appel" is: aim at a combo and call that same combo (the "· appel" chip, something the bot never does by itself and the lab can now teach). Choices the bot's own rules rule out are reported, not forced. "Clear history" empties the list of turns. When the bot stops on a roll, the lab still records what it would have called and kept had it rolled again, so you can answer "roll again" and say what to call and keep next. The dice the bot keeps follow from the combo it chases, so a keep is learned as an aim: it works when some combo keeps exactly the dice you picked (several combos may keep the same ones), otherwise the lab reports that it can't learn it.

### Changed
- The daily bonus (+2) goes to the first online game of the day played to the end, whether it is won or lost (it used to need a win), for guests too; whoever leaves a game before its end doesn't get it. The texts that said "first online win" say "first online game" in every language.
- Points earned away from a game (the daily bonus, a rewarded ad) are celebrated by a small gold pill at the top ("+2 Daily bonus", "+1 Ad reward") that drops in with a shine, a few sparkles and a soft chime, instead of a plain message. It is meant to be quieter than reaching a level: no full screen, it goes by itself, and a level reached right after waits for it to finish.

## [2.21.0] - 2026-11-12

### Added
- The phone's back gesture or button closes what is open instead of leaving the app, one layer at a time: a level screen, a sheet (as its BACK / CANCEL / NOT NOW would), then the menu. With nothing open it leaves, as before. (Consent, the game itself and the winner screen are not closed by it.)

### Changed
- The Pro sheet says only what Pro really gives: "See which Pro friends are online and invite them with a tap" (it works between two Pro friends, as the ranking's hint now says too), and the line "Exclusive pieces, dice and backgrounds" is gone (dice and backgrounds are level rewards for everyone; the pieces are covered by "Choose the piece you play with").
- Pro is just the star: the gold frame around a Pro player's level badge is gone, everywhere. The Pro sheet lists the badge line first ("A star on your badge"), then "No ads". In "How levels work" the summary under the title is shorter and correct ("Everyone sees your level. Pro adds a star."), sits close to the title and is set apart from the rules by a line.

### Fixed
- SAME TABLE with FLIP (portrait): the page's <body> is no longer the thing that turns. The game and the panels that belong to the player whose turn it is (menu, winner screen, sheets, messages) turn in place instead, so the banner, fixed to the screen, is never touched by the turn: it no longer disappears mid-turn on phones. The banner is back in the page and under the menus; the menu, turned, now covers the whole screen.

## [2.20.1] - 2026-11-12

### Fixed
- The menu swipe works anywhere on the page, on the sideways-scrolling lists too: there the list scrolls first, and the page only changes when the list was already at its end.
- SAME TABLE with FLIP: the turn is smooth again. Making room for the notch no longer swaps the page's top and bottom padding (which made the content jump as the turn began); the page is moved by the difference of the two insets instead, with nothing to lay out again. The banner is above the turning page (the page's corners swing over its place mid-turn and covered it: the blink) and on its own layer, still under every menu.

## [2.20.0] - 2026-11-12

### Added
- Swipe left or right on the menu to go to the next or the previous page, in the order of the icons in its top bar (the page slides in from the side it came from). It ignores the sideways-scrolling lists (dice, backgrounds, pieces), form fields, short or mostly vertical swipes.

### Changed
- SAME TABLE with FLIP, not Pro: the banner stays exactly where it is, upright, while the game turns (it is outside the page that turns, so it no longer jumps or swings during the turn, and is still under every menu).
- The level road has a discreet "How levels work" link inside its title's island, opening the same modal as the (?) in the stats.
- Your stats opens with the last stats saved on the phone (the same idea as the home) and replaces them with the fresh ones when they arrive; an error then no longer replaces the page with a message.
- The ranking shows grey placeholder lines that shimmer while it loads, instead of the word "Loading...".

## [2.19.2] - 2026-11-12

### Changed
- The home's profile pill and GET PRO (also in the account sheet): 2px taller than the icons beside it (a pill looks smaller than a circle of the same height; the three stay centred on each other), its border is as thick as the options icon's ring, and once you are signed in the "Signed in" text is gone (the badge and the flag are what is under the name).
- Level road: only "You are here" pulses (the next level keeps a still gold frame); the way from "You are here" to the next level is dashed, not solid; and the road takes the colour of your table background (a tint of its average colour for the done part and the dashes) instead of always green.
- The app starts from what the last visit left, then updates from the server: if you were signed in it opens as that account at once (the saved session's user, and the last name, picture, country, level, Pro, and today's bonuses) instead of showing a guest and correcting itself seconds later; your table background is applied before the first paint (no flash of the default one); the server's answer replaces the saved data when it arrives. A server that can't check the account just then no longer clears the saved level, Pro or record, and the account's options are only applied again when they changed on another device. The sign-in library starts downloading with the page.

## [2.19.1] - 2026-11-11

### Changed
- The day for the first-win bonus and the 5 rewarded ads changes at midnight on the player's device, not at UTC's: the app sends its time zone with `/api/me`, `/api/ad-reward` and the game connection, and the server counts the day from it (guests: the device's date). The weekly ranking still runs Monday 00:00 UTC. No SQL change.
- Options: one island per option (Table style, Piece, Dice style, Background, Sound, Language), like the help's sections, under an "Options" heading island.
- Level road: the stops are pastilles in the colour their level's badge gets (bronze from 5, silver from 10...), with a green frame once reached, a gold pulsing one for the next, and the padlock for those still to come.
- The stat tiles (Played, Won, Win rate, Win streak, Best streak, Best score) say what they count in the black message when touched (on the player card only for your own).
- The level badge is the same pastille everywhere, written "Lv N" ("★ Lv N" with a gold frame for Pro) in the tier's colour (`.lv-pill`): on the home, on the player boxes, on the player and account cards, in the Pro sheet, in the level-up and level-down screens (a big pastille instead of a round medal, with "Lv" and the number counting separately), on the level road's stops (pastilles instead of circles) and in the stats and the winner card's points strip.
- On the home, the level badge sits under your name (on the line with the flag and "Signed in"), with the gold frame for Pro.

### Fixed
- Changing the language no longer flashes the game's green background with the combination pills while the page reloads: nothing shows until the options are open again.
- The home in landscape for Pro players is centred: it no longer keeps room for the banner they don't have.
- "No more ads today" no longer shows when the server simply couldn't read today's bonuses: it now says "unknown", the app keeps what it knew (the button stays available) and a tap that can't be counted says "Can't add the point right now. Please try again." instead of "come back tomorrow".
- SAME TABLE with FLIP (portrait): the banner no longer covers ROLL and DONE, and the page no longer runs under the notch. The banner stays at the bottom of the screen, the right way up, and the room the page keeps clear for the notch and the home indicator follows the flip.
- The level on the home (and everywhere it shows) now follows the server's points: they are read again whenever the home shows and when the app comes back to the front, and again as soon as the server says the game just played is saved (a new "recorded" message), so a game's points no longer show up late or not at all. The server keeps each player's connection up to date after a game too (opponents and matching saw the old level), and when it can't read its database it now says "unknown" instead of 0, so the app keeps the level it had instead of dropping to level 0.

## [2.19.0] - 2026-11-10

### Added
- Levels are celebrated. Reaching one opens a full-screen celebration (`showLevelUp`, `public/levels.css`): the badge in its tier's colour spins in with light rays, confetti and a rising fanfare (made on the spot, off with the sound), the new level counted up, every reward it brought -- a background or dice you can put on right there ("USE IT"), a badge colour -- and the next reward; several in a row wait their turn. It replaces the toast. It opens when the points are known: after a game, from an ad, at start-up.
- The winner card shows what the game was worth: "+2", the level and a bar filling toward the next one (a late bonus, the first online win of the day, adds to it); a level reached then opens the celebration after a moment. A lost game against the bot earns nothing and shows nothing.
- The level road (a tab of the menu; also from the account and the celebration): every level that brings something, in order, with what it brings (a picture of each background, dice and badge colour), the ones reached (✓), where you are (your badge, the points, a bar and how many are left) and the next one highlighted with the points to go; it opens on where you are. Levels not reached yet carry a padlock, on the level and on each reward.

### Changed
- The level is visible to everyone, not only Pro: every signed-in player shows it on their box in online games (a guest has none the server can trust; against the bot you show your own); the badge takes its tier's colour. Pro adds a star and a gold frame. The Pro sheet and "How levels work" say so.
- Losing a level (abandoning a game, online or as a guest) shows a "LEVEL DOWN" screen, no confetti but not shy: the badge, in the colour it had, cracks and shakes (with a low thud and a short vibration, a red flush on the screen), the old number drops out and the new one falls in (a single beat, a red ▼N chip for how many levels), the badge sinks pale and sheds bits of its colour; then what is locked again and how many points it takes to get back. CONTINUE or LEVEL ROAD. Shown only when the level goes down (`showLevelDown`); the Chinese font was regenerated for the new texts.
- Ranking, Stats and the Level road are now pages of the app menu, with their icons in its top bar next to Options and Help (a trophy, bars, a winding road with a flag), in the same style; the home's bottom icons are shortcuts that open the menu on that page. They are in the menu in a game too. The level-up's LEVEL ROAD opens the menu on its page, above the winner screen. The Stats page no longer has a RANKING button (the tab is one tap away); the road no longer has its own screen.
- Game, Options and Help use the same look as the new pages: one translucent white card with Changa One headings (no outlined pills) and thin lines between the sections; the combination tiles in Help sit on a dark tile so their white icons still show. The combination videos match: their title, replay and close buttons and the caption box take the same translucent white and low-opacity frame.
- Menu pages, round two: Options and Level road now have a title; the Options section titles no longer change with the selection (Table style, Piece, Dice style, Background, Sound, Language): what is chosen now is a small line under each title; How to play is one card per section on the background, like the level road's cards; the LEVEL ROAD button under the stats is gone (the road is a tab).
- The level badge now says "Lv N" (in the game's player boxes and on the home), and the Pro sheet leads with the gold star and frame, shown as a sample badge on a gold line.
- The account sheet now looks like the player card: your name and country, the level badge with Pro / Free in small under it, the online record, then LEVEL ROAD and the buttons. GET PRO (for free accounts) is the home's gold pill, the same, right under the badge; "Delete account" moved inside EDIT PROFILE (under CANCEL / SAVE), and SIGN OUT asks once more (Sign out? STAY / SIGN OUT).
- The player card leads with the level, as the badge worn in the game (tier colour; Pro adds a star and a gold frame), with just "Pro", "Free" or "Guest" in small under it instead of a big plan pill. It also shows the level of every signed-in player and their online record: games played, won and the share won (`record` in `/api/me` and on each seat; abandoned games count as played, as losses). Guests have none.

### Fixed
- Labels that wrapped or spilled in some languages. Every button and label of every screen (home, sheets, options, consent, game, winner card) was measured in the 6 languages at 3 screen sizes (320x568, 375x812 and 812x375): French "Touchez pour vous connecter" and Spanish "Toca para iniciar sesión" in the profile pill, Portuguese "Melhor sequência", French "Meilleure série" and Italian "Serie migliore" in the stats tiles, and the French sign-in buttons ("SE CONNECTER AVEC …") now fit on one line ("Se connecter", "Iniciar sesión", "Melhor série", "Série max", "Serie max", "CONNEXION AVEC …").

### Changed
- Chat reactions, redone: the new icon set (`public/resources/images/chat/`, one list for the app and the server in `public/shared/chat.js`: ok (the thumb), hahah, wow (the surprised face), mwah (the heart), roll (the dice), grrr, mhhh, nooo (the puppy eyes: a plea or a "why??"), thanks, hey, wait (the hourglass) and the bell). The dial is replaced by a fan like the Dock's stacks: the icons leave the button along a curve, each with a short label that only the sender reads ("hahah", "roll", "wait"...; translated); the receiver sees just the icon tossed to the middle of the screen. The fan's axis tilts as the room needs (diagonal on a phone turned sideways). It opens in about a quarter of a second and closes a little faster.
- The chat button and the fan only exist in online games being played (before, in every game, throwing the icon only for oneself). The button is a round translucent one with a thin bubble icon, beside DONE at the end of the ROLL/DONE row (ROLL and DONE give it room, only in online games): the same place on the opponent's turn too, when the turn label replaces them.
- The bell is a nudge, like MSN's: the board shakes, a trill rings (made on the spot, nothing to download) and the phone buzzes, for the one who rang and the one rung. Limited: one every 10 seconds, 5 a game (the server enforces it).
- Fixed along the way: the scripted player of the smoke tests could lock all five dice and roll again, which the rules now refuse (a test, not the game).

### Changed
- The first-run screen no longer promises that you can change how ads are personalised (there is no such setting yet; the ads are samples): it says "Linotte is free to play, with ads. Linotte Pro removes them." The personalisation choice (Google UMP, asked at first launch where the law requires it, with a button in the options to change it) comes with the real ads. The consent version is unchanged: the new text promises less, so nobody has to accept again.

### Fixed
- Game rules, enforced alike by the app, the bots and the server (`canRoll` / `callBlockedBy` in `public/shared/gameEngine.js`):
  - no ROLL with all five dice locked: ROLL greys out and says to unlock one;
  - no call with all five dice locked, and no Carré call with four locked; a call the locks make impossible is cancelled, and said;
  - a call can change before each roll, never while the dice roll (the app ignores taps mid-roll, the server refuses them).
  The app's own checks for the Carré never fired (it compared an element with a text, and a text index with a number); the server only checked the five-locked call.

## [2.18.0] - 2026-11-09

### Changed
- Testing: `?devpro=0` switches the test Pro off again on that device (`?devpro=1` switched it on for good, until the site's data was cleared).
- The in-game banner shows in landscape too (phones turned sideways, tablets, computers): the board and the rail shrink a little to leave it its place at the bottom, clear of the game.
- "How levels work": every +n and −n is in bold, and the badge colours have their own line (they're a reward too, but not a look you choose).
- Online, one table: each player always rolls their own dice (a style they know how to read), and the background is that of the player with more points -- the exact points, so whoever is nearer the next level wins a tie of levels; with equal points each sees their own. A bought background (none for sale yet) wins over any level; two bought, each their own. Only a background the account has unlocked counts (guests have no points the server can trust: 0). Said once at the start ("… has more points: you play at their table"); back to your own after the game. `tableSeat` in `public/shared/level.js`, the "look" event.
- Matching: a player below zero (who leaves games) only meets others below zero, or the humanized bot, and is told why in the search sheet; everyone else meets players within 10 levels, so looks are seen by many. `canMeet` in `public/shared/level.js`. "How levels work" says both.
- The level scale is 5 times steeper, now that points come faster (wins +2, games played to the end, daily bonus, ads): each level takes 5 points more than the one before up to level 10 (level 1 at 5, 2 at 15, 3 at 30, 10 at 275), then 50 points a level (20 at 775, 30 at 1275). Below zero the same steps: -1 at -5, three abandoned games. A regular player (about 10 points a day) reaches level 1 in the first session or two, level 10 in about a month. "How levels work" says so.
- The "+2" on ONLINE is explained where a game starts: ONLINE's and FRIEND's sheets say "Today's first online win: +2 bonus points." (with the same gift) while the bonus is still to win today.
- Ending a game against the bot or at the same table (END on the paused game, RESTART) says, in green, that no level points are lost.
- Leaving an online game says what it costs: "Your opponent wins, and you lose 2 level points.", or, when the opponent has stopped playing or disconnected, that you can leave without losing points.

## [2.17.0] - 2026-11-09

### Added
- Ads, with sample stand-ins until the networks are connected (`public/ads.js`, `public/ads.css`: one place to swap in AdMob and a web network). The home banner (sized for an adaptive anchored banner, about 60px tall on a phone, which earns more than a fixed 320x50) shows a sample ad from made-up advertisers, labelled "Ad", rotating every 30 seconds; its ✕ opens Pro (remove ads). A full-screen video (15 s, skippable after 5) after every finished game, in any mode: it plays at the player's first step out of the game -- REMATCH, NEW GAME, or HOME / RESTART from the menu -- never over the celebration; not for Pro. Pro players see no banner (its place stays, empty).
- In-game banner: a 50px banner under the game, in portrait, not for Pro. The game leaves it its place (`--ad-h` / `--game-h` in linotte.css: it shrinks a little instead of running under it), at least 10px clear of ROLL/DONE; the chat button and the toasts move up with it. No ✕ on it (it would sit under the chat button); the home banner keeps its own. Under every overlay. Not in landscape, where the board and the rail take the whole height.
- Rewarded ads: in the stats, "Watch an ad: +1 point", up to 5 a day, for everyone, Pro included (it's their choice); the point only comes once the video is watched to the end (closing early asks first). The server adds it to the account (`POST /api/ad-reward`), the phone to a guest's level.
- Daily bonus: the first online win of the day (UTC) is worth +2 extra points. ONLINE wears a gold "+2" tag with a little drawn gift box until it's won; the app says so when it happens (a "bonus" event from the server; on the phone for a guest).
- Level rewards: only the FLAT dice and Linotte's green background (Sun Tornado) are free; every other look is earned. A new background at levels 1, 3, 5, 7, 9, 12, 16 and 20, new dice at 2, 4, 6, 10 and 15, locked with a "🔒 Lv N" tag in the options until then and listed in the order they're earned. The badge turns bronze at level 5, silver at 10, gold at 20, ruby at 30, diamond at 50 (home, in games, stats). Level-ups say what they bring; the stats show the next reward. A saved look that is locked at the current level falls back to the free one; an account's look on a new device is put on once its level is known.
- Ranking section, on the home's Ranking tile (in the Shop's place until the shop opens; also from the stats), with three tabs. This week and All time: online points and bonuses (Monday to Sunday UTC, or since the start), the top 50 with flags, and your own place (`GET /api/leaderboard?range=week|all`); guests are asked to sign in to appear. Friends: the people you've played in a private room, both signed in (an account is the only way to know it's the same person again), with games together and this week's points (`GET /api/friends`, `supabase/friends.sql`).
- Pro friends: when both are Pro, each sees whether the other is online (a green dot; Pro players keep the app connected on the home screen) and PLAY invites them with a tap, no link: the server opens a private room and the friend's app asks "… invites you to play" (PLAY / NOT NOW; busy in a game is a no). Without Pro the friends tab says what Pro adds, with GET PRO. The Pro sheet lists it, and "Exclusive pieces, dice and backgrounds" (art to come).
- "How levels work" lists the daily bonus, the ads and the rewards.

### Database
- New: `supabase/xp_bonuses.sql` (the `xp_bonuses` table and the `weekly_leaderboard` function), then `supabase/friends.sql` (the `friends` table, `note_friends` and `friends_of`). Run both in Supabase, in this order, before publishing.

### Changed
- Levels, made to keep players coming back: every online game played to the end moves the player on. A win is +2, a loss or draw played to the end +1 (abandoned games still −2, bot wins still +1 for every 5). And the steps stop growing at level 10: one point more each up to 10 (level 10 at 55), then 10 points per level (20 at 155, 30 at 255, 50 at 455) instead of ever steeper ones (level 30 was at 465, 50 at 1275). Same for a guest's level on the phone. "How levels work" says so. `public/shared/level.js`.
- Turns last 30 seconds instead of 60, in every mode (the server's backstop clock too; How to play says so).
- Inactive players: a player who lets 3 turns in a row end without a single roll loses the online game as if they had left (−2 level points, `abandoned` in `game_results`); the winner reads "Your opponent stopped playing. You win!". One turn before, both are warned: the inactive player that one more missed turn loses the game and 2 points, the other that they'll win then, or may leave now. Leaving a game whose opponent is idle or disconnected costs nothing (on the server, and for a guest's level on the phone). "How levels work" lists both rules. `IDLE_TURNS_LIMIT` in `server/config.js`.
- Two Pro players who chose the same piece (or two too alike to tell apart on the board): the higher level keeps theirs, a tie is drawn at random. Before, seat 1 always kept it, so in a friend room the host always won. The other plays a clearly different piece that game and is told why, after the coin flip ("Same piece as your opponent: the higher level keeps it..."). `assignPieces` in `public/shared/pieces.js`.
- Stats: the level's explanation moved out of the box into a small, thin (?) next to "Level", which opens "How levels work": a short line under the title (with Pro every opponent sees your level), then every way to earn or lose points, the level steps, below zero, and the guest's level.
- Stats, latest games: a draw (same points, nobody left) says Draw instead of Lost, and the words are singular ("Vinta", not "Vinte" as on the tile).
- Options: Sound and Language moved to the bottom, under the backgrounds; the looks (table, piece, dice, background) come first.

### Fixed
- The winner screen's points stayed at 0 and broke what follows it (since 2.15.0): a local variable named `t` hid the translation function in the points count-up. Early-end messages ("Your opponent left. You win!") were skipped with it.

## [2.16.0] - 2026-11-08

### Changed
- In games, a tap on a player's box opens their card: name, country with its flag, Linotte Pro or the free version, and the level (an opponent's only if they're Pro; your own always). The flag is no longer stuck on the name: the box keeps only the Pro level badge.
- Levels start at 0 (level 1 at 1 point, 2 at 3, 3 at 6, 10 at 55) and can go below zero.
- Leaving an online game before its end (or being gone for good after a disconnection) costs 2 level points. The server marks the game as abandoned in `game_results`.
- A guest has its own level, kept on the phone only: it's never moved to an account (nobody can check it). Signing in starts the account's own level at 0; signing out goes back to the guest's. The guest games moved into the account at sign-in still count in its stats, not in its level. The stats show the level to guests too, with a note.
- The stats explain that leaving an online game costs 2 points.

### Fixed
- `supabase/pro_grants.sql` grants the server (service_role) the right to read the table: without it, a grant was never seen.

### Database
- `game_results` gets two columns, `abandoned` and `from_guest` (see `supabase/game_results.sql`). Run the `alter table` lines in Supabase before publishing.

## [2.15.0] - 2026-11-08

### Changed
- Choosing your piece is now part of Linotte Pro (also listed in the Pro sheet). In the options every piece sits on a tile like the board's, 20% smaller than the tile; "random" is a flat-coloured 3D die. Without Pro the pieces keep their colours and carry a gold "🔒 PRO" tag on their bottom edge, and say "Pro version only" when tapped, and "random" is played (a choice made earlier is kept for if the player becomes Pro again). The server only honours a favourite piece for Pro players.
- The Pro star became a badge with the account's level. Experience points: 1 per online win (random or friend; only games recorded by the server) and 1 for every 5 wins against the bot; draws and losses don't count. Each level takes one point more than the one before (level 2 at 1 point, 5 at 10, 10 at 45; `public/shared/level.js`). Pro players show it gold, with a star, by their name on the home screen and hung on their box in online games, where the opponent sees it. Signed-in players without Pro see their own level on the home screen only; guests have none. It updates after each win, and a toast celebrates every new level. The stats show the level with a bar to the next one and how points are earned. The Pro sheet lists it: "Your level on your badge, seen by every opponent".
- Stats: a guest gets a SIGN IN button under "Saved on this device".
- "Continue your game" has a ✕ in its corner: after asking, it ends the paused game (also one saved by an earlier launch), which doesn't count in the stats. PLAY moved to the card's left, away from the ✕.
- The options icon is on the left on the home screen too, as in games: always in the same place.
- The player's flag is no longer a character in front of the name: on the home screen it comes before "Signed in"; in games it's a little tilted sticker laid over the box just after the name, so the name stays centred (online for both players, against the bot for this phone's player).
- The online bots show a country flag too, about 3 in 10 (from the game's likely countries), and keep it after a server restart or a rematch.
- The "🔒 PRO" tag on the locked pieces is no longer cut in half: the tile itself was clipping it.
- Creating a friend room now needs Pro, as the Pro sheet already said: CREATE ROOM carries the gold "🔒 PRO" tag and opens the Pro sheet (FRIEND itself has no tag: joining is free). Joining a friend's room (link or code) stays free for everyone. One switch, `ROOMS_NEED_PRO` in `public/shared/accounts.js`, drives both the app and the server (it was an environment variable, off).
- The pill at the top right of the home says GET PRO without Pro (gold); with Pro it's a dark brown card with a gold star and PRO.
- The account sheet says whether the account has Linotte Pro or the free version, with its level; the free version gets a GET PRO button.
- How to play ends with a Legal section linking the Terms of Service and the Privacy Policy.
- The options menu's back arrow lined up with the home's options icon only when opened from code: a real tap shrinks the icon while it's measured. Now aligned by centres, exact either way.
- ONLINE's subtitle is just "Random opponent" (no more "free").
- Sign in says, before the buttons, that no new password is needed.
- Pro sheet: "No ads" (no longer "when they arrive").
- Home top bar: the PRO button is now the same height, with the same border, as the profile and the options icon (it was a little taller).
- Changing the language no longer goes through the home screen: the page reloads hidden and comes back on the options, scrolled where it was, already translated. Opening the app in a language other than English no longer shows the English text for a moment.
- Opened from the home screen, the options menu's back arrow sits exactly where the options icon was, same size, and the icon's gear turns into the arrow (and back into the gear on closing). The menu's tabs are centred over the content.
- Chinese: full-width punctuation no longer pushes centred text off centre ("你赢了！" on the winner card, titles, buttons); the rules' paragraphs keep normal spacing.
- The winner card's score ("12 points") is translated.

### Added
- Pro grants: an account listed in Supabase's `pro_grants` table (`supabase/pro_grants.sql`) is Pro without a purchase (the developer's own account, testers, prizes). The server reads it with the secret key; the app can't read or change it.
- Six languages: English, Italian, French, Spanish, Portuguese (Brazil) and Chinese (Simplified). The whole interface (home, sheets, game, options, how to play and its animations, messages) follows the phone's language, and the options have a Language choice. The combination names (Brelan, Full, Carré...) stay the French game's own. The Terms and Privacy Policy stay in English. Translations live in `public/lang/` (one file per language, keyed by the English sentence, only the player's own is loaded), so anything not yet translated shows in English. In Chinese, headings and buttons use Noto Sans SC Black (bundled, cut down to the interface's characters, 60 KB), the nearest in weight to Changa One; Latin letters and digits keep Changa One. The Language choice lists the languages in alphabetical order, in an even grid of three columns. Chinese headings sit centred in their bars and buttons (the Chinese font takes line measurements close to Changa One's) and the font loads at once instead of after a flash of the phone's own.

## [2.14.0] - 2026-11-08

### Fixed
- Opening an old invite link (the game over, the room closed) left the player stuck on an empty board after BACK. It now says the invite has expired, the home stays behind, and closing any sheet with no game running goes back to the home (also after cancelling a waiting room).
- Browsers that darken pages by themselves (Samsung Internet's dark mode for websites, Chrome's auto dark mode) no longer repaint the game: the page declares `color-scheme: only light`.

### Added
- REMATCH on the winner screen, next to NEW GAME: against the bot or at the same table a new game starts at once; online the opponent is asked (the button pulses with "REMATCH?" on their side) and the game starts when both say yes, in the same kind of room. The server's bot usually accepts after a moment. If the opponent went home or left the game, the button disappears.
- An off-line game (vs bot or same table) survives closing the app: it's saved at every turn and "Continue your game" offers it on the next launch, from the start of the turn that was being played.

### Changed
- Fonts (Changa One, Atkinson Hyperlegible) and the confetti library are part of the app instead of loading from Google Fonts and jsDelivr: they work offline and in the store apps, and no outside site sees the player's address. Licences in `public/fonts` and `public/vendor`.
- The offline cache no longer stores anything from other sites.
- Inside the store apps (Capacitor) the offline service worker is not registered: the app's files are already on the phone.
- `node_modules` is no longer kept in the repository (it was listed in .gitignore but tracked); Render installs the libraries itself.

## [2.13.0] - 2026-11-08

### Added
- Linotte Pro, one purchase for life (€3.30), tied to the account: the PRO button on the home screen opens it. It's sold in the store apps (coming soon); on the web the sheet says so, and a player who bought it there signs in to have it here too.
- A gold star by a Pro player's name, on the home screen and in online games (both players see it).
- The game server knows who is Pro from the verified account (RevenueCat, entitlement `pro`), with `/api/me` for the home screen.
- Edit profile (account sheet > EDIT PROFILE): a name of your own (3–12 characters, checked against insults in English and Italian, by the app and again by the server), a picture from the game's pieces, and a country flag. Opponents see the name and flag in online games; without a name you keep the random animal one.
- Favorite piece: a new "Your piece" choice in the options (or random, as before). You play with it offline and online; the opponent always gets a piece that looks clearly different, and when both chose the same one, the first player keeps it.
- Dice, background, board and favorite piece follow the account to every device (saved in the profile; the first sign-in keeps this device's choices).
- Stats (the Stats button on the home screen): games played and won, win rate, win streak and best streak, best and average score, by kind of game (online, friends, vs bot), and the last 10 games. Online games are recorded by the game server (with `SUPABASE_SECRET_KEY`), games against the bot by the app; a guest's stats stay on the device and move to the account at the first sign-in. "Same table" games don't count.
- `supabase/game_results.sql`: one row per finished game of a signed-in player.
- `supabase/profiles.sql`: the profiles table (each player reads and edits only their own; stats are written by the server only).

### Changed
- Creating a private room without Pro (once that rule is switched on) opens the Pro sheet.
- The server no longer trusts a purchase id sent by the app: only the signed-in account counts.
- Privacy Policy: RevenueCat receives the account ID.

## [2.12.0] - 2026-11-07

### Added
- Accounts (optional, with Supabase): sign in with Apple, Google or a code by email from the profile button on the home screen; the account sheet shows who is signed in, signs out and deletes the account for good (as Apple requires). Switched on with the "Linotte" Supabase project (Frankfurt); the sign-in sheet only shows the methods enabled there, and until our own mail service is connected the email carries a sign-in link (no code).
- The game server checks a signed-in player's token and knows their account (the base for Pro and purchases on every device); a signed-in player keeps the same animal name on every phone.
- `supabase/delete_account.sql`: the database function the in-app account deletion uses.

- Sign in with Google is switched on (Google Cloud project "Linotte", published for everyone).

### Changed
- Privacy Policy and Terms cover accounts, and saved games in progress.
- Email sign-in that Supabase refuses (its built-in mailer only writes to the project's team) now says so plainly instead of "Something went wrong".

### Fixed
- The offline cache only keeps fonts and libraries from other sites: it no longer freezes live answers from the sign-in service (which methods are on, who is signed in).

## [2.11.1] - 2026-11-06

### Fixed
- The winner card's headline no longer runs off the card: a long name shrinks to fit, and the longest messages ("Your opponent disconnected. You win!") go onto two balanced lines.

### Changed
- Online players and bots get animal names that can't be mistaken for a person's (Otter, Panda, Badger... instead of Robin, Jay, Raven).
- `render.yaml` describes the server that is actually running (`linotte-web`, Virginia) and puts its game store in the same region; the move to Frankfurt is postponed.

## [2.11.0] - 2026-11-06

### Added
- Online games survive a game server restart (every deploy restarts it): each game is saved in a store (Render Key Value) after every move, and players who reconnect get their game back where it was, dice in the air included. Friend rooms waiting for a guest keep their code.
- The server shuts down cleanly when Render stops it: it saves every game first.
- A player searching for an opponent is put back in the queue by themselves if the connection drops.

### Changed
- `render.yaml` describes a new server in Frankfurt (`linotte-server`) together with its game store (`linotte-kv`), and restarts the server only when the server's own files change.

## [2.10.2] - 2026-11-06

### Added
- A GitHub job pings the game server every 10 minutes, so Render's free plan doesn't put it to sleep and players don't wait a minute for it to wake.

## [2.10.1] - 2026-11-06

### Added
- Online play for everyone: the published site and the store apps talk to the game server on Render (https://linotte-web.onrender.com). Online and Friend are on, without their SOON badge.

### Changed
- The game server switches to production mode by itself on Render and always accepts the published site, with nothing to set in Render's dashboard.

## [2.10.0] - 2026-11-06

### Added
- The online game server can run on Render (render.yaml): free to start, Frankfurt region, redeployed on every release.
- While the game server is starting up (the free plan can sleep), Online and Friend show "Waking up the game server..." and wait up to 75 seconds, instead of giving up after 6.
- Online and Friend switch on by themselves wherever there is a game server to talk to; ?online=1 / ?online=0 still force them on or off on one device.

### Fixed
- Invite links (/j/CODE) work on the published site too; they gave a "not found" page there.

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
