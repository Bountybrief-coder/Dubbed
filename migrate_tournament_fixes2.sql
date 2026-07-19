-- Tournament fixes part 2:
-- 1. generate_bracket now auto-starts all round 1 non-bye matches
-- 2. Block cancel on tournament matches
-- 3. Fix the stalled test tournament

-- 1. Rebuild generate_bracket to auto-start round 1 matches
create or replace function public.generate_bracket(p_tournament uuid, p_auto boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_count int; v_bracket int; v_rounds int; v_round_id uuid;
  v_seed_a int; v_seed_b int; v_ea record; v_eb record; v_is_bye boolean; v_mn int;
  v_tm_rec record;
begin
  if not p_auto and not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_t from public.tournaments where id = p_tournament for update;
  if v_t.status <> 'upcoming' then raise exception 'tournament already started'; end if;
  if v_t.bracket_generated then raise exception 'bracket already generated'; end if;
  select count(*) into v_count from public.tournament_entries where tournament_id = p_tournament;
  if v_count < 2 then raise exception 'need at least 2 entries'; end if;

  -- Round up to next power of 2
  v_bracket := 1;
  while v_bracket < v_count loop v_bracket := v_bracket * 2; end loop;
  v_rounds := 0;
  declare v_tmp int := v_bracket; begin
    while v_tmp > 1 loop v_rounds := v_rounds + 1; v_tmp := v_tmp / 2; end loop;
  end;

  -- Stable random seeding (one pass)
  create temp table _seeds on commit drop as
    select entrant_name, user_id, row_number() over (order by random()) as seed
    from public.tournament_entries where tournament_id = p_tournament;

  -- Round 1
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

  -- Future rounds (empty placeholders)
  for v_mn in 2..v_rounds loop
    insert into public.tournament_rounds(tournament_id, round_number, round_name, series_format)
      values (p_tournament, v_mn,
        case when v_mn = v_rounds then 'Grand Final' when v_mn = v_rounds-1 then 'Semifinals'
             when v_mn = v_rounds-2 then 'Quarterfinals' else 'Round ' || v_mn end,
        case when v_mn = v_rounds then 'Best of 5' when v_mn >= v_rounds-1 then 'Best of 3' else v_t.series end);
  end loop;

  update public.tournaments set status='live', bracket_generated=true, current_round=1, total_rounds=v_rounds
    where id = p_tournament;

  -- Auto-start all round 1 non-bye matches
  for v_tm_rec in
    select tm.id from public.tournament_matches tm
      join public.tournament_rounds tr on tr.id = tm.round_id
    where tm.tournament_id = p_tournament and tr.round_number = 1
      and tm.status = 'ready'
  loop
    perform public.start_tournament_match(v_tm_rec.id);
  end loop;
end $$;

-- 2. Update cancel match request to block tournament matches
-- We need to check request_match_cancel if it exists
-- Let's add a check in the cancel accept flow
create or replace function public.request_match_cancel(p_match uuid, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.check_not_banned();
  if not exists (select 1 from public.match_players where match_id = p_match and user_id = auth.uid())
    then raise exception 'not a participant'; end if;
  -- Block cancel on tournament matches
  if exists (select 1 from public.tournament_matches where match_id = p_match)
    then raise exception 'Tournament matches cannot be cancelled. Report your result instead.'; end if;
  if exists (select 1 from public.match_cancel_requests where match_id = p_match and status = 'pending')
    then raise exception 'cancel already requested'; end if;
  insert into public.match_cancel_requests(match_id, requested_by, reason)
    values (p_match, auth.uid(), p_reason)
    returning id into v_id;
  insert into public.notifications(user_id, text)
    select mp.user_id, 'Your opponent requested to cancel the match.'
    from public.match_players mp where mp.match_id = p_match and mp.user_id <> auth.uid();
  return v_id;
end $$;

-- 3. Fix the stalled test tournament: restart match #2, start matches #3 and #4
-- First fix match #2: reset the cancelled match back to live with a map
do $$
declare
  v_match_id uuid := 'eaac75dd-7c23-4a97-aff4-505428c4278d';
  v_tm_id uuid := 'e67a7ea3-360d-4c0a-8531-58e03944a36a';
  v_map text;
begin
  v_map := public.random_map_for('Call of Duty: Black Ops 7', 'Hardpoint');
  -- Reopen the cancelled match
  update public.matches set status = 'live', map = v_map where id = v_match_id;
  -- Unstall the tournament match
  update public.tournament_matches set status = 'live' where id = v_tm_id;
end $$;

-- Start matches #3 and #4 that were never started
do $$
declare v_tm record;
begin
  for v_tm in
    select tm.id from public.tournament_matches tm
      join public.tournament_rounds tr on tr.id = tm.round_id
    where tm.tournament_id = '67a92bfc-d052-4cc2-b29c-1171786ed087'
      and tr.round_number = 1
      and tm.status = 'ready'
  loop
    perform public.start_tournament_match(v_tm.id);
  end loop;
end $$;
