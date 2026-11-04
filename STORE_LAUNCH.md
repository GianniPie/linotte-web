# Linotte: from this repo to the App Store and Google Play

What is built, what is not, in the order to do it. Items marked **[you]** need an
account, a key or a legal decision that can't come from the code.

## Built

- Server-authoritative online play (`server/`): rooms, random queue, private
  rooms with 4-letter codes and invite links (`/j/CODE`), reconnect/rejoin,
  server-side dice and move validation, turn clock, forfeit, emoji-only chat.
- Human-like bot that fills the random queue when no one is found
  (`server/humanBot.js`, tuning in `server/humanize.js`). Never used in private rooms.
- Live view: every tap of the active player is relayed and replayed on the
  other screen (`onRemoteAction` / `replayRemote` in `public/linotte.js`).
- First-run consent screen (terms, privacy, 16+, computer-controlled-opponent
  notice), versioned: bump `CONSENT_VERSION` in both `server/config.js` and
  `public/online.js` when the text changes.
- Responsive layout (phone portrait/landscape, tablet, desktop) with safe-area
  insets for notches and home indicators.
- `npm test` plays full games through the real lobby/room/bot with fake sockets.

## 1. Before anything ships

- **[you]** Lawyer review of `public/legal/terms.html` and `privacy.html`
  (drafts, placeholders in `[BRACKETS]`), including the AI-disclosure wording.
  Host them at public URLs; both stores require a privacy-policy URL.
- **[you]** Check that the name "Linotte" and the game's rules are free to use commercially.
- **[you]** Backgrounds (SVGBackgrounds.com, free tier): commercial use is allowed with
  attribution, but the license forbids redistributing the files, and an installed app
  does ship them. Ask SVGBackgrounds about an app, take their subscription or extended
  license, or replace them. For apps, the credit belongs in the store description:
  "Backgrounds by SVGBackgrounds.com" (the help page already credits them too).
- **[you]** Piece designs: find where each one comes from. The notice in the help page
  invites rights holders to get in touch, but it doesn't give the right to use them.
  Put a contact address in `CONTACT_EMAIL` (public/config.js).
- Already fine: confetti (canvas-confetti, ISC), chat emoji (drawn for Linotte, no licence),
  fonts (Changa One and Atkinson Hyperlegible, SIL OFL).
- **[you]** Host the Node server somewhere always-on (Render, Fly.io, Railway).
  Vercel cannot hold WebSockets. Set `ALLOWED_ORIGINS` if the web client is
  served from another domain, `NODE_ENV=production`, and put its URL in
  `public/config.js` (`SERVER_URL`).

## 2. Native shells (Capacitor)

1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
   (node_modules is committed in this repo; consider un-tracking it first).
2. `npx cap init Linotte com.yourco.linotte --web-dir public`, then `npx cap add ios android`.
3. Skip the service worker inside the apps: guard the `serviceWorker.register`
   call in `public/linotte.js` with `!window.Capacitor?.isNativePlatform()`.
4. `SERVER_URL` must be absolute in the native build (no same origin).
5. Icons and splash (`@capacitor/assets`), orientation, status bar, haptics, keep-awake.
6. Deep links so `https://yourdomain/j/CODE` opens the app: Associated Domains
   (iOS) and an App Link `assetlinks.json` (Android), then handle
   `App.addListener("appUrlOpen")` by setting `?join=CODE` logic
   (`autoJoinFromLink`).
7. Test on real devices with TestFlight and Play internal testing early:
   audio, safe areas, background/foreground reconnects.

## 3. Money

- **Pro + cosmetics, RevenueCat** (+ App Store Connect / Play Console products):
  put the RevenueCat app-user id on `window.LinotteNative.appUserId`
  (`public/online.js` already sends it); set `REVENUECAT_SECRET_KEY` on the server.
  Server side is done (`server/entitlements.js`, creating a room needs `pro`).
  Still to build: purchase screen, restore-purchases button, and the cosmetics
  catalog (ids, prices, asset paths; the pieces/dice/backgrounds arrays in
  `public/shared/assets.js` are the seed). Equipped item ids should be sent in
  `hello` and validated against entitlements so the opponent sees them.
- **Ads, AdMob:** interstitial between games only (never mid-game), rewarded
  ad for a temporary skin, banner on the home screen only. Pro removes them.
  Needs Google's consent form (UMP) for the EU and Apple's App Tracking
  Transparency prompt; the first-run screen deliberately does NOT cover ad consent.
- Store listing: age rating (not for kids), data-safety / privacy nutrition labels.

## 4. Not done yet

- Rematch button (the winner button reloads to the home screen).
- Cosmetics shop, purchase screen, ad SDKs, analytics.
- Spectators (the stream supports it; no UI).
- Accounts / Sign in with Apple and Google to carry purchases across devices.
- Redis adapter or another room store if one server instance stops being enough.
