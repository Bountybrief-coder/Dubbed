-- migrate_blind_accept.sql
-- Blind-accept matchfinder: lock down match_players so the identity of whoever
-- posted an open match is invisible to everyone except participants and admins.
--
-- On an open match the only participant is the poster, so no one else can read
-- the row until they join (via join_match RPC, which inserts their own
-- match_players row).  Once you're in, you can see every player in that lobby.
-- This is idempotent — safe to re-run.

-- 1. Helper: does auth.uid() belong to a given match?
create or replace function public.is_match_participant(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.match_players
    where match_id = p_match and user_id = auth.uid()
  );
$$;
grant execute on function public.is_match_participant(uuid) to authenticated;

-- 2. Replace the wide-open policy with a participant-only policy.
drop policy if exists "match_players read" on public.match_players;
create policy "match_players read" on public.match_players for select using (
  user_id = auth.uid()
  or public.is_match_participant(match_id)
  or public.is_admin()
);
