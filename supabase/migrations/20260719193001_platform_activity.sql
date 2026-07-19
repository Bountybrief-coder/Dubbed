-- Live activity feed for the homepage "pulse".
-- SECURITY DEFINER so it can read the (private) wallet_ledger and return only
-- public-safe fields: username, avatar, amount, game — never user ids.

create index if not exists wl_activity_idx on public.wallet_ledger (created_at desc);

create or replace function public.platform_activity(p_limit int default 20)
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) - 'sort_at'), '[]'::jsonb)
  from (
    -- Recent wins (match / tournament / side-bet payouts)
    select * from (
      select 'win'::text as kind, p.username as actor, p.avatar_url as avatar,
             wm.game as game, l.delta as amount,
             case l.reason
               when 'tournament_payout' then 'tournament'
               when 'match_payout' then coalesce(wm.format, 'match')
               else 'bet' end as sub,
             l.created_at as at, null::timestamptz as starts, l.created_at as sort_at
      from public.wallet_ledger l
      join public.profiles p on p.id = l.user_id
      left join public.matches wm on l.reason = 'match_payout' and wm.id = l.ref_id
      where l.reason in ('match_payout','tournament_payout','bet_offer_payout','side_bet_payout')
        and l.delta > 0
      order by l.created_at desc
      limit p_limit
    ) wins
    union all
    -- New open lobbies
    select * from (
      select 'lobby'::text, p.username, p.avatar_url,
             m.game, m.entry, m.format,
             m.created_at, null::timestamptz, m.created_at
      from public.matches m
      join public.profiles p on p.id = m.created_by
      where m.status = 'open'
      order by m.created_at desc
      limit p_limit
    ) lobbies
    union all
    -- Tournaments open for registration / starting soon
    select * from (
      select 'tournament'::text, null::text, null::text,
             t.game, t.entry, t.name,
             now(), t.starts_at, now()
      from public.tournaments t
      where t.status in ('upcoming','registration','starting')
        and t.starts_at > now() and t.starts_at < now() + interval '12 hours'
      order by t.starts_at asc
      limit 4
    ) tourneys
    order by sort_at desc
    limit p_limit
  ) x;
$$;

grant execute on function public.platform_activity(int) to anon, authenticated;
