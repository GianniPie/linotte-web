# Push notifications

A phone that is locked, or an app that was closed, has no connection to the game. The server can still reach it with
a push notification, through Firebase Cloud Messaging (FCM). Today it is sent for one thing:

> A friend tries to come into a **waiting private room** (with the link, the code, or by accepting an invitation) and the
> owner's app does not answer "are you there?" (`Room#hereAck`) or has been away more than 90 s (`HOST_AWAY_MS`).

The owner's phone shows *"Anna wants to play with you. Open Linotte to start the game."*, in the phone's language. A tap
opens the app on the waiting room, which says who tried to come in; the friend, told "we sent them a notification",
tries again. Nothing is sent to a guest, from a browser, or to someone who did not say yes.

## How it fits together

| Piece | Where |
|---|---|
| Decides and sends | `Lobby#joinByCode` → `alertHost` → `server/push.js` (`createPush().notifyJoin`) |
| Device tokens, per account | Supabase table `push_tokens` (`supabase/push_tokens.sql`); in memory when there is no database (local runs) |
| FCM HTTP v1 | `createFcm` in `server/push.js`; the service account's JSON signs a request for an access token (with `jose`, no extra package) |
| App registers / unregisters | socket events `push_register` / `push_unregister` (`server/server.js`), account required |
| App side | `public/push.js` (`@capacitor/push-notifications`), the switch in Options, the question on the waiting sheet |
| Android | `android/app/src/main/AndroidManifest.xml` (permission, small icon, default channel), `res/drawable/ic_stat_linotte.xml` |

What the payload holds: the friend's **display name** in the text, and `data: { type: "join" }`. Nothing else about anybody.
Limits: one push for the same visitor and owner a minute, ten an hour for an account, five devices an account (the newest),
and a message that is no use after five minutes is not kept for a phone that is off (`ttl`).

Opt-in is per account on the device (`linotte-push:<account id>` in the app's storage): asked once on the waiting sheet
("NOTIFY ME", then Android 13+'s own question), changed any time with Options → Notifications. Signing out, or OFF, deletes
the device's token from the server and from Firebase.

## Setup, once

1. **Firebase project.** <https://console.firebase.google.com> → *Add project* (Analytics is not needed).
2. **Android app.** In the project: *Add app → Android*, package name `com.linotte.game` (the one in `capacitor.config.json`).
   A SHA-1 is not needed for push. Download **`google-services.json`** and put it at `android/app/google-services.json`
   (`android/app/build.gradle` already applies the Google services plugin when the file is there; it holds no secret, only
   the project's public identifiers, so it may be committed).
3. **Cloud Messaging.** *Project settings → Cloud Messaging*: **Firebase Cloud Messaging API (V1)** must be *Enabled*
   (it is for new projects). The old "server key" is not used.
4. **Service account.** *Project settings → Service accounts → Generate new private key* → a JSON file. This one *is* a secret:
   never commit it. The default `firebase-adminsdk-…` account has the right role (*Firebase Cloud Messaging API Admin*).
5. **Render.** On the `linotte-web` service, *Environment*: add **`FCM_SERVICE_ACCOUNT`** with the whole JSON (or, easier in a
   one-line field, its base64: `base64 -i key.json | tr -d '\n'`). `render.yaml` lists it (`sync: false`). The server logs
   `push notifications: on (FCM)` at start; without the variable it says `off` and nothing else changes.
   (`SUPABASE_SECRET_KEY` is already there: the token table uses it.)
6. **Supabase.** Run `supabase/push_tokens.sql` in the SQL editor (once).
7. **Rebuild the app.** The installed APK is old:

   ```bash
   npm install
   npx cap sync android        # copies public/ and registers the push plugin (already done in the repo)
   cd android && ./gradlew assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

## Trying it

1. Sign in (an account: guests get nothing). Options → **Notifications → ON**; Android asks to allow notifications: Allow.
2. Friend → Private room: the waiting sheet. Lock the phone (or close the app) and wait a few seconds.
3. From another device or the browser, a friend opens the link / enters the code. The phone rings; the friend sees
   "We sent them a notification". Tap it: the app opens on the waiting room with "Anna tried to join while you were away".
4. Nothing arrives? The server log says `push not sent: FCM answered …` (a wrong service account or project) or
   `push tokens: … (is supabase/push_tokens.sql run?)`. `adb logcat | grep -i -E "fcm|firebase"` shows the phone's side.
   A phone's notification settings for Linotte (and battery "restricted" mode on some makers) can also silence it.

## Later

- **iOS**: add an iOS app in Firebase, upload an APNs key (*Cloud Messaging → Apple app configuration*), add
  `GoogleService-Info.plist`, `npx cap add ios`, and integrate Firebase Messaging as the Capacitor push guide says (otherwise
  iOS gives an APNs token that FCM does not take). The server already sends an `apns` block and stores `platform: "ios"`;
  `public/push.js` is the same.
- Other things worth a push (not done): an invitation to a friend who is offline, a friend request or its acceptance, a
  rematch. Each would be one more `kind` in `pushText` and one more call next to `notifyJoin`.
- A friend who tries to join while the owner is away could be kept waiting, and let in when the owner taps the notification,
  instead of being asked to try again.
- The privacy page must say that a device token is kept with the account and that Google (Firebase) delivers the
  notifications, which means bumping `CONSENT_VERSION` (`server/config.js`, `public/online.js`).
