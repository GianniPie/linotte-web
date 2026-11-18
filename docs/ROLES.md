# Roles: who an account is

From the bottom. Each has everything of the one below.

| Role | Who | Has |
|---|---|---|
| **guest** | no account | the game, with ads; a level on the phone only |
| **member** | signed in | level on the server, friends, ranking, online games |
| **pro** | bought Pro in a store | Pro's things: no ads, private rooms, own piece, the Pro looks. **The star** by the name |
| **tester** | given Pro by hand | all of Pro, **no star** (opponents don't see it) |
| **special** | the close circle | a tester, plus things nobody else has (none yet) |
| **collaborator** | the people who help | special, plus tools and functions (none yet) |
| **admin** | the owner only | everything, and the powers of control |

A collaborator must never end up with full control of everything: the admin's powers
(`access.admin`) stay apart from the staff's (`access.staff`), and each new power is given to one or
the other on purpose.

## Where it lives

- Roles above pro are given by hand in `account_roles` (`supabase/roles.sql`, run in the SQL Editor;
  it has the statements to give and take a role). The app can't read or change it.
- An account in the older `pro_grants` table counts as a tester; `roles.sql` copies them into
  `account_roles` as testers.
- A purchase (RevenueCat) is `pro`. If an account has a role above pro, that is its role.
- The server, `server/entitlements.js`: `accessFor(account)` gives `{ role, pro, star, special, staff,
  admin }`; `isPro()` is "has Pro's things". The answer is remembered 5 minutes.
- The app asks `/api/me` (and hello/auth) and keeps `pro` (Pro's things: body class `is-pro`) apart from
  `star` (`has-star`: the badge's star and gold frame). Opponents see `players[].pro` in the game state,
  which is the star.

## Adding things for a role

- For `special` and up: gate the look or the function with `access.special` (server) and ship the
  answer to the app the way `star` goes (`/api/me`, hello, auth).
- For the staff: `access.staff`. For the owner: `access.admin`.
- Not done yet: any exclusive thing, a screen to give roles (today, SQL), what a collaborator may do.
