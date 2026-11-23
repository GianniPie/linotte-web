-- The devices that said yes to push notifications (server/push.js): one row per phone, tied to the account that
-- signed in on it. Run once in the Linotte Supabase project: Dashboard > SQL Editor > paste > Run.
-- Written and read by the game server only (the secret key); players can't read or write it. A token belongs to one
-- account at a time (a phone passed to someone else takes it over), and everything goes when the account is deleted.

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  lang text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user on public.push_tokens (user_id, updated_at desc);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
grant all on public.push_tokens to service_role;
