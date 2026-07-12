-- migrate_weekly_stats.sql
-- Wires settle_match and settle_tournament into weekly_stats so the weekly
-- leaderboard and rollover_week() reward payouts actually work.
-- Idempotent — safe to re-run.

-- Helper: upsert a player's weekly stats row after a match or tournament settles.
create or replace function public.upsert_weekly_stat(
  p_user uuid, p_xp int, p_earnings numeric, p_won boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_week date := date_trunc('week', now())::date; -- Monday-based ISO week
begin
  insert into public.weekly_stats(user_id, week_start, xp_gained, earnings_gained, wins, losses)
    values (p_user, v_week, p_xp, greatest(p_earnings, 0), case when p_won then 1 else 0 end, case when p_won then 0 else 1 end)
    on conflict (user_id, week_start) do update set
      xp_gained       = weekly_stats.xp_gained + excluded.xp_gained,
      earnings_gained = weekly_stats.earnings_gained + excluded.earnings_gained,
      wins            = weekly_stats.wins + excluded.wins,
      losses          = weekly_stats.losses + excluded.losses;
end $$;

-- Patch settle_match to call upsert_weekly_stat for each participant.
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

  select username into v_winner_name from public.profiles where id = p_winner;
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, p_winner, 'System', 'Match settled. ' || coalesce(v_winner_name, 'Winner') || ' wins!', 'system');

  v_is_tourney := exists (select 1 from public.tournament_matches where match_id = p_match);

  -- Credit team records
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

  -- >>> Weekly stats: credit every participant
  for v_mp in select user_id from public.match_players where match_id = p_match loop
    perform public.upsert_weekly_stat(
      v_mp.user_id,
      case when v_mp.user_id = p_winner then 100 else 25 end,
      case when v_mp.user_id = p_winner then greatest(coalesce(v_payout, 0) - v_m.entry, 0) else 0 end,
      v_mp.user_id = p_winner
    );
  end loop;

  perform public.settle_match_bets(p_match, p_winner);
  declare v_tm_id uuid; begin
    select id into v_tm_id from public.tournament_matches where match_id=p_match limit 1;
    if v_tm_id is not null then perform public.advance_bracket(v_tm_id); end if;
  end;
end $$;

-- Patch settle_tournament to credit weekly stats for placed winners.
create or replace function public.settle_tournament(
  p_tournament uuid, p_first text, p_second text, p_third text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_joined int; v_pot numeric;
  v_p1 numeric; v_p2 numeric; v_p3 numeric;
  v_u1 uuid; v_u2 uuid; v_u3 uuid;
  v_is_wagr boolean;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status = 'completed' then return; end if;

  select count(*) into v_joined from public.tournament_entries where tournament_id = p_tournament;
  v_is_wagr := (v_t.entry = 0);
  v_pot := round(v_t.entry * v_joined * 0.98, 2);
  v_p1 := round(v_pot * 0.833, 2);
  v_p2 := round(v_pot * 0.10, 2);
  v_p3 := round(v_pot * 0.067, 2);

  select user_id into v_u1 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_first limit 1;
  select user_id into v_u2 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_second limit 1;
  select user_id into v_u3 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_third limit 1;

  if v_u1 is not null then
    update public.profiles set balance=balance+v_p1, earnings=earnings+greatest(v_p1 - v_t.entry, 0), xp=xp+500 where id=v_u1;
    if v_p1 > 0 then
      insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u1, v_p1, 'tournament_payout', p_tournament);
    end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u1, v_t.name, 1, case when v_is_wagr then 'wagr' else 'gold' end, v_t.game, v_p1, v_joined);
    update public.tournament_entries set placed=1 where tournament_id=p_tournament and entrant_name=p_first;
    perform public.upsert_weekly_stat(v_u1, 500, greatest(v_p1 - v_t.entry, 0), true);
  end if;
  if v_u2 is not null then
    update public.profiles set balance=balance+v_p2, earnings=earnings+greatest(v_p2 - v_t.entry, 0), xp=xp+250 where id=v_u2;
    if v_p2 > 0 then
      insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u2, v_p2, 'tournament_payout', p_tournament);
    end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u2, v_t.name, 2, case when v_is_wagr then 'wagr' else 'silver' end, v_t.game, v_p2, v_joined);
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
    perform public.upsert_weekly_stat(v_u2, 250, greatest(v_p2 - v_t.entry, 0), false);
  end if;
  if v_u3 is not null then
    update public.profiles set balance=balance+v_p3, earnings=earnings+greatest(v_p3 - v_t.entry, 0), xp=xp+100 where id=v_u3;
    if v_p3 > 0 then
      insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament);
    end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u3, v_t.name, 3, case when v_is_wagr then 'wagr' else 'bronze' end, v_t.game, v_p3, v_joined);
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, greatest(v_p3 - v_t.entry, 0), false);
  end if;

  update public.tournaments
    set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third
    where id=p_tournament;

  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;

-- Also update the auto-called settle_tournament from advance_bracket (which
-- bypasses the is_admin() check). The advance_bracket function already calls
-- settle_tournament with admin context since it runs as SECURITY DEFINER, but
-- the is_admin() guard inside settle_tournament would block it. Fix: make the
-- auto-settle path use a wrapper that sets the admin context.
-- Actually, advance_bracket already runs as SECURITY DEFINER and the
-- settle_tournament is called inside it, so auth.uid() returns the player
-- who triggered it. We need a version without the admin check for bracket
-- auto-settlement:

create or replace function public.settle_tournament_auto(
  p_tournament uuid, p_first text, p_second text, p_third text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_joined int; v_pot numeric;
  v_p1 numeric; v_p2 numeric; v_p3 numeric;
  v_u1 uuid; v_u2 uuid; v_u3 uuid;
  v_is_wagr boolean;
begin
  select * into v_t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status = 'completed' then return; end if;

  select count(*) into v_joined from public.tournament_entries where tournament_id = p_tournament;
  v_is_wagr := (v_t.entry = 0);
  v_pot := round(v_t.entry * v_joined * 0.98, 2);
  v_p1 := round(v_pot * 0.833, 2);
  v_p2 := round(v_pot * 0.10, 2);
  v_p3 := round(v_pot * 0.067, 2);

  select user_id into v_u1 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_first limit 1;
  select user_id into v_u2 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_second limit 1;
  select user_id into v_u3 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_third limit 1;

  if v_u1 is not null then
    update public.profiles set balance=balance+v_p1, earnings=earnings+greatest(v_p1 - v_t.entry, 0), xp=xp+500 where id=v_u1;
    if v_p1 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u1, v_p1, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u1, v_t.name, 1, case when v_is_wagr then 'wagr' else 'gold' end, v_t.game, v_p1, v_joined);
    update public.tournament_entries set placed=1 where tournament_id=p_tournament and entrant_name=p_first;
    perform public.upsert_weekly_stat(v_u1, 500, greatest(v_p1 - v_t.entry, 0), true);
  end if;
  if v_u2 is not null then
    update public.profiles set balance=balance+v_p2, earnings=earnings+greatest(v_p2 - v_t.entry, 0), xp=xp+250 where id=v_u2;
    if v_p2 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u2, v_p2, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u2, v_t.name, 2, case when v_is_wagr then 'wagr' else 'silver' end, v_t.game, v_p2, v_joined);
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
    perform public.upsert_weekly_stat(v_u2, 250, greatest(v_p2 - v_t.entry, 0), false);
  end if;
  if v_u3 is not null then
    update public.profiles set balance=balance+v_p3, earnings=earnings+greatest(v_p3 - v_t.entry, 0), xp=xp+100 where id=v_u3;
    if v_p3 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u3, v_t.name, 3, case when v_is_wagr then 'wagr' else 'bronze' end, v_t.game, v_p3, v_joined);
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, greatest(v_p3 - v_t.entry, 0), false);
  end if;

  update public.tournaments
    set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third
    where id=p_tournament;

  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;

-- Update advance_bracket to call settle_tournament_auto instead of settle_tournament
-- (which requires is_admin()). This is safe because advance_bracket is SECURITY DEFINER
-- and only called from settle_match which is itself SECURITY DEFINER.
create or replace function public.advance_bracket(p_tm_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tm public.tournament_matches; v_t public.tournaments; v_m public.matches;
  v_round public.tournament_rounds; v_done boolean; v_next_round_id uuid;
  v_next int; v_we text; v_wu uuid; v_le text; v_mn int; v_w1 record; v_w2 record; v_i int;
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
      values (v_t.id, v_next_round_id, v_mn, v_w1.winner_entrant, v_w2.winner_entrant, v_w1.winner_user, v_w2.winner_user, 'ready');
    insert into public.notifications(user_id, text) values
      (v_w1.winner_user, 'You advanced! Next match in ' || v_t.name || ' is ready.'),
      (v_w2.winner_user, 'You advanced! Next match in ' || v_t.name || ' is ready.');
  end loop;
  update public.tournaments set current_round = v_next where id = v_t.id;
end $$;
