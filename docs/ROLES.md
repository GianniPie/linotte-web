# Roles: who an account is

From the bottom. Each has everything of the one below.

| Role | Who | Has |
|---|---|---|
| **guest** | no account | the game, with ads; a level on the phone only |
| **member** | signed in | level on the server, friends, ranking, online games; can buy Pro |
| **pro** | bought Pro in a store | Pro's things: no ads, private rooms, own piece, the Pro looks. **The star** |
| **tester** | given Pro's things by hand | all of Pro's things, **no star and not called Pro**; can buy Pro to be Pro |
| **special** | the close circle | a tester, plus things nobody else has (none yet) |
| **collaborator** | the people who help | **Pro** (the star), special, plus tools and functions (none yet) |
| **admin** | the owner only | **Pro** (the star), everything, and the powers of control |

The star is Pro. It is for a purchase and for the collaborators and the admin; a tester or special
account that buys Pro gets it too. The word "Pro" is never written under the badge: the star says it. The
Pro button on the home still says GET PRO without the star (a purchase is what makes an account Pro).

A collaborator must never end up with full control of everything: the admin's powers
(`access.admin`) stay apart from the staff's (`access.staff`), and each new power is given to one or
the other on purpose.

## Where it lives

- Roles above pro are given by hand in `account_roles` (`supabase/roles.sql`, run in the SQL Editor;
  it has the statements to give and take a role). The app can't read or change it.
- An account in the older `pro_grants` table counts as a tester; `roles.sql` copies them into
  `account_roles` as testers.
- A purchase (RevenueCat) is `pro`. If an account has a role above pro, that is its role, and the purchase
  is kept as `access.purchased` (it gives the star to a tester or special account).
- The server, `server/entitlements.js`: `accessFor(account)` gives `{ role, pro, star, special, staff,
  admin }`; `isPro()` is "has Pro's things". The answer is remembered 5 minutes.
- The app asks `/api/me` (and hello/auth) and keeps `pro` (Pro's things: body class `is-pro`) apart from
  `star` (`has-star`: the badge's star and gold frame, the word Pro, the GET PRO button). Opponents see
  `players[].pro` in the game state, which is the star.

## Adding things for a role

- For `special` and up: gate the look or the function with `access.special` (server) and ship the
  answer to the app the way `star` goes (`/api/me`, hello, auth).
- For the staff: `access.staff`. For the owner: `access.admin`.
- Not done yet: any exclusive thing, a screen to give roles (today, SQL), what a collaborator may do.
