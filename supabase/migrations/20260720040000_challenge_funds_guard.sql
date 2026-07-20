-- Money integrity: a cash team-challenge must be covered by the sending
-- team owner's balance (bug: could send a $1,111,111 challenge with $0).
-- Enforced server-side so it can't be bypassed via direct API inserts.
create or replace function public.check_challenge_funds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_bal numeric;
begin
  if new.kind = 'cash' then
    if new.entry is null or new.entry <= 0 then
      raise exception 'Cash challenge entry must be greater than 0';
    end if;
    select owner_id into v_owner from public.teams where id = new.from_team_id;
    select coalesce(balance, 0) into v_bal from public.profiles where id = v_owner;
    if v_bal < new.entry then
      raise exception 'Insufficient balance to stake this challenge';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_challenge_funds on public.team_challenges;
create trigger trg_check_challenge_funds
  before insert on public.team_challenges
  for each row execute function public.check_challenge_funds();
