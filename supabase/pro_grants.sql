-- Linotte Pro given by hand, without a store purchase: the developer's own
-- account, testers, prizes, refunds handled outside the store. The game
-- server (server/entitlements.js) reads it with the project's secret key;
-- the app can't read or change it (row level security, no policies).
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor.
--
-- To give Pro to an account:
--   insert into public.pro_grants (user_id, note)
--   select id, 'why' from auth.users where email = 'someone@example.com';
-- To take it back: delete from public.pro_grants where user_id = '...';

create table if not exists public.pro_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  granted_at timestamptz not null default now()
);

alter table public.pro_grants enable row level security;

revoke all on public.pro_grants from anon, authenticated;
-- The server reads it with the secret key (service_role); this project gives
-- that role no rights on new tables by itself.
grant select on public.pro_grants to service_role;
