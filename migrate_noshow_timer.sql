-- Add accepted_at column to matches and set it when a match goes live.
-- Idempotent: safe to re-run.

-- §1 — Add the column
alter table public.matches add column if not exists accepted_at timestamptz;

-- §2 — Backfill: set accepted_at for existing live/settled/reported/disputed matches
-- that don't have it yet (use created_at as best guess).
update public.matches
  set accepted_at = created_at
  where accepted_at is null
    and status in ('live', 'reported', 'settled', 'disputed');

-- §3 — Update join_match to set accepted_at when the match goes live.
-- This replaces the function from migrate_match_system_msgs.sql.
create or replace function public.join_match(p_match uuid, p_team_id uuid default null, p_veto_ban text default null,
  p_roster uuid[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_bal numeric; v_xp int; v_region text; v_players int; v_needed int;
        v_pool jsonb; v_gate text; v_team public.teams; v_team_name text; v_rid uuid;
        v_username text;
begin
  perform public.check_not_banned();
  perform public.check_rate_limit('join_match', 10, 60);
  select * into v_m from public.matches where id = p_match for update;
  if not found then raise exception 'match not found'; end if;
  if v_m.status <> 'open' then raise exception 'match is not open'; end if;

  if p_team_id is not null then
    select * into v_team from public.teams where id = p_team_id;
    if not found then raise exception 'team not found'; end if;
  else
    select t.* into v_team from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = auth.uid() and t.game = v_m.game
      and t.type::text = v_m.kind::text
    limit 1;
  end if;

  v_gate := public.can_play(auth.uid(), v_m.game, v_m.platform, v_m.kind::text);
  if v_gate is not null then raise exception '%', v_gate; end if;

  if v_m.game in ('Call of Duty: WWII', 'Call of Duty: Black Ops', 'Call of Duty: Black Ops II')
     and v_team.id is not null and v_team.platform <> v_m.platform then
    raise exception 'Your team is % but this match is %', v_team.platform, v_m.platform;
  end if;

  if exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'already joined'; end if;
  if v_m.skill_tier = 'Rookie Only' then
    select xp into v_xp from public.profiles where id = auth.uid();
    if coalesce(v_xp,0) >= 25000 then raise exception 'Rookie Only lobby — your rank is above Rookie'; end if;
  end if;
  if v_m.kind = 'cash' then
    select balance into v_bal from public.profiles where id = auth.uid() for update;
    if v_bal < v_m.entry then raise exception 'insufficient balance'; end if;
    update public.profiles set balance = balance - v_m.entry where id = auth.uid();
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (auth.uid(), -v_m.entry, 'match_entry', p_match);
  end if;
  v_team_name := v_team.name;

  -- Validate roster if provided
  if p_roster is not null and array_length(p_roster, 1) > 0 then
    if v_team.id is null then raise exception 'roster requires a team'; end if;
    for v_rid in select unnest(p_roster) loop
      if exists (select 1 from public.match_players where match_id=p_match and user_id=v_rid) then
        raise exception 'roster member already in this match';
      end if;
      if not exists (select 1 from public.team_members where team_id = v_team.id and user_id = v_rid) then
        raise exception 'roster member is not on this team';
      end if;
    end loop;
  end if;

  -- Insert roster players (or just the joiner)
  if p_roster is not null and array_length(p_roster, 1) > 0 then
    for v_rid in select unnest(p_roster) loop
      select region into v_region from public.profiles where id = v_rid;
      insert into public.match_players(match_id, user_id, region, team_id, team_name)
        values (p_match, v_rid, coalesce(v_region,'NA'), v_team.id, v_team_name);
    end loop;
  else
    select region into v_region from public.profiles where id = auth.uid();
    insert into public.match_players(match_id, user_id, region, team_id, team_name)
      values (p_match, auth.uid(), coalesce(v_region,'NA'), v_team.id, v_team_name);
  end if;

  -- System message: player joined
  select username into v_username from public.profiles where id = auth.uid();
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, auth.uid(), 'System',
      coalesce(v_team_name, coalesce(v_username, 'A player')) || ' joined the match.', 'system');

  select count(*) into v_players from public.match_players where match_id = p_match;
  v_needed := public.team_size(v_m.format) * 2;
  if v_players >= v_needed then
    if public.mode_needs_veto(v_m.mode) then
      v_pool := public.maps_for_mode(v_m.mode);
      update public.matches set
        status = 'live',
        accepted_at = now(),
        veto_status = 'pending',
        veto = jsonb_build_object(
          'pool', v_pool,
          'remaining', v_pool,
          'needed', public.maps_needed(v_m.series),
          'order', (select jsonb_agg(user_id order by joined_at) from public.match_players where match_id = p_match),
          'turn', 0,
          'actions', '[]'::jsonb,
          'finalMaps', '[]'::jsonb
        )
      where id = p_match;
    else
      update public.matches set status = 'live', accepted_at = now(), veto_status = 'complete', host_region = public.resolve_host(p_match) where id = p_match;
    end if;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      select p_match, auth.uid(), 'System', 'Lobby is full. ' ||
        case when public.mode_needs_veto(v_m.mode) then 'Map veto has started.' else 'Match is live — good luck.' end, 'system';
  end if;
end $$;
