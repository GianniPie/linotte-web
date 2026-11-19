-- Problem reports sent from the app's "Report a problem" form (server/feedback.js).
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor. Safe to run again.
-- Only the game server writes it (the secret key); the app can't read or change it. The same report also
-- goes by e-mail when RESEND_API_KEY is set on Render; this table is the copy that can't be lost.
--
-- To read the latest:
--   select created_at, user_id, left(message, 120) as message, (screenshot is not null) as has_screenshot
--   from public.feedback order by created_at desc limit 50;
-- The full details of one (device, game, errors): select details from public.feedback where id = '...';
-- Its screenshot is a data URL in the screenshot column: paste it in a browser's address bar to see it.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null, -- null: a guest wrote it
  kind text not null default 'problem' check (kind in ('problem', 'contact')), -- 'contact': a message to the developer
  message text not null,
  details jsonb not null default '{}'::jsonb,
  screenshot text,
  handled boolean not null default false
);

create index if not exists feedback_open_idx on public.feedback (created_at desc) where not handled;

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select, insert, update on public.feedback to service_role;
