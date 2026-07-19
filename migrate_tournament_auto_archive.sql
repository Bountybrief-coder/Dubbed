-- Auto-archive completed tournaments after 1 hour
-- They've already paid out trophies/prizes in settle_tournament_auto.
-- After archival they drop off the tournament list.

-- Add 'archived' to tournament_status enum if not already present
do $$ begin
  alter type tournament_status add value if not exists 'archived';
exception when others then null;
end $$;

-- Add completed_at timestamp to track when a tournament finished
alter table public.tournaments add column if not exists completed_at timestamptz;

-- Backfill completed_at for existing completed tournaments (use last match settle time)
update public.tournaments t
set completed_at = coalesce(
  (select max(m.created_at) from public.tournament_matches tm
   join public.matches m on m.id = tm.match_id
   where tm.tournament_id = t.id and tm.status = 'completed'),
  now()
)
where t.status = 'completed' and t.completed_at is null;

-- Update settle_tournament_auto to set completed_at
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
  if v_u3 is not null then
    update public.profiles set balance=balance+v_p3, earnings=earnings+greatest(v_p3 - v_t.entry, 0), xp=xp+100 where id=v_u3;
    if v_p3 > 0 then insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament); end if;
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size) values (v_u3, v_t.name, 3, case when v_is_wagr then 'wagr' else 'bronze' end, v_t.game, v_p3, v_joined);
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
    perform public.upsert_weekly_stat(v_u3, 100, greatest(v_p3 - v_t.entry, 0), false);
  end if;
  update public.tournaments set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third, completed_at=now() where id=p_tournament;
  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;

-- Update tournament_maintenance to auto-archive completed tournaments after 1 hour
create or replace function public.tournament_maintenance()
returns void language plpgsql security definer set search_path = public as $$
declare v_t record; v_entry record; v_count int;
begin
  -- 1. Auto-start: upcoming, past starts_at, >= 2 entries, no bracket yet
  for v_t in
    select t.* from public.tournaments t
    where t.status = 'upcoming'
      and t.starts_at <= now()
      and not t.bracket_generated
      and (select count(*) from public.tournament_entries where tournament_id = t.id) >= 2
    for update skip locked
  loop
    perform public.generate_bracket(v_t.id, true);
    insert into public.tournament_log(tournament_id, action, detail)
      values (v_t.id, 'auto_start',
        'Bracket generated and round 1 matches started automatically at scheduled time.');
  end loop;

  -- 2. Under-filled: upcoming, past starts_at, no bracket (< 2 joined) -> refund + archive
  for v_t in
    select * from public.tournaments
    where status = 'upcoming'
      and starts_at <= now()
      and not bracket_generated
    for update skip locked
  loop
    if not v_t.refunded then
      for v_entry in
        select user_id, paid from public.tournament_entries
        where tournament_id = v_t.id and paid > 0
      loop
        update public.profiles set balance = balance + v_entry.paid where id = v_entry.user_id;
        insert into public.wallet_ledger(user_id, delta, reason, ref_id)
          values (v_entry.user_id, v_entry.paid, 'tournament_refund', v_t.id);
        insert into public.notifications(user_id, text)
          values (v_entry.user_id, v_t.name || ' was cancelled (not enough players). Your $' || v_entry.paid || ' entry has been refunded to your wallet.');
      end loop;
    end if;

    update public.tournaments set status = 'archived', refunded = true where id = v_t.id;
    insert into public.tournament_log(tournament_id, action, detail)
      values (v_t.id, 'auto_archive',
        'Under-filled at start time. ' ||
        (select count(*) from public.tournament_entries where tournament_id = v_t.id) ||
        ' entries refunded.');
  end loop;

  -- 3. Stale legacy: upcoming, no entries, created > 24h ago, no bracket
  for v_t in
    select t.* from public.tournaments t
    where t.status = 'upcoming'
      and t.created_at < now() - interval '24 hours'
      and not t.bracket_generated
      and not exists (select 1 from public.tournament_entries where tournament_id = t.id)
    for update skip locked
  loop
    update public.tournaments set status = 'archived' where id = v_t.id;
    insert into public.tournament_log(tournament_id, action, detail)
      values (v_t.id, 'auto_archive', 'Stale legacy: no entries after 24h.');
  end loop;

  -- 4. Stalled matches: tournament matches live for 2+ hours with no report
  for v_entry in
    select tm.id as tm_id, tm.match_id, t.name as tourney_name
    from public.tournament_matches tm
      join public.tournaments t on t.id = tm.tournament_id
      join public.matches m on m.id = tm.match_id
    where tm.status = 'live'
      and m.status = 'live'
      and m.created_at < now() - interval '2 hours'
    for update of tm skip locked
  loop
    update public.matches set status = 'cancelled' where id = v_entry.match_id;
    update public.tournament_matches set status = 'stalled' where id = v_entry.tm_id;
    insert into public.tournament_log(tournament_id, action, detail)
      select tm.tournament_id, 'stalled_match',
        'Match ' || v_entry.match_id || ' auto-cancelled after 2h with no report.'
      from public.tournament_matches tm where tm.id = v_entry.tm_id;
    insert into public.notifications(user_id, text)
      select mp.user_id, v_entry.tourney_name || ' match was cancelled due to inactivity (2+ hours with no report).'
      from public.match_players mp where mp.match_id = v_entry.match_id;
  end loop;

  -- 5. Auto-archive completed tournaments after 1 hour
  for v_t in
    select * from public.tournaments
    where status = 'completed'
      and completed_at is not null
      and completed_at < now() - interval '1 hour'
    for update skip locked
  loop
    update public.tournaments set status = 'archived' where id = v_t.id;
    insert into public.tournament_log(tournament_id, action, detail)
      values (v_t.id, 'auto_archive_completed',
        'Tournament completed 1+ hour ago. Prizes already paid. Archived from listing.');
  end loop;

  -- 6. Hard-delete archived zero-entry tournaments past start time
  perform public.tournament_cleanup();
end $$;
