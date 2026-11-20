-- A player can change their name once a day.
-- Run once in the Supabase SQL editor (project "Linotte"), BEFORE publishing the app version that shows
-- the wait. Safe to run again. Needs supabase/profiles.sql to have been run.
--
-- The rule lives in the database, so a changed copy of the app can't get round it: choosing the first
-- name is free, and so is the first change after it; after a change the next one has to wait 24 hours.
-- Only a signed-in player's own edits are limited; the SQL editor and the game server's secret key are not
-- (the owner can always rename someone by hand: update public.profiles set name = null where id = '...';).

alter table public.profiles add column if not exists name_changed_at timestamptz;
-- When the game server took the name away after reports (server/reports.js, autoRemoveName): the app uses it
-- to tell the player why they are asked for a new name. Written by the server only.
alter table public.profiles add column if not exists name_removed_at timestamptz;

create or replace function public.limit_name_changes() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.name is distinct from old.name and old.name is not null then
    if old.name_changed_at is not null and old.name_changed_at > now() - interval '1 day' then
      raise exception 'name_changed_recently' using errcode = 'P0001', hint = 'A name can be changed once a day';
    end if;
    new.name_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists limit_name_changes on public.profiles;
create trigger limit_name_changes before update on public.profiles
  for each row execute function public.limit_name_changes();

-- Players read the dates (to see how long to wait, and why their name is gone) but never write them: the grants of profiles.sql don't
-- include these columns; the trigger sets the first and the game server the second.
