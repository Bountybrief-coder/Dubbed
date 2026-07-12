-- Section 2 fixes: rake rate 10%→5% and pot calculation entry*v_players→entry*2

create or replace function public.settle_match(p_match uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_pot numeric; v_rake numeric; v_payout numeric; v_member boolean;
        v_mp record; v_is_tourney boolean; v_opp_team uuid;
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
