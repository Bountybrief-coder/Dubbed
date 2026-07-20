-- Let a challenge's sender cancel their own still-pending challenge.
-- SECURITY DEFINER so it works regardless of the team_challenges RLS: it
-- verifies the caller is a member of the sending team before cancelling.

create or replace function public.cancel_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_from uuid; v_status text;
begin
  select from_team_id, status into v_from, v_status
  from public.team_challenges where id = p_challenge_id;
  if v_from is null then raise exception 'challenge not found'; end if;
  if v_status is distinct from 'pending' then
    raise exception 'only pending challenges can be cancelled'; end if;
  if not exists (
    select 1 from public.team_members where team_id = v_from and user_id = auth.uid()
  ) then raise exception 'not authorized to cancel this challenge'; end if;

  update public.team_challenges set status = 'cancelled' where id = p_challenge_id;
end $$;

grant execute on function public.cancel_challenge(uuid) to authenticated;

-- Make PostgREST pick up the new function immediately.
notify pgrst, 'reload schema';
