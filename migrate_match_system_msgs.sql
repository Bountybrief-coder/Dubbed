-- Section 1: Add system messages to all match lifecycle RPCs
-- Each RPC inserts a match_messages row with kind='system' on its action

-- ── join_match: post "PlayerName joined" + existing lobby-full msg ──
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
      update public.matches set status = 'live', veto_status = 'complete', host_region = public.resolve_host(p_match) where id = p_match;
    end if;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      select p_match, auth.uid(), 'System', 'Lobby is full. ' ||
        case when public.mode_needs_veto(v_m.mode) then 'Map veto has started.' else 'Match is live — good luck.' end, 'system';
  end if;
end $$;

-- ── veto_action: post "PlayerName banned MapName" per ban ──
create or replace function public.veto_action(p_match uuid, p_map text)
returns matches language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_state jsonb; v_order jsonb; v_turn int; v_actor uuid;
        v_remaining jsonb; v_needed int; v_actions jsonb; v_count int;
        v_username text;
begin
  select * into v_m from public.matches where id = p_match for update;
  if not found then raise exception 'match not found'; end if;
  if v_m.veto_status <> 'pending' then raise exception 'veto is not active for this match'; end if;
  if not exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'not a participant'; end if;

  v_state := v_m.veto;
  v_order := v_state->'order';
  v_turn := coalesce((v_state->>'turn')::int, 0);
  v_actor := (v_order->>(v_turn % jsonb_array_length(v_order)))::uuid;
  if v_actor <> auth.uid() then raise exception 'not your turn to ban'; end if;
  if not ((v_state->'remaining') ? p_map) then raise exception 'map already banned or invalid'; end if;

  select jsonb_agg(x) into v_remaining
    from jsonb_array_elements_text(v_state->'remaining') x
    where x <> p_map;
  v_remaining := coalesce(v_remaining, '[]'::jsonb);
  v_actions := coalesce(v_state->'actions','[]'::jsonb) || jsonb_build_object('by', auth.uid(), 'map', p_map);
  v_needed := coalesce((v_state->>'needed')::int, 1);

  v_state := jsonb_set(v_state, '{remaining}', v_remaining);
  v_state := jsonb_set(v_state, '{actions}', v_actions);
  v_state := jsonb_set(v_state, '{turn}', to_jsonb(v_turn + 1));

  -- System message: ban action
  select username into v_username from public.profiles where id = auth.uid();
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, auth.uid(), 'System', coalesce(v_username, 'Player') || ' banned ' || p_map || '.', 'system');

  v_count := jsonb_array_length(v_remaining);
  if v_count <= v_needed then
    v_state := jsonb_set(v_state, '{finalMaps}', v_remaining);
    update public.matches
      set veto = v_state, veto_status = 'complete', host_region = public.resolve_host(p_match)
      where id = p_match returning * into v_m;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      values (p_match, auth.uid(), 'System', 'Veto complete. Map(s): ' || array_to_string(array(select jsonb_array_elements_text(v_remaining)), ', ') || '. Match is live — good luck.', 'system');
  else
    update public.matches set veto = v_state where id = p_match returning * into v_m;
  end if;
  return v_m;
end $$;

-- ── report_match: post "PlayerName submitted their result" ──
create or replace function public.report_match(p_match uuid, p_winner uuid, p_score text, p_evidence_url text)
returns void language plpgsql security definer set search_path = public as $$
declare v_players int; v_reports int; v_distinct int; v_username text;
begin
  perform public.check_not_banned();
  if not exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'not a participant'; end if;
  insert into public.match_reports(match_id, reported_by, winner_id, score, evidence_url)
    values (p_match, auth.uid(), p_winner, p_score, p_evidence_url)
    on conflict (match_id, reported_by)
    do update set winner_id=excluded.winner_id, score=excluded.score, evidence_url=excluded.evidence_url;
  update public.matches set status = 'reported' where id = p_match and status = 'live';

  select username into v_username from public.profiles where id = auth.uid();
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, auth.uid(), 'System', coalesce(v_username, 'A player') || ' submitted their result.', 'system');

  select count(*) into v_players from public.match_players where match_id = p_match;
  select count(*), count(distinct winner_id) into v_reports, v_distinct from public.match_reports where match_id = p_match;
  if v_reports = v_players and v_distinct = 1 then
    perform public.settle_match(p_match, p_winner);
  end if;
end $$;

-- ── settle_match: post "Match settled. Winner: PlayerName" ──
create or replace function public.settle_match(p_match uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_pot numeric; v_rake numeric; v_payout numeric; v_member boolean;
        v_mp record; v_is_tourney boolean; v_opp_team uuid; v_winner_name text;
begin
  select * into v_m from public.matches where id = p_match for update;
  if v_m.status = 'settled' then return; end if;
  if v_m.kind = 'cash' then
    select wagr_member into v_member from public.profiles where id = p_winner;
    v_pot := v_m.entry * 2;
    v_rake := case when coalesce(v_member,false) then 0 else round(v_pot * 0.05, 2) end;
    v_payout := v_pot - v_rake;
    update public.profiles set balance = balance + v_payout, earnings = earnings + (v_payout - v_m.entry) where id = p_winner;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (p_winner, v_payout, 'match_payout', p_match);
  end if;
  update public.profiles p set
    xp = xp + case when p.id = p_winner then 100 else 25 end,
    wins = wins + case when p.id = p_winner then 1 else 0 end,
    losses = losses + case when p.id = p_winner then 0 else 1 end,
    streak = case when p.id = p_winner then streak + 1 else 0 end
  from public.match_players mp where mp.match_id = p_match and mp.user_id = p.id;
  update public.matches set status='settled', winner_id=p_winner where id=p_match;

  -- System message: settled
  select username into v_winner_name from public.profiles where id = p_winner;
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, p_winner, 'System', 'Match settled. ' || coalesce(v_winner_name, 'Winner') || ' wins!', 'system');

  v_is_tourney := exists (select 1 from public.tournament_matches where match_id = p_match);

  for v_mp in select mp.user_id, mp.team_id from public.match_players mp where mp.match_id = p_match and mp.team_id is not null loop
    select mp2.team_id into v_opp_team from public.match_players mp2
    where mp2.match_id = p_match and mp2.team_id <> v_mp.team_id limit 1;

    if v_mp.user_id = p_winner then
      if v_is_tourney then
        update public.teams set tourney_wins = tourney_wins + 1,
          xp = xp + 100,
          earnings = earnings + greatest(coalesce(v_payout, 0) - v_m.entry, 0)
        where id = v_mp.team_id;
      else
        update public.teams set wins = wins + 1,
          xp = xp + 100,
          earnings = earnings + greatest(coalesce(v_payout, 0) - v_m.entry, 0)
        where id = v_mp.team_id;
      end if;
      insert into public.team_match_history(team_id, match_id, result, earnings, xp_earned, opponent_team_id,
        tournament_id)
        values (v_mp.team_id, p_match, 'win', greatest(coalesce(v_payout, 0) - v_m.entry, 0), 100, v_opp_team,
          (select tournament_id from public.tournament_matches where match_id = p_match limit 1));
    else
      if v_is_tourney then
        update public.teams set tourney_losses = tourney_losses + 1, xp = xp + 25
        where id = v_mp.team_id;
      else
        update public.teams set losses = losses + 1, xp = xp + 25
        where id = v_mp.team_id;
      end if;
      insert into public.team_match_history(team_id, match_id, result, earnings, xp_earned, opponent_team_id,
        tournament_id)
        values (v_mp.team_id, p_match, 'loss', 0, 25, v_opp_team,
          (select tournament_id from public.tournament_matches where match_id = p_match limit 1));
    end if;
  end loop;

  perform public.settle_match_bets(p_match, p_winner);
  declare v_tm_id uuid; begin
    select id into v_tm_id from public.tournament_matches where match_id=p_match limit 1;
    if v_tm_id is not null then perform public.advance_bracket(v_tm_id); end if;
  end;
end $$;

-- ── open_dispute: post "PlayerName opened a dispute" ──
create or replace function public.open_dispute(p_match uuid, p_reason text, p_evidence_url text)
returns void language plpgsql security definer set search_path = public as $$
declare v_username text;
begin
  perform public.check_not_banned();
  if not exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'not a participant'; end if;
  insert into public.match_disputes(match_id, opened_by, reason, evidence_url) values (p_match, auth.uid(), p_reason, p_evidence_url);
  update public.matches set status='disputed' where id=p_match;

  select username into v_username from public.profiles where id = auth.uid();
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, auth.uid(), 'System', coalesce(v_username, 'A player') || ' opened a dispute.', 'system');
end $$;

-- ── settle_match_admin: post "Admin resolved the dispute" ──
create or replace function public.settle_match_admin(p_match uuid, p_winner uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  perform public.settle_match(p_match, p_winner);
  update public.match_disputes set status='resolved', resolved_by=auth.uid(), resolution=p_note, resolved_at=now()
    where match_id=p_match and status in ('open','reviewing');
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, auth.uid(), 'System', 'An admin resolved the dispute. Match settled.', 'system');
end $$;
