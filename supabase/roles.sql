-- Who an account is beyond a player (docs/ROLES.md): the roles given by hand.
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor. Safe to run again.
--
-- From the bottom: guest (no account), member (signed in), pro (bought Pro in a store: has the
-- star), then the ones this table gives:
--   tester         all of Pro (no ads, private rooms, own piece, the Pro looks), no star
--   special        the close circle: a tester, plus things nobody else has
--   collaborator   special, plus tools and functions for the people who help
--   admin          the owner: everything, and the powers of control
-- An account without a row here is a member, or a pro if it bought Pro. An account in the older
-- pro_grants table counts as a tester until it has a row here. The game server reads this with the
-- project's secret key; the app can't read or change it (row level security, no policies).

create table if not exists public.account_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('tester', 'special', 'collaborator', 'admin')),
  note text,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

alter table public.account_roles enable row level security;
revoke all on public.account_roles from anon, authenticated;
grant select on public.account_roles to service_role;

-- Whoever was given Pro by hand before becomes a tester, so nothing changes for them except the star.
insert into public.account_roles (user_id, role, note)
select g.user_id, 'tester', coalesce(g.note, 'was in pro_grants')
from public.pro_grants g
on conflict (user_id) do nothing;

-- To give a role (change the e-mail and the role):
--   insert into public.account_roles (user_id, role, note)
--   select id, 'tester', 'why' from auth.users where email = 'someone@example.com'
--   on conflict (user_id) do update set role = excluded.role, note = excluded.note, granted_at = now();
-- To take it away:
--   delete from public.account_roles where user_id = (select id from auth.users where email = 'someone@example.com');
-- The server remembers an account's role for 5 minutes: the change shows by then (or at the next sign-in).
