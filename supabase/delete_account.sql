-- Lets a signed-in player delete their own account from inside the app
-- (Apple requires it of any app where accounts can be created). Run once in
-- the Linotte Supabase project: Dashboard > SQL Editor > paste > Run.
--
-- The function runs with the owner's rights (security definer) but only
-- ever deletes the caller's own row: auth.uid() is the signed-in player.
create or replace function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
