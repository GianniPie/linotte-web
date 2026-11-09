-- Friends: two accounts that have played each other in a private room.
-- Written by the game server only (server/friends.js), one row each way.
-- Run once in the Linotte Supabase project: Dashboard > SQL Editor, after
-- xp_bonuses.sql (friends_of counts this week's points the same way).

create table if not exists public.friends (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  games int not null default 0,
  last_played timestamptz not null default now(),
  primary key (user_id, friend_id)
);

alter table public.friends enable row level security;
revoke all on public.friends from anon, authenticated;
grant all on public.friends to service_role;

-- One more private game between a and b (both ways).
create or replace function public.note_friends(a uuid, b uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.friends (user_id, friend_id, games, last_played)
  values (a, b, 1, now()), (b, a, 1, now())
  on conflict (user_id, friend_id)
  do update set games = public.friends.games + 1, last_played = now();
$$;

-- An account's friends, most recently played first, with their name,
-- country and points since `since` (online games and bonuses, as in the
-- weekly ranking).
create or replace function public.friends_of(me uuid, since timestamptz)
returns table (friend_id uuid, name text, country text, games int, last_played timestamptz, week_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.friend_id, p.name, p.country, f.games, f.last_played,
    coalesce((select sum(case when g.abandoned then -2 when g.won then 2 else 1 end)
              from public.game_results g
              where g.user_id = f.friend_id and g.source = 'server' and g.played_at >= since), 0)
    + coalesce((select sum(b.points) from public.xp_bonuses b
                where b.user_id = f.friend_id and b.created_at >= since), 0) as week_points
  from public.friends f
  left join public.profiles p on p.id = f.friend_id
  where f.user_id = me
  order by f.last_played desc
  limit 100;
$$;

revoke all on function public.note_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friends_of(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.note_friends(uuid, uuid) to service_role;
grant execute on function public.friends_of(uuid, timestamptz) to service_role;
