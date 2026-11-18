-- Friends you choose: requests, accepting, removing, blocking, a personal friend code.
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor, after friends.sql
-- (it extends that table) and xp_bonuses.sql. Safe to run again.
--
-- The friends table keeps one row each way for a pair (user_id -> friend_id), as before:
--   accepted  both rows 'accepted': they are friends (what friends.sql already made of two
--             accounts that played a private room, so every old row stays a friend).
--   pending   both rows 'pending', requested_by says who asked: the other one sees a request.
--   blocked   one row (blocker -> blocked) and nothing the other way: the blocked account
--             cannot ask again and never learns it was blocked.
-- Only the game server writes here (the secret key); the app asks the server.

alter table public.friends
  add column if not exists status text not null default 'accepted' check (status in ('pending', 'accepted', 'blocked')),
  add column if not exists requested_by uuid references auth.users (id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

create index if not exists friends_friend_idx on public.friends (friend_id);

-- A short code of one's own to share (as a link or typed in): 6 characters, no 0/O/1/I.
create table if not exists public.friend_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[2-9A-HJ-NP-Z]{6}$')
);
alter table public.friend_codes enable row level security;
revoke all on public.friend_codes from anon, authenticated;
grant all on public.friend_codes to service_role;

create or replace function public.friend_code_of(uid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  found text;
  candidate text;
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  select code into found from public.friend_codes where user_id = uid;
  if found is not null then return found; end if;
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.friend_codes (user_id, code) values (uid, candidate);
      return candidate;
    exception when unique_violation then
      select code into found from public.friend_codes where user_id = uid;
      if found is not null then return found; end if; -- someone else just made it for this account
    end;
  end loop;
end;
$$;

create or replace function public.user_by_friend_code(c text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.friend_codes where code = upper(c);
$$;

-- Whose code it is, to ask "add Anna?" before it makes friends (the code is only a name for the
-- account: nothing else about it is told).
create or replace function public.friend_code_owner(c text)
returns table (user_id uuid, name text, country text)
language sql
stable
security definer
set search_path = ''
as $$
  select k.user_id, p.name, p.country
  from public.friend_codes k left join public.profiles p on p.id = k.user_id
  where k.code = upper(c);
$$;

-- `a` asks `b` to be friends. Answers:
--   'self', 'blocked' (b blocked a, or a blocked b), 'full' (a or b has 200 friends),
--   'already' (they are friends), 'sent' (a request is now waiting for b),
--   'waiting' (a had already asked), 'accepted' (b had asked a: now friends, or `auto` was set:
--   a link or code from b's own hand is consent enough).
create or replace function public.friend_request(a uuid, b uuid, auto boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine public.friends;
  theirs public.friends;
begin
  if a = b then return 'self'; end if;
  select * into mine from public.friends where user_id = a and friend_id = b;
  select * into theirs from public.friends where user_id = b and friend_id = a;
  if mine.status = 'blocked' or theirs.status = 'blocked' then return 'blocked'; end if;
  if mine.status = 'accepted' then return 'already'; end if;
  if mine.status = 'pending' and mine.requested_by = a and not auto then return 'waiting'; end if;
  if (select count(*) from public.friends where user_id = a and status = 'accepted') >= 200
     or (select count(*) from public.friends where user_id = b and status = 'accepted') >= 200 then
    return 'full';
  end if;
  if auto or (mine.status = 'pending' and mine.requested_by = b) then
    insert into public.friends (user_id, friend_id, status, requested_by, games, last_played)
      values (a, b, 'accepted', coalesce(mine.requested_by, a), coalesce(mine.games, 0), now()),
             (b, a, 'accepted', coalesce(mine.requested_by, a), coalesce(theirs.games, mine.games, 0), now())
    on conflict (user_id, friend_id) do update set status = 'accepted', last_played = now();
    return 'accepted';
  end if;
  insert into public.friends (user_id, friend_id, status, requested_by, games)
    values (a, b, 'pending', a, coalesce(mine.games, 0)), (b, a, 'pending', a, coalesce(theirs.games, mine.games, 0))
  on conflict (user_id, friend_id) do update set status = 'pending', requested_by = a;
  return 'sent';
end;
$$;

-- `me` answers the request `other` sent: accept (friends now) or decline (the request goes away,
-- and `other` may ask again later).
create or replace function public.friend_respond(me uuid, other uuid, accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.friends where user_id = me and friend_id = other
                 and status = 'pending' and requested_by = other) then
    return 'none';
  end if;
  if accept then
    update public.friends set status = 'accepted' where (user_id, friend_id) in ((me, other), (other, me));
    return 'accepted';
  end if;
  delete from public.friends where (user_id, friend_id) in ((me, other), (other, me)) and status = 'pending';
  return 'declined';
end;
$$;

-- `me` stops being friends with `other` (or withdraws their own request): both rows go.
create or replace function public.friend_remove(me uuid, other uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friends
  where (user_id, friend_id) in ((me, other), (other, me)) and status <> 'blocked';
$$;

-- `me` blocks `other`: no longer friends, and other cannot ask again.
create or replace function public.friend_block(me uuid, other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if me = other then return; end if;
  delete from public.friends where (user_id, friend_id) in ((me, other), (other, me));
  insert into public.friends (user_id, friend_id, status, requested_by) values (me, other, 'blocked', me);
end;
$$;

create or replace function public.friend_unblock(me uuid, other uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friends where user_id = me and friend_id = other and status = 'blocked';
$$;

-- One more private game between a and b: counted only for two accounts that are friends. Playing
-- together no longer makes friends by itself (that is a request now); the friends there already were
-- stay. A pending request or a block is left as it is.
create or replace function public.note_friends(a uuid, b uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.friends set games = games + 1, last_played = now()
  where (user_id, friend_id) in ((a, b), (b, a)) and status = 'accepted';
$$;

-- The accounts' friends and requests, for the friends screen: status 'accepted' with this week's
-- points, and 'pending' with requested_by (the other one asked when it isn't `me`). Points are
-- counted as the ranking counts them (leaderboard_everyone.sql): the games since the date the
-- online rates went up pay the new ones.
create or replace function public.friend_list(me uuid, since timestamptz)
returns table (friend_id uuid, name text, country text, status text, requested_by uuid, games int,
               last_played timestamptz, week_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.friend_id, p.name, p.country, f.status, f.requested_by, f.games, f.last_played,
    coalesce((select sum(case
                when g.abandoned then case when g.played_at >= timestamptz '2026-11-17T04:33:00Z' then -3 else -2 end
                when g.earns_xp and g.won then case when g.played_at >= timestamptz '2026-11-17T04:33:00Z' then 4 else 2 end
                when g.earns_xp then case when g.played_at >= timestamptz '2026-11-17T04:33:00Z' then 2 else 1 end
                else 0 end)
              from public.game_results g
              where g.user_id = f.friend_id and g.source = 'server' and g.played_at >= since), 0)
    + coalesce((select sum(b.points) from public.xp_bonuses b
                where b.user_id = f.friend_id and b.created_at >= since), 0) as week_points
  from public.friends f
  left join public.profiles p on p.id = f.friend_id
  where f.user_id = me and f.status in ('accepted', 'pending')
  order by (f.status = 'pending') desc, f.last_played desc
  limit 300;
$$;

-- friends_of (friends.js) keeps answering with the accepted ones only, at the new rates.
create or replace function public.friends_of(me uuid, since timestamptz)
returns table (friend_id uuid, name text, country text, games int, last_played timestamptz, week_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.friend_id, l.name, l.country, l.games, l.last_played, l.week_points
  from public.friend_list(me, since) l
  where l.status = 'accepted'
  order by l.last_played desc
  limit 100;
$$;

revoke all on function public.friend_code_of(uuid) from public, anon, authenticated;
revoke all on function public.user_by_friend_code(text) from public, anon, authenticated;
revoke all on function public.friend_code_owner(text) from public, anon, authenticated;
revoke all on function public.friend_request(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.friend_respond(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.friend_remove(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_block(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_unblock(uuid, uuid) from public, anon, authenticated;
revoke all on function public.note_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_list(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.friends_of(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.friend_code_of(uuid) to service_role;
grant execute on function public.user_by_friend_code(text) to service_role;
grant execute on function public.friend_code_owner(text) to service_role;
grant execute on function public.friend_request(uuid, uuid, boolean) to service_role;
grant execute on function public.friend_respond(uuid, uuid, boolean) to service_role;
grant execute on function public.friend_remove(uuid, uuid) to service_role;
grant execute on function public.friend_block(uuid, uuid) to service_role;
grant execute on function public.friend_unblock(uuid, uuid) to service_role;
grant execute on function public.note_friends(uuid, uuid) to service_role;
grant execute on function public.friend_list(uuid, timestamptz) to service_role;
grant execute on function public.friends_of(uuid, timestamptz) to service_role;
