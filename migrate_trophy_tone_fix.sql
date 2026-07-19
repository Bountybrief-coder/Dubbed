-- 1. Add wagr_only flag to tournaments
alter table public.tournaments add column if not exists wagr_only boolean not null default false;

-- 2. Fix settle_tournament_auto: use wagr_only flag instead of entry=0
create or replace function public.settle_tournament_auto(p_tournament uuid, p_first text, p_second text, p_third text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_joined int; v_pot numeric;
  v_p1 numeric; v_p2 numeric; v_p3 numeric;
  v_u1 uuid; v_u2 uuid; v_u3 uuid;
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
  if v_u1 is not null then
    update public.profiles set balance=balance+v_p1, earnings=earnings+greatest(v_p1 - v_t.entry, 0), xp=xp+500 where id=v_u1;
    if v_p1 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u1, v_p1, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u1, v_t.name, 1, case when v_t.wagr_only then 'wagr' else 'gold' end, v_t.game, v_p1, v_joined);
    update public.tournament_entries set placed=1 where tournament_id=p_tournament and entrant_name=p_first;
    perform public.upsert_weekly_stat(v_u1, 500, greatest(v_p1 - v_t.entry, 0), true);
  end if;
  if v_u2 is not null then
    update public.profiles set balance=balance+v_p2, earnings=earnings+greatest(v_p2 - v_t.entry, 0), xp=xp+250 where id=v_u2;
    if v_p2 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u2, v_p2, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u2, v_t.name, 2, case when v_t.wagr_only then 'wagr' else 'silver' end, v_t.game, v_p2, v_joined);
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
    perform public.upsert_weekly_stat(v_u2, 250, greatest(v_p2 - v_t.entry, 0), false);
  end if;
  if v_u3 is not null then
    update public.profiles set balance=balance+v_p3, earnings=earnings+greatest(v_p3 - v_t.entry, 0), xp=xp+100 where id=v_u3;
    if v_p3 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u3, v_t.name, 3, case when v_t.wagr_only then 'wagr' else 'bronze' end, v_t.game, v_p3, v_joined);
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, greatest(v_p3 - v_t.entry, 0), false);
  end if;
  update public.tournaments set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third, completed_at=now() where id=p_tournament;
  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;

-- 3. Update admin_create_tournament to accept wagr_only
create or replace function public.admin_create_tournament(
  p_name text, p_game text, p_mode text, p_format text, p_series text,
  p_region text, p_entry numeric, p_capacity int, p_platform text,
  p_skill_tier text, p_starts_at timestamptz, p_weapon_restriction text default null,
  p_host_rule text default 'auto', p_wagr_only boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_region not in ('NA','EU','NA + EU') then raise exception 'Invalid region'; end if;
  insert into public.tournaments(name, game, mode, format, series, region, entry, capacity, platform,
    skill_tier, starts_at, weapon_restriction, host_rule, wagr_only, status)
    values (p_name, p_game, p_mode, p_format, p_series, p_region, p_entry, p_capacity, p_platform,
      p_skill_tier, p_starts_at, p_weapon_restriction, p_host_rule, coalesce(p_wagr_only, false), 'upcoming')
    returning id into v_id;
  insert into public.audit_logs(actor_id, action, target, meta)
    values (auth.uid(), 'create_tournament', v_id::text,
      jsonb_build_object('name', p_name, 'region', p_region, 'entry', p_entry));
  return v_id;
end $$;

-- 4. Fix the test trophies: change wagr -> gold/silver/bronze
update public.trophies set tone = 'gold' where title = 'Test Bracket Preview' and place = '1' and tone = 'wagr';
update public.trophies set tone = 'silver' where title = 'Test Bracket Preview' and place = '2' and tone = 'wagr';
update public.trophies set tone = 'bronze' where title = 'Test Bracket Preview' and place = '3' and tone = 'wagr';
