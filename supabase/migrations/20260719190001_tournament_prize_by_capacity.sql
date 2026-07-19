-- Tournament prize distribution: tier by CAPACITY (announced bracket size),
-- not by how many teams happened to join.
--
-- Why: the prize split is advertised up front ("top 3 paid") based on the
-- bracket size. Keying the split off live join-count meant a 16-team bracket
-- showed "winner takes all" until it filled, and could pay only 2 places even
-- though 3 were advertised. Now the structure is fixed by capacity:
--   capacity >= 8  -> 80 / 15 / 5   (1st / 2nd / 3rd)
--   capacity  = 4  -> 85 / 15       (1st / 2nd)
--   capacity <= 2  -> 100           (winner takes all)
--
-- Leak guard: the pot is still the real money collected (entry * joined * 0.98).
-- If a placement never materializes (e.g. turnout below the bracket size, so
-- there is no 2nd/3rd team), that share rolls up into the winner so 100% of the
-- pot is always paid out and nothing gets stuck.
--
-- Mirrors the frontend pooledPrize(entry, joined, capacity) in tournamentService.js.

create or replace function public.settle_tournament_auto(p_tournament uuid, p_first text, p_second text, p_third text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_joined int; v_cap int; v_pot numeric;
  v_p1 numeric; v_p2 numeric; v_p3 numeric;
  v_u1 uuid; v_u2 uuid; v_u3 uuid;
  v_team_id uuid; v_member record;
begin
  select * into v_t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status = 'completed' then return; end if;

  select count(*) into v_joined from public.tournament_entries where tournament_id = p_tournament;
  v_cap := coalesce(v_t.capacity, v_joined);
  v_pot := round(v_t.entry * v_joined * 0.98, 2);

  -- Resolve the actual placing teams first so we can roll up any empty places.
  select user_id into v_u1 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_first  limit 1;
  select user_id into v_u2 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_second limit 1;
  select user_id into v_u3 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_third  limit 1;

  -- Split structure is fixed by the announced bracket size (capacity).
  if v_cap >= 8 then
    v_p1 := round(v_pot * 0.80, 2);
    v_p2 := round(v_pot * 0.15, 2);
    v_p3 := round(v_pot * 0.05, 2);
  elsif v_cap >= 4 then
    v_p1 := round(v_pot * 0.85, 2);
    v_p2 := round(v_pot * 0.15, 2);
    v_p3 := 0;
  else
    v_p1 := v_pot; v_p2 := 0; v_p3 := 0;
  end if;

  -- Leak guard: fold unfilled placements into the winner's share.
  if v_u3 is null and v_p3 > 0 then v_p1 := round(v_p1 + v_p3, 2); v_p3 := 0; end if;
  if v_u2 is null and v_p2 > 0 then v_p1 := round(v_p1 + v_p2, 2); v_p2 := 0; end if;

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
  if v_u2 is not null and v_p2 > 0 then
    update public.profiles set balance=balance+v_p2, earnings=earnings+greatest(v_p2 - v_t.entry, 0), xp=xp+250 where id=v_u2;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u2, v_p2, 'tournament_payout', p_tournament);
    if not v_t.wagr_only then
      insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
        values (v_u2, v_t.name, 2, 'silver', v_t.game, v_p2, v_joined);
    end if;
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
    perform public.upsert_weekly_stat(v_u2, 250, greatest(v_p2 - v_t.entry, 0), false);
  elsif v_u2 is not null then
    -- placed but no cash (rolled up / free tournament): still record placement + trophy + xp
    update public.profiles set xp=xp+250 where id=v_u2;
    if not v_t.wagr_only then
      insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
        values (v_u2, v_t.name, 2, 'silver', v_t.game, 0, v_joined);
    end if;
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
    perform public.upsert_weekly_stat(v_u2, 250, 0, false);
  end if;

  -- 3rd place (no trophy for WAGR-only tournaments)
  if v_u3 is not null and v_p3 > 0 then
    update public.profiles set balance=balance+v_p3, earnings=earnings+greatest(v_p3 - v_t.entry, 0), xp=xp+100 where id=v_u3;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament);
    if not v_t.wagr_only then
      insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
        values (v_u3, v_t.name, 3, 'bronze', v_t.game, v_p3, v_joined);
    end if;
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, greatest(v_p3 - v_t.entry, 0), false);
  elsif v_u3 is not null then
    update public.profiles set xp=xp+100 where id=v_u3;
    if not v_t.wagr_only then
      insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
        values (v_u3, v_t.name, 3, 'bronze', v_t.game, 0, v_joined);
    end if;
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, 0, false);
  end if;

  update public.tournaments set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third, completed_at=now() where id=p_tournament;
  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null and v_p2 > 0 then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null and v_p3 > 0 then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;
