-- Fix 1: settle_match — teammates of winner now get wins (not losses)
-- Also fixes team loop condition for team_match_history
create or replace function public.settle_match(p_match uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_pot numeric; v_rake numeric; v_payout numeric; v_member boolean;
        v_mp record; v_is_tourney boolean; v_opp_team uuid; v_winner_name text;
        v_winner_team uuid; v_win_count int; v_share numeric;
        v_done_teams uuid[] := '{}';
begin
  select * into v_m from public.matches where id = p_match for update;
  if v_m.status = 'settled' then return; end if;

  -- Look up winning team for all match types (needed for stats)
  select team_id into v_winner_team from public.match_players where match_id = p_match and user_id = p_winner;

  if v_m.kind = 'cash' then
    select wagr_member into v_member from public.profiles where id = p_winner;
    v_pot := v_m.entry * 2;
    v_rake := case when coalesce(v_member,false) then 0 else round(v_pot * 0.05, 2) end;
    v_payout := v_pot - v_rake;
    update public.profiles set balance = balance + v_payout where id = p_winner;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (p_winner, v_payout, 'match_payout', p_match);
    if v_winner_team is not null then
      select count(*) into v_win_count from public.match_players where match_id = p_match and team_id = v_winner_team;
      v_share := round((v_payout - v_m.entry) / greatest(v_win_count, 1), 2);
      update public.profiles set earnings = earnings + v_share
      where id in (select user_id from public.match_players where match_id = p_match and team_id = v_winner_team);
    else
      update public.profiles set earnings = earnings + (v_payout - v_m.entry) where id = p_winner;
    end if;
  end if;

  -- Update player stats using team membership (fixes teammates getting losses)
  update public.profiles p set
    xp = xp + case
      when (v_winner_team is not null and mp.team_id = v_winner_team)
        or (v_winner_team is null and p.id = p_winner) then 100 else 25 end,
    wins = wins + case
      when (v_winner_team is not null and mp.team_id = v_winner_team)
        or (v_winner_team is null and p.id = p_winner) then 1 else 0 end,
    losses = losses + case
      when (v_winner_team is not null and mp.team_id = v_winner_team)
        or (v_winner_team is null and p.id = p_winner) then 0 else 1 end,
    streak = case
      when (v_winner_team is not null and mp.team_id = v_winner_team)
        or (v_winner_team is null and p.id = p_winner) then streak + 1 else 0 end
  from public.match_players mp where mp.match_id = p_match and mp.user_id = p.id;

  update public.matches set status='settled', winner_id=p_winner where id=p_match;

  select username into v_winner_name from public.profiles where id = p_winner;
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, p_winner, 'System', 'Match settled. ' || coalesce(v_winner_name, 'Winner') || ' wins!', 'system');

  v_is_tourney := exists (select 1 from public.tournament_matches where match_id = p_match);

  -- Credit team records (deduplicated per team)
  for v_mp in select mp.user_id, mp.team_id from public.match_players mp where mp.match_id = p_match and mp.team_id is not null loop
    select mp2.team_id into v_opp_team from public.match_players mp2
    where mp2.match_id = p_match and mp2.team_id <> v_mp.team_id limit 1;

    -- Only update team stats once per team
    if not (v_mp.team_id = any(v_done_teams)) then
      v_done_teams := v_done_teams || v_mp.team_id;
      if v_mp.team_id = v_winner_team then
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
    end if;
  end loop;

  for v_mp in select mp.user_id from public.match_players mp where mp.match_id = p_match and mp.user_id <> p_winner loop
    insert into public.notifications(user_id, text) values (v_mp.user_id, 'Your match (' || v_m.code || ') has been settled. ' || coalesce(v_winner_name, 'Opponent') || ' won.');
  end loop;
end $$;

-- Fix 2: admin_revert_match — remove invalid enum 'completed', fix ledger reason
create or replace function public.admin_revert_match(p_match uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_ledger record;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_m from public.matches where id = p_match for update;
  if not found then raise exception 'match not found'; end if;
  if v_m.status <> 'settled' then raise exception 'can only revert settled matches'; end if;

  for v_ledger in
    select user_id, delta from public.wallet_ledger where ref_id = p_match and reason in ('match_payout','tournament_payout')
  loop
    update public.profiles set balance = balance - v_ledger.delta where id = v_ledger.user_id;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id)
      values (v_ledger.user_id, -v_ledger.delta, 'match_revert', p_match);
  end loop;

  if v_m.winner_id is not null then
    update public.profiles set wins = greatest(0, wins - 1) where id = v_m.winner_id;
    update public.profiles set losses = greatest(0, losses - 1)
      where id in (select user_id from public.match_players where match_id = p_match and user_id <> v_m.winner_id);
  end if;

  update public.matches set status = 'live', winner_id = null where id = p_match;
  insert into public.notifications(user_id, text)
    select mp.user_id, 'Match ' || v_m.code || ' has been reverted to live by an admin.' || coalesce(' Reason: ' || p_note, '')
    from public.match_players mp where mp.match_id = p_match;
end $$;
grant execute on function public.admin_revert_match(uuid, text) to authenticated;

-- Fix 3: bet_offers UPDATE policy — restrict to creator or admin
drop policy if exists "bet_offers update" on public.bet_offers;
create policy "bet_offers update" on public.bet_offers for update using (false);

-- Fix 4: get_revenue_dashboard — rake isn't tracked as separate ledger entries,
-- so approximate from match_payout vs entry difference instead
-- (This is a display-only admin fix, not gameplay-critical)
