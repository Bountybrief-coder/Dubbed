-- Tournament fixes: map assignment, auto-start next round, bracket flow
-- 1. Update start_tournament_match to assign a random map from the game/mode pool
-- 2. Update advance_bracket to auto-start next round matches after creation

-- Helper: pick a random map for a game + mode combo
create or replace function public.random_map_for(p_game text, p_mode text)
returns text language plpgsql as $$
declare
  v_pool text[];
begin
  -- BO7
  if p_game = 'Call of Duty: Black Ops 7' then
    if p_mode in ('Search & Destroy', 'CDL Maps SND', 'Raid Only SND', 'Standoff Only SND', 'Fringe Only SND') then
      v_pool := array['Den', 'Raid', 'Standoff', 'Gridlock', 'Hacienda'];
    elsif p_mode = 'Hardpoint' then
      v_pool := array['Colossus', 'Den', 'Scar', 'Sake', 'Gridlock', 'Hacienda'];
    elsif p_mode = 'Control' then
      v_pool := array['Den', 'Vault', 'Scar', 'Hacienda', 'Skyline'];
    elsif p_mode = 'Kill Race' then
      v_pool := array['Colossus', 'Den', 'Scar', 'Sake', 'Gridlock', 'Hacienda'];
    elsif p_mode = 'Gunfight' then
      v_pool := array['Abyss', 'Liminal', 'Paranoia', 'Blackheart', 'Nexus'];
    elsif p_mode = 'Nuketown 24/7 Kill Race' or p_mode = 'Nuketown Only SND' then
      v_pool := array['Nuketown'];
    else
      v_pool := array['Den', 'Raid', 'Standoff', 'Gridlock', 'Hacienda', 'Scar', 'Sake', 'Colossus'];
    end if;
  -- MW4
  elsif p_game = 'Call of Duty: Modern Warfare 4' then
    if p_mode = 'Search & Destroy' or p_mode = 'Hardpoint' then
      v_pool := array['Compound', 'Terminal', 'Borderline', 'District', 'Salvage', 'Depot'];
    elsif p_mode = 'Kill Race' then
      v_pool := array['Terminal', 'Compound', 'Depot'];
    else
      v_pool := array['Compound', 'Terminal', 'Borderline', 'District', 'Salvage', 'Depot'];
    end if;
  -- WWII
  elsif p_game = 'Call of Duty: WWII' then
    if p_mode = 'Search & Destroy' then
      v_pool := array['Ardennes Forest', 'Flak Tower', 'Gibraltar', 'London Docks', 'Sainte Marie du Mont', 'USS Texas'];
    elsif p_mode = 'Hardpoint' then
      v_pool := array['Ardennes Forest', 'Gibraltar', 'London Docks', 'Sainte Marie du Mont'];
    else
      v_pool := array['Ardennes Forest', 'Flak Tower', 'Gibraltar', 'London Docks', 'Sainte Marie du Mont', 'USS Texas'];
    end if;
  -- BO1
  elsif p_game = 'Call of Duty: Black Ops' then
    if p_mode = 'Search & Destroy' then
      v_pool := array['Hanoi', 'Firing Range', 'Grid', 'Havana', 'Villa'];
    elsif p_mode = 'Hardpoint' then
      v_pool := array['Firing Range', 'Grid', 'Havana', 'Villa', 'Summit'];
    else
      v_pool := array['Hanoi', 'Firing Range', 'Grid', 'Havana', 'Villa', 'Summit'];
    end if;
  -- BO2
  elsif p_game = 'Call of Duty: Black Ops II' then
    if p_mode = 'Search & Destroy' then
      v_pool := array['Cargo', 'Express', 'Raid', 'Slums', 'Standoff'];
    elsif p_mode = 'Hardpoint' then
      v_pool := array['Raid', 'Slums', 'Standoff', 'Yemen', 'Meltdown'];
    else
      v_pool := array['Cargo', 'Express', 'Raid', 'Slums', 'Standoff', 'Yemen', 'Meltdown'];
    end if;
  -- Warzone / BR
  elsif p_game in ('Warzone', 'Black Ops Royale') then
    v_pool := array['Urzikstan', 'Area 99', 'Rebirth Island'];
  else
    v_pool := null;
  end if;

  if v_pool is null or array_length(v_pool, 1) is null then
    return null;
  end if;

  return v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
end $$;

-- 2. Rebuild start_tournament_match with map assignment
create or replace function public.start_tournament_match(p_tm_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tm public.tournament_matches; v_t public.tournaments; v_mid uuid; v_code text; v_map text;
begin
  select * into v_tm from public.tournament_matches where id = p_tm_id for update;
  if not found then raise exception 'bracket match not found'; end if;
  if v_tm.status <> 'ready' then raise exception 'match not ready'; end if;
  if v_tm.match_id is not null then return v_tm.match_id; end if;
  select * into v_t from public.tournaments where id = v_tm.tournament_id;
  v_code := 'T-' || substr(v_tm.id::text, 1, 6);
  v_map := public.random_map_for(v_t.game, v_t.mode);
  insert into public.matches(code, game, mode, format, region, entry, kind, status, created_by,
    platform, skill_tier, series, weapon_restriction, host_rule, map)
    values (v_code, v_t.game, v_t.mode, v_t.format, v_t.region, 0, 'xp', 'live',
      v_tm.user_a, coalesce(v_t.platform,'PC + Console Mixed'), coalesce(v_t.skill_tier,'Open'),
      coalesce(v_t.series,'Best of 1'), v_t.weapon_restriction, coalesce(v_t.host_rule,'auto'), v_map)
    returning id into v_mid;
  insert into public.match_players(match_id, user_id, region)
    values (v_mid, v_tm.user_a, coalesce((select region from public.profiles where id=v_tm.user_a),'NA'));
  insert into public.match_players(match_id, user_id, region)
    values (v_mid, v_tm.user_b, coalesce((select region from public.profiles where id=v_tm.user_b),'NA'));
  update public.tournament_matches set match_id = v_mid, status = 'live' where id = p_tm_id;
  insert into public.notifications(user_id, text) values
    (v_tm.user_a, 'Your ' || v_t.name || ' match is ready! Join the lobby.'),
    (v_tm.user_b, 'Your ' || v_t.name || ' match is ready! Join the lobby.');
  return v_mid;
end $$;

-- 3. Rebuild advance_bracket to auto-start next round matches
create or replace function public.advance_bracket(p_tm_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tm public.tournament_matches; v_t public.tournaments; v_m public.matches;
  v_round public.tournament_rounds; v_done boolean; v_next_round_id uuid;
  v_next int; v_we text; v_wu uuid; v_le text; v_mn int; v_w1 record; v_w2 record; v_i int;
  v_new_tm_id uuid;
begin
  select * into v_tm from public.tournament_matches where id = p_tm_id for update;
  if v_tm.status = 'completed' then return; end if;
  select * into v_m from public.matches where id = v_tm.match_id;
  if v_m.winner_id is null then raise exception 'match has no winner'; end if;
  if v_m.winner_id = v_tm.user_a then v_we := v_tm.entrant_a; v_wu := v_tm.user_a; v_le := v_tm.entrant_b;
  else v_we := v_tm.entrant_b; v_wu := v_tm.user_b; v_le := v_tm.entrant_a; end if;
  update public.tournament_matches set status='completed', winner_entrant=v_we, winner_user=v_wu where id=p_tm_id;

  select * into v_t from public.tournaments where id = v_tm.tournament_id;
  select * into v_round from public.tournament_rounds where id = v_tm.round_id;
  select not exists (select 1 from public.tournament_matches where round_id=v_round.id and status not in ('completed','bye','stalled'))
    into v_done;
  if not v_done then return; end if;

  v_next := v_round.round_number + 1;
  if v_next > v_t.total_rounds then
    -- Final done — settle tournament
    declare v_fl text; v_third text; begin
      v_fl := case when v_we = v_tm.entrant_a then v_tm.entrant_b else v_tm.entrant_a end;
      select case when tm2.winner_entrant=tm2.entrant_a then tm2.entrant_b else tm2.entrant_a end into v_third
        from public.tournament_matches tm2 join public.tournament_rounds tr2 on tr2.id=tm2.round_id
        where tm2.tournament_id=v_t.id and tr2.round_number=v_t.total_rounds-1 and tm2.status='completed'
        order by tm2.match_number limit 1;
      perform public.settle_tournament_auto(v_t.id, v_we, v_fl, coalesce(v_third, v_fl));
    end;
    return;
  end if;

  select id into v_next_round_id from public.tournament_rounds
    where tournament_id=v_t.id and round_number=v_next;
  v_mn := 0;
  for v_i in 1..(select count(*) from public.tournament_matches where round_id=v_round.id) / 2 loop
    select winner_entrant, winner_user into v_w1 from public.tournament_matches
      where round_id=v_round.id and match_number=(v_i-1)*2+1;
    select winner_entrant, winner_user into v_w2 from public.tournament_matches
      where round_id=v_round.id and match_number=(v_i-1)*2+2;
    v_mn := v_mn + 1;
    insert into public.tournament_matches(tournament_id, round_id, match_number, entrant_a, entrant_b, user_a, user_b, status)
      values (v_t.id, v_next_round_id, v_mn, v_w1.winner_entrant, v_w2.winner_entrant, v_w1.winner_user, v_w2.winner_user, 'ready')
      returning id into v_new_tm_id;
    -- Auto-start the next round match immediately
    perform public.start_tournament_match(v_new_tm_id);
    insert into public.notifications(user_id, text) values
      (v_w1.winner_user, 'You advanced! Next match in ' || v_t.name || ' is ready.'),
      (v_w2.winner_user, 'You advanced! Next match in ' || v_t.name || ' is ready.');
  end loop;
  update public.tournaments set current_round = v_next where id = v_t.id;
end $$;
