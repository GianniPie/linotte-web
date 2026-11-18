# Friends: the plan

What exists, what was built as a base, what is still to decide, and what comes next.
The server side is in `server/friendships.js` and `server/friends.js`, the data in
`supabase/friendships.sql` (to be run in the SQL Editor), the tests in section 15b of
`server/smoke-test.js`. No screen uses them yet.

## What there was

Two accounts that played a private room became friends by themselves (`friends` table). Only
Pro to Pro: a green dot when the other is online, and PLAY to invite. The list lives in the
Ranking's Friends tab. There was no way to add anyone on purpose, no requests, no blocking, and
nobody knew what the other was doing.

## Finding each other

| Way | How it works | Why |
|---|---|---|
| **Personal code / link** (first) | Every account has a 6-character code (`K7QF3A`) and a link `…/f/K7QF3A`. Whoever opens it and confirms is a friend at once. | The giver already said yes, so no request. Works over WhatsApp, and brings in people who don't have the app yet (it is also how the game spreads). |
| **After a game** | "Add friend" on the online opponent's card and on the winner card. It sends a request. | The best moment: you just played them. Answers "add opponents found online?": yes, as a request they can refuse. |
| ~~Nickname~~ | Not offered. | Nicknames aren't unique, and making them unique is a lot of work for little. |
| ~~Email~~ | Not offered. | Searching by email tells anyone who has an account (privacy, and a store-review problem). |

Safety, needed for the stores as soon as players can reach each other: **block** (the blocked
one is never told, their requests look sent), **remove**, a **limit of 20 requests an hour**,
a maximum of 200 friends. A **report** button is still to add with the screen.

## What happens when you invite

The inviter opens a private room (as today: that is the Pro part) and the friend's app is told.
It depends on what the friend is doing (`presenceOf`, `inviteRule`):

| Friend is… | Inviter sees | Friend sees |
|---|---|---|
| on the home screen (`online`) | "Invite sent" and waits in the room | A window: *Anna invites you to play* · Accept / Not now |
| in a game against the bot or at the same table (`busy`) | the same | A quiet banner over their game. Accept: their game is saved on hold (as when leaving it) and they join. Not now: nothing lost |
| in an online game (`playing`) | "Anna is playing" (nothing is sent) | Nothing: a game that counts is never interrupted |
| offline | "Anna is offline" (nothing is sent) | Later, with push notifications: "Marco invites you to play", valid for a minute |

An invitation lasts **60 seconds**. If nobody takes it, the room closes and both are told
(`invite_expired`). A new invitation withdraws the previous one. If the inviter leaves, it goes.
Declining tells the inviter ("Anna can't play now").

How the app says where it is: `presence_set {state: "home" | "bot" | "table"}`; the server knows
about online games itself. Friends hear `friend_presence {id, state}` when someone connects,
disconnects or changes; the screen asks `friends_list` again every ~20 s to catch the games
starting and ending.

## Notifications

Today the app is a web app: an invitation only arrives while the friend's app is open (the
socket). Real notifications need the native wrapper and a push service (FCM for Android, APNs for
iOS), plus a table of device tokens. The base is ready for it: invitations and requests go
through one place in the server, so sending a push later is one more line there. Until then
the friend list shows requests on the next visit, and the home can show a badge.

## Server events (all need a signed-in account)

`friends_list` · `friend_add_code {code}` · `friend_request {userId}` · `friend_request_opponent` (the opponent of the current game) ·
`friend_respond {userId, accept}` · `friend_remove` · `friend_block` · `friend_unblock` ·
`presence_set {state}` · `friend_invite {friendId}` · `invite_accepted {inviteId}` ·
`invite_declined {inviteId}`. Pushed to the app: `friend_request`, `friend_accepted`,
`friend_presence`, `friend_invite {…, soft, expiresAt}`, `invite_expired`, `invite_declined`.

## Decided

1. **Free or Pro**: the list, presence and receiving invitations are free for everyone. Inviting
   (opening the private room) stays Pro: the invited plays free, Pro or not.
2. **Friends are made on purpose**: a request (accepted by the other) or a code. Playing in a
   private room no longer makes friends by itself; the friends there already were stay.
3. **No search by nickname** (not unique) and none by email.

Still open: notifications (see above): with the native apps, or earlier with web push (works on
Android, on iPhone only for the game added to the home screen).

## Built

The server side and the Friends sheet (home FRIEND button): list with states, requests, add by
code or link, remove, block, invitation window and banner, "Add friend" on the opponent's card.
Open it with `?friendsdemo=1` on localhost to see it with made-up friends.

## Next

1. Run `supabase/friendships.sql` in the SQL Editor.
2. "Add friend" on the winner card too (today only on the opponent's card).
3. A report button, needed by the stores.
4. Push notifications, with the native apps.
