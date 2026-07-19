-- Add priority flag to escalation_tickets + update escalate_match RPC

-- 1. Add priority column
alter table public.escalation_tickets add column if not exists priority boolean default false;

-- 2. Update escalate_match to accept priority flag and charge $1
create or replace function public.escalate_match(p_match uuid, p_reason text, p_priority boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_match record;
  v_ticket uuid;
  v_bal numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_match from public.matches where id = p_match;
  if not found then raise exception 'Match not found'; end if;

  -- must be a participant
  if not exists (select 1 from public.match_players where match_id = p_match and user_id = v_user)
  then raise exception 'Not a participant'; end if;

  -- must be cash match (entry > 0)
  if v_match.entry <= 0 then raise exception 'Escalation is only available for cash matches'; end if;

  -- must be settled or disputed
  if v_match.status not in ('settled', 'disputed') then raise exception 'Match must be settled or disputed to escalate'; end if;

  -- 24 hour window
  if v_match.settled_at is not null and v_match.settled_at < now() - interval '24 hours'
  then raise exception 'Escalation window has closed (24 hours)'; end if;

  -- one per match per user
  if exists (select 1 from public.escalation_tickets where match_id = p_match and user_id = v_user)
  then raise exception 'You already escalated this match'; end if;

  -- charge $1 for priority
  if p_priority then
    select balance into v_bal from public.profiles where id = v_user for update;
    if v_bal < 1 then raise exception 'Insufficient balance for priority escalation ($1.00 required)'; end if;
    update public.profiles set balance = balance - 1 where id = v_user;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id)
      values (v_user, -1, 'priority_escalation', p_match);
  end if;

  insert into public.escalation_tickets(match_id, user_id, reason, priority)
  values (p_match, v_user, p_reason, p_priority)
  returning id into v_ticket;

  -- notify admins
  insert into public.notifications(user_id, text)
  select p.id, (case when p_priority then '⚡ PRIORITY ' else '' end) || 'Escalation ticket opened for match ' || v_match.code || '.'
  from public.profiles p where p.role = 'admin';

  return v_ticket;
end $$;

-- 3. Drop old function (return type changed), then recreate with priority
drop function if exists public.list_escalation_tickets(text);
create or replace function public.list_escalation_tickets(p_status text default null)
returns table(
  id uuid, match_id uuid, user_id uuid, username text, reason text,
  status text, resolution text, admin_notes text,
  created_at timestamptz, resolved_at timestamptz,
  match_code text, match_entry numeric, priority boolean
) language plpgsql security definer set search_path = public as $$
begin
  return query
    select
      et.id, et.match_id, et.user_id, p.username, et.reason,
      et.status::text, et.resolution, et.admin_notes,
      et.created_at, et.resolved_at,
      m.code as match_code, m.entry as match_entry,
      coalesce(et.priority, false) as priority
    from public.escalation_tickets et
      join public.profiles p on p.id = et.user_id
      join public.matches m on m.id = et.match_id
    where (p_status is null or et.status::text = p_status)
    order by
      (case when et.status::text = 'open' and coalesce(et.priority, false) then 0
            when et.status::text = 'open' then 1
            when et.status::text = 'reviewing' then 2
            else 3 end),
      et.created_at desc;
end $$;
