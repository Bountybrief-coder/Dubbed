-- Add chat auto-delete (4hr) + settled side bet cleanup to maintenance

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

  -- 7. Auto-delete global chat messages older than 4 hours
  delete from public.chat_messages
  where created_at < now() - interval '4 hours';

  -- 8. Auto-delete settled/void side bets (keep for 1 hour after settlement for history viewing)
  delete from public.side_bets
  where status in ('won', 'lost', 'void')
    and settled_at is not null
    and settled_at < now() - interval '1 hour';

  -- 9. Auto-delete settled/void bet events (after all their bets are cleaned)
  delete from public.bet_events
  where status in ('settled', 'void')
    and settled_at is not null
    and settled_at < now() - interval '1 hour'
    and not exists (select 1 from public.side_bets where event_id = bet_events.id);

  -- 10. Auto-delete settled/void P2P bet offers
  delete from public.bet_offers
  where status in ('settled', 'void')
    and settled_at is not null
    and settled_at < now() - interval '1 hour';
end $$;
