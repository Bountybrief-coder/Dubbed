-- 1) Patch settle_match to upsert game records per player
CREATE OR REPLACE FUNCTION public.settle_match(p_match uuid, p_winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_pot numeric; v_rake numeric; v_payout numeric; v_member boolean;
        v_mp record; v_is_tourney boolean; v_opp_team uuid; v_winner_name text;
BEGIN
  SELECT * INTO v_m FROM public.matches WHERE id = p_match FOR UPDATE;
  IF v_m.status = 'settled' THEN RETURN; END IF;
  IF v_m.kind = 'cash' THEN
    SELECT wagr_member INTO v_member FROM public.profiles WHERE id = p_winner;
    v_pot := v_m.entry * 2;
    v_rake := CASE WHEN coalesce(v_member,false) THEN 0 ELSE round(v_pot * 0.05, 2) END;
    v_payout := v_pot - v_rake;
    UPDATE public.profiles SET balance = balance + v_payout, earnings = earnings + (v_payout - v_m.entry) WHERE id = p_winner;
    INSERT INTO public.wallet_ledger(user_id, delta, reason, ref_id) VALUES (p_winner, v_payout, 'match_payout', p_match);
  END IF;
  UPDATE public.profiles p SET
    xp = xp + CASE WHEN p.id = p_winner THEN 100 ELSE 25 END,
    wins = wins + CASE WHEN p.id = p_winner THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN p.id = p_winner THEN 0 ELSE 1 END,
    streak = CASE WHEN p.id = p_winner THEN streak + 1 ELSE 0 END
  FROM public.match_players mp WHERE mp.match_id = p_match AND mp.user_id = p.id;
  UPDATE public.matches SET status='settled', winner_id=p_winner WHERE id=p_match;

  SELECT username INTO v_winner_name FROM public.profiles WHERE id = p_winner;
  INSERT INTO public.match_messages(match_id, user_id, username, text, kind)
    VALUES (p_match, p_winner, 'System', 'Match settled. ' || coalesce(v_winner_name, 'Winner') || ' wins!', 'system');

  v_is_tourney := EXISTS (SELECT 1 FROM public.tournament_matches WHERE match_id = p_match);

  -- Upsert game records per player
  FOR v_mp IN SELECT user_id FROM public.match_players WHERE match_id = p_match LOOP
    INSERT INTO public.records(user_id, game, format, w, l)
      VALUES (
        v_mp.user_id,
        v_m.game,
        coalesce(v_m.format, 'default'),
        CASE WHEN v_mp.user_id = p_winner THEN 1 ELSE 0 END,
        CASE WHEN v_mp.user_id = p_winner THEN 0 ELSE 1 END
      )
      ON CONFLICT (user_id, game, format) DO UPDATE SET
        w = records.w + excluded.w,
        l = records.l + excluded.l;
  END LOOP;

  -- Credit team records
  FOR v_mp IN SELECT mp.user_id, mp.team_id FROM public.match_players mp WHERE mp.match_id = p_match AND mp.team_id IS NOT NULL LOOP
    SELECT mp2.team_id INTO v_opp_team FROM public.match_players mp2
    WHERE mp2.match_id = p_match AND mp2.team_id <> v_mp.team_id LIMIT 1;

    IF v_mp.user_id = p_winner THEN
      IF v_is_tourney THEN
        UPDATE public.teams SET tourney_wins = tourney_wins + 1,
          xp = xp + 100,
          earnings = earnings + greatest(coalesce(v_payout, 0) - v_m.entry, 0)
        WHERE id = v_mp.team_id;
      ELSE
        UPDATE public.teams SET wins = wins + 1,
          xp = xp + 100,
          earnings = earnings + greatest(coalesce(v_payout, 0) - v_m.entry, 0)
        WHERE id = v_mp.team_id;
      END IF;
      INSERT INTO public.team_match_history(team_id, match_id, result, earnings, xp_earned, opponent_team_id,
        tournament_id)
        VALUES (v_mp.team_id, p_match, 'win', greatest(coalesce(v_payout, 0) - v_m.entry, 0), 100, v_opp_team,
          (SELECT tournament_id FROM public.tournament_matches WHERE match_id = p_match LIMIT 1));
    ELSE
      IF v_is_tourney THEN
        UPDATE public.teams SET tourney_losses = tourney_losses + 1, xp = xp + 25
        WHERE id = v_mp.team_id;
      ELSE
        UPDATE public.teams SET losses = losses + 1, xp = xp + 25
        WHERE id = v_mp.team_id;
      END IF;
      INSERT INTO public.team_match_history(team_id, match_id, result, earnings, xp_earned, opponent_team_id,
        tournament_id)
        VALUES (v_mp.team_id, p_match, 'loss', 0, 25, v_opp_team,
          (SELECT tournament_id FROM public.tournament_matches WHERE match_id = p_match LIMIT 1));
    END IF;
  END LOOP;

  -- Weekly stats: credit every participant
  FOR v_mp IN SELECT user_id FROM public.match_players WHERE match_id = p_match LOOP
    PERFORM public.upsert_weekly_stat(
      v_mp.user_id,
      CASE WHEN v_mp.user_id = p_winner THEN 100 ELSE 25 END,
      CASE WHEN v_mp.user_id = p_winner THEN greatest(coalesce(v_payout, 0) - v_m.entry, 0) ELSE 0 END,
      v_mp.user_id = p_winner
    );
  END LOOP;

  PERFORM public.settle_match_bets(p_match, p_winner);
  DECLARE v_tm_id uuid; BEGIN
    SELECT id INTO v_tm_id FROM public.tournament_matches WHERE match_id=p_match LIMIT 1;
    IF v_tm_id IS NOT NULL THEN PERFORM public.advance_bracket(v_tm_id); END IF;
  END;
END $$;

-- 2) Backfill records from all settled matches
INSERT INTO public.records (user_id, game, format, w, l)
SELECT
  mp.user_id,
  m.game,
  coalesce(m.format, 'default'),
  count(*) FILTER (WHERE m.winner_id = mp.user_id),
  count(*) FILTER (WHERE m.winner_id <> mp.user_id)
FROM public.matches m
JOIN public.match_players mp ON mp.match_id = m.id
WHERE m.status = 'settled'
  AND m.game IS NOT NULL
GROUP BY mp.user_id, m.game, coalesce(m.format, 'default')
ON CONFLICT (user_id, game, format) DO UPDATE SET
  w = excluded.w,
  l = excluded.l;
