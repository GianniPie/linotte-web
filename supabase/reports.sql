-- Reports of players, sent from the opponent's card in an online game (server/reports.js).
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor. Safe to run again.
-- Only the game server writes it (the secret key); the app can't read or change it.
--
-- To read what came in:
--   select r.created_at, r.reason, r.reported_name, r.reported_user, r.reporter, r.room_id
--   from public.reports r where not r.handled order by r.created_at desc;
-- And to mark one as dealt with:
--   update public.reports set handled = true where id = '...';

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter uuid references auth.users (id) on delete set null, -- null: a guest reported
  reporter_player text,                                        -- the device id (guests, and as a trace)
  reported_user uuid references auth.users (id) on delete set null, -- null: the other player was a guest
  reported_player text,
  reported_name text,
  room_id text,
  reason text not null check (reason in ('name', 'emoji', 'other')),
  handled boolean not null default false
);

create index if not exists reports_open_idx on public.reports (created_at desc) where not handled;

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert, update on public.reports to service_role;
