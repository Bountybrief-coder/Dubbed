-- migrate_prod_audit.sql
-- Production audit fixes (Phase 2/3 blockers). Idempotent — safe to re-run.
-- Run AFTER supabase_setup.sql and all prior migrations.

-- ============================================================================
-- B2: Add CHECK constraint — balance can never go negative
-- ============================================================================
do $$ begin
  alter table public.profiles add constraint balance_non_negative check (balance >= 0);
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- B1: Fix tournament prize split — backend must match frontend pooledPrize()
-- Frontend: ≤2 teams → 100/0/0, 3-7 teams → 85/15/0, 8+ → 80/15/5
-- Both settle_tournament and settle_tournament_auto use the same logic.
-- ============================================================================
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
    if v_p2 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u2, v_p2, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u2, v_t.name, 2, case when v_is_wagr then 'wagr' else 'silver' end, v_t.game, v_p2, v_joined);
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
    perform public.upsert_weekly_stat(v_u2, 250, greatest(v_p2 - v_t.entry, 0), false);
  end if;
  if v_u3 is not null and v_p3 > 0 then
    update public.profiles set balance=balance+v_p3, earnings=earnings+greatest(v_p3 - v_t.entry, 0), xp=xp+100 where id=v_u3;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament);
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u3, v_t.name, 3, case when v_is_wagr then 'wagr' else 'bronze' end, v_t.game, v_p3, v_joined);
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, greatest(v_p3 - v_t.entry, 0), false);
  end if;

  update public.tournaments
    set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third
    where id=p_tournament;

  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null and v_p2 > 0 then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null and v_p3 > 0 then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;

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
  if v_u1 is not null then
    update public.profiles set balance=balance+v_p1, earnings=earnings+greatest(v_p1 - v_t.entry, 0), xp=xp+500 where id=v_u1;
    if v_p1 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u1, v_p1, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size) values (v_u1, v_t.name, 1, case when v_is_wagr then 'wagr' else 'gold' end, v_t.game, v_p1, v_joined);
    update public.tournament_entries set placed=1 where tournament_id=p_tournament and entrant_name=p_first;
    perform public.upsert_weekly_stat(v_u1, 500, greatest(v_p1 - v_t.entry, 0), true);
  end if;
  if v_u2 is not null then
    update public.profiles set balance=balance+v_p2, earnings=earnings+greatest(v_p2 - v_t.entry, 0), xp=xp+250 where id=v_u2;
    if v_p2 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u2, v_p2, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size) values (v_u2, v_t.name, 2, case when v_is_wagr then 'wagr' else 'silver' end, v_t.game, v_p2, v_joined);
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
    perform public.upsert_weekly_stat(v_u2, 250, greatest(v_p2 - v_t.entry, 0), false);
  end if;
  if v_u3 is not null and v_p3 > 0 then
    update public.profiles set balance=balance+v_p3, earnings=earnings+greatest(v_p3 - v_t.entry, 0), xp=xp+100 where id=v_u3;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament);
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size) values (v_u3, v_t.name, 3, case when v_is_wagr then 'wagr' else 'bronze' end, v_t.game, v_p3, v_joined);
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, greatest(v_p3 - v_t.entry, 0), false);
  end if;
  update public.tournaments set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third where id=p_tournament;
  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null and v_p2 > 0 then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null and v_p3 > 0 then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;

-- ============================================================================
-- B3: Revoke direct deposit RPC from authenticated (production: Stripe webhook only)
-- ============================================================================
revoke execute on function public.deposit(numeric) from public, anon, authenticated;
