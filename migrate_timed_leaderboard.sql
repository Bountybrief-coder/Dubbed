create or replace function public.get_timed_leaderboard(
  p_metric text default 'xp',
  p_since date default (date_trunc('week', now()))::date,
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
begin
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
      ) as rank_pos
    from public.weekly_stats ws
    join public.profiles p on p.id = ws.user_id
    where ws.week_start >= p_since
      and (p_region   is null or p.region   = p_region)
      and (p_platform is null or p.platform = p_platform)
    group by p.id, p.username, p.xp, p.streak, p.region, p.platform,
             p.avatar_url, p.wagr_member, p.verified
    having (p_metric <> 'winpct' or sum(ws.wins + ws.losses) >= 5)
    limit p_limit;
end $$;

create or replace function public.get_my_timed_rank(
  p_metric text default 'xp',
  p_since date default (date_trunc('week', now()))::date,
  p_region text default null,
  p_platform text default null
)
returns table(rank_pos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
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
      where ws.week_start >= p_since
        and (p_region   is null or p.region   = p_region)
        and (p_platform is null or p.platform = p_platform)
      group by ws.user_id
    )
    select rn as rank_pos from ranked where user_id = auth.uid();
end $$;

grant execute on function public.get_timed_leaderboard(text, date, text, text, int) to authenticated;
grant execute on function public.get_my_timed_rank(text, date, text, text) to authenticated;
