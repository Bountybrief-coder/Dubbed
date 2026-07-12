-- migrate_seasons.sql
-- Seasonal leaderboard system: seasons table, seasonal RPCs, end-season
-- playoff auto-generation, pg_cron daily check.
-- Idempotent — safe to re-run.

-- §1 — Seasons table
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'upcoming' check (status in ('upcoming','active','completed')),
  playoff_tournament_id uuid references public.tournaments(id),
  playoff_size int not null default 8,
  prize_pool numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint seasons_dates_valid check (end_date > start_date)
);

create index if not exists seasons_status_idx on public.seasons(status);
create index if not exists seasons_dates_idx on public.seasons(start_date, end_date);

alter table public.seasons enable row level security;
drop policy if exists "seasons read all" on public.seasons;
create policy "seasons read all" on public.seasons for select using (true);

-- §2 — Get current active season
create or replace function public.get_current_season()
returns table(
  id uuid, name text, start_date date, end_date date, status text,
  playoff_tournament_id uuid, playoff_size int, prize_pool numeric,
  days_remaining int, total_days int, progress_pct numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select
      s.id, s.name, s.start_date, s.end_date, s.status,
      s.playoff_tournament_id, s.playoff_size, s.prize_pool,
      greatest(0, (s.end_date - current_date))::int as days_remaining,
      (s.end_date - s.start_date)::int as total_days,
      round(
        least(1.0, greatest(0.0,
          (current_date - s.start_date)::numeric / nullif((s.end_date - s.start_date)::numeric, 0)
        )) * 100, 1
      ) as progress_pct
    from public.seasons s
    where s.status = 'active'
    order by s.start_date desc
    limit 1;
end $$;

-- §3 — Season leaderboard (aggregates weekly_stats within season date range)
create or replace function public.get_season_leaderboard(
  p_season uuid,
  p_metric text default 'xp',
  p_region text default null,
  p_platform text default null,
  p_limit int default 100
)
returns table(
  id uuid, username text, xp int, wins int, losses int,
  earnings numeric, streak int, region text, platform text,
  avatar_url text, wagr_member boolean, verified boolean, rank_pos bigint,
  season_xp bigint, season_earnings numeric, season_wins bigint, season_losses bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_start date;
  v_end date;
begin
  select s.start_date, s.end_date into v_start, v_end
    from public.seasons s where s.id = p_season;
  if not found then return; end if;

  return query
    select
      p.id, p.username, p.xp,
      sum(ws.wins)::int as wins,
      sum(ws.losses)::int as losses,
      sum(ws.earnings_gained) as earnings,
      p.streak,
      p.region, p.platform, p.avatar_url, p.wagr_member, p.verified,
      row_number() over (
        order by
          case p_metric
            when 'earnings' then sum(ws.earnings_gained)
            when 'winpct'   then case when sum(ws.wins + ws.losses) >= 5
                                      then sum(ws.wins)::numeric / nullif(sum(ws.wins + ws.losses), 0)
                                      else -1 end
            else sum(ws.xp_gained)::numeric
          end desc,
          sum(ws.xp_gained) desc
      ) as rank_pos,
      sum(ws.xp_gained) as season_xp,
      sum(ws.earnings_gained) as season_earnings,
      sum(ws.wins) as season_wins,
      sum(ws.losses) as season_losses
    from public.weekly_stats ws
    join public.profiles p on p.id = ws.user_id
    where ws.week_start >= v_start
      and ws.week_start < v_end
      and (p_region   is null or p.region   = p_region)
      and (p_platform is null or p.platform = p_platform)
    group by p.id, p.username, p.xp, p.streak, p.region, p.platform,
             p.avatar_url, p.wagr_member, p.verified
    having (p_metric <> 'winpct' or sum(ws.wins + ws.losses) >= 5)
    limit p_limit;
end $$;

-- §4 — My season rank
create or replace function public.get_my_season_rank(
  p_season uuid,
  p_metric text default 'xp'
)
returns table(rank_pos bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_start date;
  v_end date;
begin
  select s.start_date, s.end_date into v_start, v_end
    from public.seasons s where s.id = p_season;
  if not found then return; end if;

  return query
    with ranked as (
      select
        ws.user_id,
        row_number() over (
          order by
            case p_metric
              when 'earnings' then sum(ws.earnings_gained)
              else sum(ws.xp_gained)::numeric
            end desc,
            sum(ws.xp_gained) desc
        ) as rn
      from public.weekly_stats ws
      join public.profiles p on p.id = ws.user_id
      where ws.week_start >= v_start
        and ws.week_start < v_end
      group by ws.user_id
    )
    select rn as rank_pos from ranked where user_id = auth.uid();
end $$;

-- §5 — List all seasons (for history + admin)
create or replace function public.list_seasons()
returns table(
  id uuid, name text, start_date date, end_date date, status text,
  playoff_tournament_id uuid, playoff_size int, prize_pool numeric,
  player_count bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select
      s.id, s.name, s.start_date, s.end_date, s.status,
      s.playoff_tournament_id, s.playoff_size, s.prize_pool,
      (select count(distinct ws.user_id) from public.weekly_stats ws
       where ws.week_start >= s.start_date and ws.week_start < s.end_date
      ) as player_count,
      s.created_at
    from public.seasons s
    order by s.start_date desc;
end $$;

-- §6 — Admin: create a season
create or replace function public.admin_create_season(
  p_name text,
  p_start date,
  p_end date,
  p_playoff_size int default 8,
  p_prize_pool numeric default 0
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_status text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_end <= p_start then raise exception 'end date must be after start date'; end if;

  if exists (
    select 1 from public.seasons
    where status in ('upcoming','active')
      and daterange(start_date, end_date) && daterange(p_start, p_end)
  ) then
    raise exception 'overlaps with an existing season';
  end if;

  v_status := case when p_start <= current_date then 'active' else 'upcoming' end;

  insert into public.seasons(name, start_date, end_date, status, playoff_size, prize_pool)
    values (p_name, p_start, p_end, v_status, p_playoff_size, p_prize_pool)
    returning id into v_id;
  return v_id;
end $$;

-- §7 — End season: finalize + auto-create playoff tournament from top N
create or replace function public.end_season(p_season uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_s public.seasons;
  v_tourney_id uuid;
  v_rec record;
  v_count int := 0;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  select * into v_s from public.seasons where id = p_season for update;
  if not found then raise exception 'season not found'; end if;
  if v_s.status = 'completed' then return v_s.playoff_tournament_id; end if;

  -- Create playoff tournament
  insert into public.tournaments(
    name, game, mode, format, entry, capacity, region,
    starts_at, status, platform, series
  ) values (
    v_s.name || ' Playoffs',
    'bo7', 'ranked', 'elimination', 0, v_s.playoff_size, null,
    now() + interval '1 day', 'upcoming', null, 'bo3'
  ) returning id into v_tourney_id;

  -- Enroll top N by XP into the playoff
  for v_rec in
    select ws.user_id, p.username
    from public.weekly_stats ws
    join public.profiles p on p.id = ws.user_id
    where ws.week_start >= v_s.start_date
      and ws.week_start < v_s.end_date
    group by ws.user_id, p.username
    order by sum(ws.xp_gained) desc
    limit v_s.playoff_size
  loop
    v_count := v_count + 1;
    insert into public.tournament_entries(tournament_id, user_id, entrant_name, paid)
      values (v_tourney_id, v_rec.user_id, v_rec.username, true);

    insert into public.notifications(user_id, text)
      values (v_rec.user_id,
        'You qualified for the ' || v_s.name || ' Playoffs! You finished top ' ||
        v_s.playoff_size || ' in the season standings.');
  end loop;

  update public.seasons
    set status = 'completed', playoff_tournament_id = v_tourney_id
    where id = p_season;

  return v_tourney_id;
end $$;

-- §8 — Daily cron: auto-activate upcoming seasons, auto-end expired ones
create or replace function public.check_season_transitions()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rec record;
begin
  -- Activate upcoming seasons whose start_date has arrived
  update public.seasons
    set status = 'active'
    where status = 'upcoming' and start_date <= current_date;

  -- Note: we do NOT auto-end seasons — admin triggers end_season() manually
  -- so they can review standings before playoff creation. But we do mark them
  -- as needing attention via notifications to admin.
  for v_rec in
    select id, name from public.seasons
    where status = 'active' and end_date <= current_date
  loop
    -- Notify admin that season has expired and needs manual end
    insert into public.notifications(user_id, text)
      select id, 'Season "' || v_rec.name || '" has ended. Go to Admin > Seasons to finalize playoffs.'
      from public.profiles where is_admin = true
    on conflict do nothing;
  end loop;
end $$;

-- Schedule daily check at 00:15 UTC
select cron.unschedule('check-season-transitions')
  where exists (select 1 from cron.job where jobname = 'check-season-transitions');

select cron.schedule(
  'check-season-transitions',
  '15 0 * * *',
  $$select public.check_season_transitions()$$
);

-- §9 — Grants
grant execute on function public.get_current_season() to authenticated;
grant execute on function public.get_season_leaderboard(uuid, text, text, text, int) to authenticated;
grant execute on function public.get_my_season_rank(uuid, text) to authenticated;
grant execute on function public.list_seasons() to authenticated;
grant execute on function public.admin_create_season(text, date, date, int, numeric) to authenticated;
grant execute on function public.end_season(uuid) to authenticated;
