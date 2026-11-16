-- What became of each points video (server/videoLog.js): shown, watched, closed... with how
-- long after it was shown. Run once in the Linotte Supabase project: Dashboard > SQL Editor.
-- Written by the game server only (the secret key); players can't read or write it. It goes
-- when the account is deleted.

create table if not exists public.video_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (event in ('shown', 'watched', 'closed', 'claim_failed', 'nothing_waiting', 'skip_nothing_waiting', 'no_answer')),
  ms integer,
  created_at timestamptz not null default now()
);

create index if not exists video_events_user on public.video_events (user_id, created_at);

alter table public.video_events enable row level security;
revoke all on public.video_events from anon, authenticated;
grant all on public.video_events to service_role;
