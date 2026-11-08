-- Player profiles: what a signed-in player can edit (name, picture, country)
-- and the options that follow them to every device (dice, background...).
-- Run once in the Supabase SQL editor (project "Linotte").
--
-- The app reads and writes its own row only (row-level security). The game
-- server reads it with the player's own token to show the name and flag to the
-- opponent, and checks the name again itself (public/shared/playerNames.js):
-- these checks here only keep the data well-formed.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 3-12 letters, digits, spaces, _ . - (accented letters too)
  name text check (name is null or (char_length(name) between 3 and 12 and name ~ '^[[:alnum:] _.-]+$')),
  -- a picture from the game's own gallery: "p001".."p999"
  avatar text check (avatar is null or avatar ~ '^p[0-9]{3}$'),
  -- ISO 3166 country code, e.g. "IT"
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  -- options that follow the player: { dice, background, board, piece, sound, flip }
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) < 2048),
  -- games played and won, written by the game server only (see below)
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- New tables aren't exposed automatically in this project: say exactly what
-- the app may touch. Players can't write their own stats.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, avatar, country, prefs, updated_at) on public.profiles to authenticated;
grant update (name, avatar, country, prefs, updated_at) on public.profiles to authenticated;
grant all on public.profiles to service_role;
