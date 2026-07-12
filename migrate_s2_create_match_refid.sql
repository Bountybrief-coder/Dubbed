-- FIX S2-7: create_match ledger entry missing ref_id.
-- Move ledger insert to after match insert so match ID is available.
create or replace function public.create_match(
  p_game text, p_mode text, p_format text, p_region text, p_entry numeric, p_kind match_kind,
  p_platform text default 'PC + Console Mixed', p_skill_tier text default 'Open',
  p_series text default 'Best of 1', p_weapon_restriction text default null,
  p_host_rule text default 'auto', p_team_id uuid default null,
  p_map text default null, p_veto_ban text default null, p_map_pool text[] default null,
  p_allowed_input text default 'Controller + M&K',
  p_roster uuid[] default null
) returns matches language plpgsql security definer set search_path = public as $$
declare v_code text; v_match public.matches; v_bal numeric; v_xp int; v_region text; v_gate text;
        v_team public.teams; v_team_name text; v_rid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.check_not_banned();
  perform public.check_rate_limit('create_match', 5, 60);

  if p_team_id is not null then
    select * into v_team from public.teams where id = p_team_id;
    if not found then raise exception 'team not found'; end if;
    if not exists (select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid()) then
      raise exception 'you are not on this team';
    end if;
  else
    select t.* into v_team from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = auth.uid() and t.game = p_game
      and t.type::text = p_kind::text
    limit 1;
  end if;

  v_gate := public.can_play(auth.uid(), p_game, p_platform, p_kind::text);
  if v_gate is not null then raise exception '%', v_gate; end if;

  if not public.format_allowed(p_game, p_format) then
    raise exception '% only supports 1v1/2v2 lobbies', p_game;
  end if;
  if p_skill_tier = 'Rookie Only' then
    select xp into v_xp from public.profiles where id = auth.uid();
    if coalesce(v_xp,0) >= 25000 then raise exception 'Rookie Only lobbies require Rookie rank (under 25,000 XP)'; end if;
  end if;

  if p_game in ('Call of Duty: WWII', 'Call of Duty: Black Ops', 'Call of Duty: Black Ops II')
     and v_team.id is not null then
    p_platform := v_team.platform;
  end if;

  v_team_name := v_team.name;

  if p_roster is not null and array_length(p_roster, 1) > 0 then
    if v_team.id is null then raise exception 'roster requires a team'; end if;
    for v_rid in select unnest(p_roster) loop
      if not exists (select 1 from public.team_members where team_id = v_team.id and user_id = v_rid) then
        raise exception 'roster member is not on this team';
      end if;
    end loop;
  end if;

  loop
    v_code := 'DUB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists (select 1 from public.matches where code = v_code);
  end loop;
  if p_kind = 'cash' then
    if p_entry <= 0 then raise exception 'cash match needs a positive entry'; end if;
    select balance into v_bal from public.profiles where id = auth.uid() for update;
    if v_bal < p_entry then raise exception 'insufficient balance'; end if;
    update public.profiles set balance = balance - p_entry where id = auth.uid();
  end if;
  insert into public.matches(code, game, mode, format, region, entry, kind, status, created_by,
                              platform, skill_tier, series, weapon_restriction, host_rule,
                              team_name, map, allowed_input)
    values (v_code, p_game, p_mode, p_format, p_region,
            case when p_kind='cash' then p_entry else 0 end, p_kind, 'open', auth.uid(),
            p_platform, p_skill_tier, p_series, nullif(p_weapon_restriction,'None'), coalesce(p_host_rule,'auto'),
            v_team_name, p_map, coalesce(p_allowed_input, 'Controller + M&K'))
    returning * into v_match;
  if p_kind = 'cash' then
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (auth.uid(), -p_entry, 'match_entry', v_match.id);
  end if;

  if p_roster is not null and array_length(p_roster, 1) > 0 then
    for v_rid in select unnest(p_roster) loop
      select region into v_region from public.profiles where id = v_rid;
      insert into public.match_players(match_id, user_id, region, team_id, team_name)
        values (v_match.id, v_rid, coalesce(v_region,'NA'), v_team.id, v_team_name);
    end loop;
  else
    select region into v_region from public.profiles where id = auth.uid();
    insert into public.match_players(match_id, user_id, region, team_id, team_name)
      values (v_match.id, auth.uid(), coalesce(v_region,'NA'), v_team.id, v_team_name);
  end if;
  return v_match;
end $$;
