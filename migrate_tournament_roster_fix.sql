-- Fix: start_tournament_match must propagate team info to match_players
-- For 1v1: set team_name = entrant_name (player display name)
-- For team formats (2v2+): look up team from tournament_entries, add all members

create or replace function public.start_tournament_match(p_tm_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tm   public.tournament_matches;
  v_t    public.tournaments;
  v_mid  uuid;
  v_code text;
  v_map  text;
  v_ts   int;
  v_tea  record;  -- tournament entry A
  v_teb  record;  -- tournament entry B
  v_team_a public.teams;
  v_team_b public.teams;
  v_member record;
begin
  select * into v_tm from public.tournament_matches where id = p_tm_id for update;
  if not found then raise exception 'bracket match not found'; end if;
  if v_tm.status <> 'ready' then raise exception 'match not ready'; end if;
  if v_tm.match_id is not null then return v_tm.match_id; end if;

  select * into v_t from public.tournaments where id = v_tm.tournament_id;
  v_ts := coalesce(nullif(regexp_replace(v_t.format, '[^0-9].*', ''), ''), '1')::int;
  v_code := 'T-' || substr(v_tm.id::text, 1, 6);
  v_map := public.random_map_for(v_t.game, v_t.mode);

  -- Look up tournament entries for both sides
  select * into v_tea from public.tournament_entries
    where tournament_id = v_t.id and user_id = v_tm.user_a;
  select * into v_teb from public.tournament_entries
    where tournament_id = v_t.id and user_id = v_tm.user_b;

  -- Resolve team names
  if v_tea.team_id is not null then
    select * into v_team_a from public.teams where id = v_tea.team_id;
  end if;
  if v_teb.team_id is not null then
    select * into v_team_b from public.teams where id = v_teb.team_id;
  end if;

  -- Create the match
  insert into public.matches(code, game, mode, format, region, entry, kind, status, created_by,
    platform, skill_tier, series, weapon_restriction, host_rule, map, team_name)
    values (v_code, v_t.game, v_t.mode, v_t.format, v_t.region, 0, 'xp', 'live',
      v_tm.user_a, coalesce(v_t.platform,'PC + Console Mixed'), coalesce(v_t.skill_tier,'Open'),
      coalesce(v_t.series,'Best of 1'), v_t.weapon_restriction, coalesce(v_t.host_rule,'auto'),
      v_map, v_team_a.name)
    returning id into v_mid;

  if v_ts <= 1 then
    -- 1v1: insert both players with entrant_name as team_name
    insert into public.match_players(match_id, user_id, region, team_id, team_name)
      values (v_mid, v_tm.user_a,
        coalesce((select region from public.profiles where id = v_tm.user_a), 'NA'),
        v_tea.team_id, coalesce(v_team_a.name, v_tea.entrant_name));
    insert into public.match_players(match_id, user_id, region, team_id, team_name)
      values (v_mid, v_tm.user_b,
        coalesce((select region from public.profiles where id = v_tm.user_b), 'NA'),
        v_teb.team_id, coalesce(v_team_b.name, v_teb.entrant_name));
  else
    -- Team format: add all team members for each side
    if v_team_a.id is not null then
      for v_member in
        select tm.user_id, coalesce(p.region, 'NA') as region
        from public.team_members tm
        join public.profiles p on p.id = tm.user_id
        where tm.team_id = v_team_a.id
      loop
        insert into public.match_players(match_id, user_id, region, team_id, team_name)
          values (v_mid, v_member.user_id, v_member.region, v_team_a.id, v_team_a.name);
      end loop;
    else
      insert into public.match_players(match_id, user_id, region, team_id, team_name)
        values (v_mid, v_tm.user_a,
          coalesce((select region from public.profiles where id = v_tm.user_a), 'NA'),
          null, v_tea.entrant_name);
    end if;

    if v_team_b.id is not null then
      for v_member in
        select tm.user_id, coalesce(p.region, 'NA') as region
        from public.team_members tm
        join public.profiles p on p.id = tm.user_id
        where tm.team_id = v_team_b.id
      loop
        insert into public.match_players(match_id, user_id, region, team_id, team_name)
          values (v_mid, v_member.user_id, v_member.region, v_team_b.id, v_team_b.name);
      end loop;
    else
      insert into public.match_players(match_id, user_id, region, team_id, team_name)
        values (v_mid, v_tm.user_b,
          coalesce((select region from public.profiles where id = v_tm.user_b), 'NA'),
          null, v_teb.entrant_name);
    end if;
  end if;

  update public.tournament_matches set match_id = v_mid, status = 'live' where id = p_tm_id;

  insert into public.notifications(user_id, text) values
    (v_tm.user_a, 'Your ' || v_t.name || ' match is ready! Join the lobby.'),
    (v_tm.user_b, 'Your ' || v_t.name || ' match is ready! Join the lobby.');

  return v_mid;
end $$;

-- Backfill: fix existing tournament match_players that are missing team_name
update public.match_players mp
set team_name = coalesce(
  (select t.name from tournament_entries te
   join teams t on t.id = te.team_id
   where te.tournament_id = tm.tournament_id and te.user_id = mp.user_id),
  (select te.entrant_name from tournament_entries te
   where te.tournament_id = tm.tournament_id and te.user_id = mp.user_id)
)
from public.tournament_matches tm
join public.matches m on m.id = tm.match_id
where mp.match_id = m.id
  and mp.team_name is null;

-- Also fix match_players.team_id for existing tournament matches
update public.match_players mp
set team_id = (
  select te.team_id from tournament_entries te
  where te.tournament_id = tm.tournament_id and te.user_id = mp.user_id
)
from public.tournament_matches tm
join public.matches m on m.id = tm.match_id
where mp.match_id = m.id
  and mp.team_id is null
  and exists (
    select 1 from tournament_entries te
    where te.tournament_id = tm.tournament_id and te.user_id = mp.user_id and te.team_id is not null
  );
