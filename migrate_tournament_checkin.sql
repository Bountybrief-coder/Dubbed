-- migrate_tournament_checkin.sql
-- Phase 3b: Tournament check-in system. Idempotent — safe to re-run.
-- Players must check in within a time window before the tournament starts.
-- Only checked-in entries are seeded into the bracket; no-shows get refunded.

-- 1. Add checked_in column to tournament_entries
alter table public.tournament_entries add column if not exists checked_in boolean not null default false;
alter table public.tournament_entries add column if not exists checked_in_at timestamptz;

-- 2. Check-in RPC: players confirm attendance within a window
--    Window: opens 15 minutes before starts_at, closes at starts_at.
--    Only the entry owner can check in. Idempotent (re-check-in is a no-op).
create or replace function public.checkin_tournament(p_tournament uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t public.tournaments; v_entry public.tournament_entries;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_t from public.tournaments where id = p_tournament;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status not in ('upcoming', 'registration') then
    raise exception 'tournament is not in registration phase';
  end if;

  -- Window: 15 min before start → start time
  if now() < v_t.starts_at - interval '15 minutes' then
    raise exception 'Check-in opens 15 minutes before start';
  end if;
  if now() > v_t.starts_at then
    raise exception 'Check-in has closed';
  end if;

  select * into v_entry from public.tournament_entries
    where tournament_id = p_tournament and user_id = auth.uid();
  if not found then raise exception 'you are not registered for this tournament'; end if;
  if v_entry.checked_in then return; end if;

  update public.tournament_entries
    set checked_in = true, checked_in_at = now()
    where tournament_id = p_tournament and user_id = auth.uid();
end $$;
grant execute on function public.checkin_tournament(uuid) to authenticated;

-- 3. Modify generate_bracket to only seed checked-in entries and refund no-shows.
create or replace function public.generate_bracket(p_tournament uuid, p_auto boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_count int; v_bracket int; v_rounds int; v_round_id uuid;
  v_seed_a int; v_seed_b int; v_ea record; v_eb record; v_is_bye boolean; v_mn int;
  v_noshow record;
begin
  if not p_auto and not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_t from public.tournaments where id = p_tournament for update;
  if v_t.status <> 'upcoming' then raise exception 'tournament already started'; end if;
  if v_t.bracket_generated then raise exception 'bracket already generated'; end if;

  -- Refund no-shows (registered but not checked in)
  for v_noshow in
    select user_id, paid from public.tournament_entries
    where tournament_id = p_tournament and not checked_in
  loop
    if v_noshow.paid > 0 then
      update public.profiles set balance = balance + v_noshow.paid where id = v_noshow.user_id;
      insert into public.wallet_ledger(user_id, delta, reason, ref_id)
        values (v_noshow.user_id, v_noshow.paid, 'tournament_noshow_refund', p_tournament);
      insert into public.notifications(user_id, text)
        values (v_noshow.user_id, 'You did not check in for ' || v_t.name || '. Entry refunded.');
    end if;
  end loop;
  delete from public.tournament_entries where tournament_id = p_tournament and not checked_in;

  -- Count checked-in entries only
  select count(*) into v_count from public.tournament_entries where tournament_id = p_tournament;
  if v_count < 2 then raise exception 'need at least 2 checked-in entries'; end if;

  v_bracket := 1;
  while v_bracket < v_count loop v_bracket := v_bracket * 2; end loop;
  v_rounds := 0;
  declare v_tmp int := v_bracket; begin
    while v_tmp > 1 loop v_rounds := v_rounds + 1; v_tmp := v_tmp / 2; end loop;
  end;

  create temp table _seeds on commit drop as
    select entrant_name, user_id, row_number() over (order by random()) as seed
    from public.tournament_entries where tournament_id = p_tournament;

  insert into public.tournament_rounds(tournament_id, round_number, round_name, series_format)
    values (p_tournament, 1,
      case v_rounds when 1 then 'Grand Final' when 2 then 'Semifinals' else 'Round 1' end,
      v_t.series)
    returning id into v_round_id;

  v_mn := 0;
  for v_seed_a in 1..(v_bracket / 2) loop
    v_seed_b := v_bracket + 1 - v_seed_a;
    v_is_bye := v_seed_b > v_count;
    select entrant_name, user_id into v_ea from _seeds where seed = v_seed_a;
    if not v_is_bye then select entrant_name, user_id into v_eb from _seeds where seed = v_seed_b; end if;
    v_mn := v_mn + 1;
    insert into public.tournament_matches(tournament_id, round_id, match_number, seed_a, seed_b,
      entrant_a, entrant_b, user_a, user_b, status, winner_entrant, winner_user)
      values (p_tournament, v_round_id, v_mn, v_seed_a, v_seed_b,
        v_ea.entrant_name,
        case when v_is_bye then null else v_eb.entrant_name end,
        v_ea.user_id,
        case when v_is_bye then null else v_eb.user_id end,
        case when v_is_bye then 'bye' else 'ready' end,
        case when v_is_bye then v_ea.entrant_name else null end,
        case when v_is_bye then v_ea.user_id else null end);
  end loop;

  for v_mn in 2..v_rounds loop
    insert into public.tournament_rounds(tournament_id, round_number, round_name, series_format)
      values (p_tournament, v_mn,
        case when v_mn = v_rounds then 'Grand Final' when v_mn = v_rounds-1 then 'Semifinals'
             when v_mn = v_rounds-2 then 'Quarterfinals' else 'Round ' || v_mn end,
        case when v_mn = v_rounds then 'Best of 5' when v_mn >= v_rounds-1 then 'Best of 3' else v_t.series end);
  end loop;

  update public.tournaments set status='live', bracket_generated=true, current_round=1, total_rounds=v_rounds
    where id = p_tournament;
end $$;
