-- WAGR-only tournament rules:
-- - Only the winner (1st) gets a WAGR trophy
-- - All teammates of the winner also get WAGR trophies (team tournaments)
-- - No trophies for 2nd or 3rd place
-- Normal tournaments: gold/silver/bronze as usual

create or replace function public.settle_tournament_auto(p_tournament uuid, p_first text, p_second text, p_third text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_joined int; v_pot numeric;
  v_p1 numeric; v_p2 numeric; v_p3 numeric;
  v_u1 uuid; v_u2 uuid; v_u3 uuid;
  v_team_id uuid; v_member record;
begin
  select * into v_t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status = 'completed' then return; end if;
  select count(*) into v_joined from public.tournament_entries where tournament_id = p_tournament;
  v_pot := round(v_t.entry * v_joined * 0.98, 2);
  if v_joined <= 2 then
    v_p1 := v_pot; v_p2 := 0; v_p3 := 0;
  elsif v_joined < 8 then
    v_p1 := round(v_pot * 0.85, 2);
    v_p2 := round(v_pot * 0.15, 2);
    v_p3 := 0;
  else
    v_p1 := round(v_pot * 0.80, 2);
    v_p2 := round(v_pot * 0.15, 2);
    v_p3 := round(v_pot * 0.05, 2);
  end if;

  select user_id into v_u1 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_first limit 1;
  select user_id into v_u2 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_second limit 1;
  select user_id into v_u3 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_third limit 1;

  -- 1st place
  if v_u1 is not null then
    update public.profiles set balance=balance+v_p1, earnings=earnings+greatest(v_p1 - v_t.entry, 0), xp=xp+500 where id=v_u1;
    if v_p1 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u1, v_p1, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u1, v_t.name, 1, case when v_t.wagr_only then 'wagr' else 'gold' end, v_t.game, v_p1, v_joined);
    update public.tournament_entries set placed=1 where tournament_id=p_tournament and entrant_name=p_first;
    perform public.upsert_weekly_stat(v_u1, 500, greatest(v_p1 - v_t.entry, 0), true);

    -- WAGR tournaments: also award WAGR trophies to all teammates of the winner
    if v_t.wagr_only then
      select te.team_id into v_team_id from public.tournament_entries te
        where te.tournament_id = p_tournament and te.user_id = v_u1 and te.team_id is not null;
      if v_team_id is not null then
        for v_member in
          select tm.user_id from public.team_members tm
          where tm.team_id = v_team_id and tm.user_id <> v_u1
        loop
          insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
            values (v_member.user_id, v_t.name, 1, 'wagr', v_t.game, 0, v_joined);
        end loop;
      end if;
    end if;
  end if;

  -- 2nd place (no trophy for WAGR-only tournaments)
  if v_u2 is not null then
    update public.profiles set balance=balance+v_p2, earnings=earnings+greatest(v_p2 - v_t.entry, 0), xp=xp+250 where id=v_u2;
    if v_p2 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u2, v_p2, 'tournament_payout', p_tournament); end if;
    if not v_t.wagr_only then
      insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
        values (v_u2, v_t.name, 2, 'silver', v_t.game, v_p2, v_joined);
    end if;
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
    perform public.upsert_weekly_stat(v_u2, 250, greatest(v_p2 - v_t.entry, 0), false);
  end if;

  -- 3rd place (no trophy for WAGR-only tournaments)
  if v_u3 is not null then
    update public.profiles set balance=balance+v_p3, earnings=earnings+greatest(v_p3 - v_t.entry, 0), xp=xp+100 where id=v_u3;
    if v_p3 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament); end if;
    if not v_t.wagr_only then
      insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
        values (v_u3, v_t.name, 3, 'bronze', v_t.game, v_p3, v_joined);
    end if;
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, greatest(v_p3 - v_t.entry, 0), false);
  end if;

  update public.tournaments set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third, completed_at=now() where id=p_tournament;
  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;
