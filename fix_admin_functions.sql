-- Fix 1: admin_list_withdrawals calls is_admin(uuid) but is_admin() takes no args
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals(p_status text DEFAULT NULL)
RETURNS TABLE(
  id uuid, user_id uuid, username text, amount numeric, fee numeric,
  status text, destination text, provider text, payout_id text, transfer_id text,
  transaction_id text, rejected_reason text, created_at timestamptz,
  processing_at timestamptz, completed_at timestamptz, meta jsonb,
  crypto_wallet_address text, suspended boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
    select w.id, w.user_id, p.username, w.amount, w.fee,
           w.status, w.destination, w.provider, w.payout_id, w.transfer_id,
           w.transaction_id, w.rejected_reason, w.created_at,
           w.processing_at, w.completed_at, w.meta,
           p.crypto_wallet_address, p.suspended
    from public.withdrawal_requests w
    join public.profiles p on p.id = w.user_id
    where (p_status is null or w.status = p_status)
    order by w.created_at desc;
end $$;

-- Fix 2: admin_list_disputes has ambiguous match_id (OUT param vs table column)
-- Qualify all match_id refs with table aliases
CREATE OR REPLACE FUNCTION public.admin_list_disputes(p_status text DEFAULT 'open')
RETURNS TABLE(
  dispute_id uuid, match_id uuid, match_code text, game text, mode text, format text,
  player_a_id uuid, player_a_name text, player_b_id uuid, player_b_name text,
  dispute_reason text, dispute_evidence text, dispute_by_name text,
  tournament_name text, created_at timestamptz, status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
    select d.id, m.id, m.code, m.game, m.mode, m.format,
      (select mp.user_id from public.match_players mp where mp.match_id=m.id order by mp.joined_at limit 1),
      (select pr.username from public.profiles pr where pr.id=(select mp2.user_id from public.match_players mp2 where mp2.match_id=m.id order by mp2.joined_at limit 1)),
      (select mp3.user_id from public.match_players mp3 where mp3.match_id=m.id order by mp3.joined_at desc limit 1),
      (select pr2.username from public.profiles pr2 where pr2.id=(select mp4.user_id from public.match_players mp4 where mp4.match_id=m.id order by mp4.joined_at desc limit 1)),
      d.reason, d.evidence_url,
      (select pr3.username from public.profiles pr3 where pr3.id=d.opened_by),
      (select t.name from public.tournament_matches tm join public.tournaments t on t.id=tm.tournament_id where tm.match_id=m.id limit 1),
      d.created_at, d.status::text
    from public.match_disputes d
    join public.matches m on m.id=d.match_id
    where (p_status = 'all' or d.status::text = p_status)
    order by d.created_at desc;
end $$;
