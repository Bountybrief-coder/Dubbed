-- Weekly leaderboard RPCs + automatic prize awards.
-- Already applied to production via CLI. Saved for reference.
-- Idempotent: safe to re-run.

-- §1 — Weekly leaderboard RPC
create or replace function public.get_weekly_leaderboard(
  p_metric text default 'xp',
  p_region text default null,
  p_platform text default null,
  p_limit int default 100
)
returns table(
  id uuid, username text, xp int, wins int, losses int,
  earnings numeric, streak int, region text, platform text,
  avatar_url text, wagr_member boolean, verified boolean, rank_pos bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_week date := date_trunc('week', now())::date;
begin
  return query
    select
      p.id, p.username, p.xp,
      ws.wins, ws.losses,
      ws.earnings_gained as earnings,
      p.streak,
      p.region, p.platform, p.avatar_url, p.wagr_member, p.verified,
      row_number() over (
        order by
          case p_metric
            when 'earnings' then ws.earnings_gained
            when 'winpct'   then case when (ws.wins + ws.losses) >= 5
                                      then ws.wins::numeric / nullif(ws.wins + ws.losses, 0)
                                      else -1 end
            else ws.xp_gained::numeric
          end desc,
          ws.xp_gained desc
      ) as rank_pos
    from public.weekly_stats ws
    join public.profiles p on p.id = ws.user_id
    where ws.week_start = v_week
      and (p_region   is null or p.region   = p_region)
      and (p_platform is null or p.platform = p_platform)
      and (p_metric <> 'winpct' or (ws.wins + ws.losses) >= 5)
    limit p_limit;
end $$;

-- §2 — My weekly rank
create or replace function public.get_my_weekly_rank(
  p_metric text default 'xp',
  p_region text default null,
  p_platform text default null
)
returns table(rank_pos bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_week date := date_trunc('week', now())::date;
begin
  return query
    with ranked as (
      select
        ws.user_id,
        row_number() over (
          order by
            case p_metric
              when 'earnings' then ws.earnings_gained
              else ws.xp_gained::numeric
            end desc,
            ws.xp_gained desc
        ) as rn
      from public.weekly_stats ws
      join public.profiles p on p.id = ws.user_id
      where ws.week_start = v_week
        and (p_region   is null or p.region   = p_region)
        and (p_platform is null or p.platform = p_platform)
    )
    select rn as rank_pos from ranked where user_id = auth.uid();
end $$;

-- §3 — Award weekly prizes (top 3 get credits: $3 / $2 / $1)
create or replace function public.award_weekly_prizes()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_last_week date := (date_trunc('week', now()) - interval '7 days')::date;
  v_prizes numeric[] := array[3.00, 2.00, 1.00];
  v_rec record;
  v_place int := 0;
begin
  if exists (select 1 from public.weekly_rewards where week_start = v_last_week) then
    return;
  end if;

  for v_rec in
    select ws.user_id, ws.xp_gained
    from public.weekly_stats ws
    where ws.week_start = v_last_week
    order by ws.xp_gained desc
    limit 3
  loop
    v_place := v_place + 1;
    if v_rec.xp_gained <= 0 then continue; end if;

    insert into public.weekly_rewards(user_id, week_start, credits)
      values (v_rec.user_id, v_last_week, v_prizes[v_place]);

    update public.profiles set balance = balance + v_prizes[v_place] where id = v_rec.user_id;
    insert into public.wallet_ledger(user_id, delta, reason)
      values (v_rec.user_id, v_prizes[v_place], 'weekly_reward');

    insert into public.notifications(user_id, text)
      values (v_rec.user_id,
        'You placed #' || v_place || ' on last week''s leaderboard! $' ||
        to_char(v_prizes[v_place], 'FM0.00') || ' credited to your wallet.');
  end loop;
end $$;

-- §4 — Schedule weekly prize cron (Monday 00:05 UTC)
select cron.unschedule('award-weekly-prizes')
  where exists (select 1 from cron.job where jobname = 'award-weekly-prizes');

select cron.schedule(
  'award-weekly-prizes',
  '5 0 * * 1',
  $$select public.award_weekly_prizes()$$
);

-- §5 — Grant execute
grant execute on function public.get_weekly_leaderboard(text, text, text, int) to authenticated;
grant execute on function public.get_my_weekly_rank(text, text, text) to authenticated;
