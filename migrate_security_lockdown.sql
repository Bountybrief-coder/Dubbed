-- migrate_security_lockdown.sql
-- CRITICAL: Lock down internal functions from direct client access.
-- PostgreSQL grants EXECUTE to PUBLIC by default. Internal helpers called
-- from within SECURITY DEFINER RPCs must NOT be directly callable.
-- Idempotent — safe to re-run. Each REVOKE is wrapped so a missing function
-- doesn't abort the entire migration.

do $$ begin
-- ============================================================================
-- B2: settle_match — internal only (called from report_match, admin_award_match)
-- Any authenticated user could settle any match and name themselves winner.
-- ============================================================================
revoke execute on function public.settle_match(uuid, uuid) from public, anon, authenticated;
exception when undefined_function then null; end $$;

do $$ begin
-- B3: settle_bet — internal only (called from settle_match_bets)
revoke execute on function public.settle_bet(uuid, bet_status) from public, anon, authenticated;
exception when undefined_function then null; end $$;

do $$ begin
-- B4: settle_tournament_auto — internal only (called from advance_bracket)
revoke execute on function public.settle_tournament_auto(uuid, text, text, text) from public, anon, authenticated;
exception when undefined_function then null; end $$;

-- Additional internal helpers that should not be directly callable
do $$ begin revoke execute on function public.settle_match_bets(uuid, uuid) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.advance_bracket(uuid) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.upsert_weekly_stat(uuid, int, numeric, boolean) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.resolve_host(uuid) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.check_not_banned() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.purge_old_rate_limits() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.lock_gamertag_during_match() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.rollover_week() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.run_tournament_scheduler() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.tournament_maintenance() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.expire_wallet_memberships() from public, anon, authenticated; exception when undefined_function then null; end $$;

-- Helpers called from triggers — not for client use
do $$ begin revoke execute on function public.sync_username_lower() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.handle_new_user() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.handle_user_verified() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.match_msg_set_username() from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.purge_old_chat() from public, anon, authenticated; exception when undefined_function then null; end $$;

-- Internal price/name helpers (used inside purchase_with_wallet)
do $$ begin revoke execute on function public.shop_price(text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.shop_item_name(text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.shop_item_category(text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.is_reserved_username(text) from public, anon, authenticated; exception when undefined_function then null; end $$;

-- Service-role-only functions (webhooks, crons)
do $$ begin revoke execute on function public.deposit_from_webhook(uuid, numeric, text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.record_subscription_event(text, text, uuid, jsonb) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.record_payout_event(text, text, text, uuid, jsonb) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.withdrawal_by_ref(text, text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.auto_withdrawal_decision(uuid) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.mark_withdrawal_paid(uuid, text, text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.mark_withdrawal_processing_admin(uuid, uuid) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.sync_stripe_account(uuid, text, boolean, boolean, boolean, text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.grant_shop_item(uuid, text, text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.sync_subscription(uuid, text, text, timestamptz) from public, anon, authenticated; exception when undefined_function then null; end $$;

-- settle_match_admin is called from admin pages (has is_admin gate inside)
-- but restrict to authenticated only (no anon/public)
do $$ begin revoke execute on function public.settle_match_admin(uuid, uuid, text) from public, anon; exception when undefined_function then null; end $$;

-- ============================================================================
-- B5: place_bet — add stake and odds caps
-- Without caps, a user can bet $100 at odds 9999 = $999,900 payout.
-- ============================================================================
create or replace function public.place_bet(p_target text, p_market bet_market, p_stake numeric, p_odds numeric, p_match_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_id uuid;
begin
  perform public.check_not_banned();
  if p_stake <= 0 then raise exception 'stake must be positive'; end if;
  if p_stake > 100 then raise exception 'max bet is $100'; end if;
  if p_odds <= 1 then raise exception 'odds must be greater than 1'; end if;
  if p_odds > 10 then raise exception 'max odds is 10x'; end if;
  if p_match_id is not null and not exists (select 1 from public.matches where id = p_match_id and status in ('open','live'))
    then raise exception 'match not found or not active'; end if;
  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < p_stake then raise exception 'insufficient balance'; end if;
  update public.profiles set balance = balance - p_stake where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -p_stake, 'bet');
  insert into public.bets(user_id, target, market, stake, odds, match_id)
    values (auth.uid(), p_target, p_market, p_stake, p_odds, p_match_id) returning id into v_id;
  return v_id;
end $$;

-- Can-play helpers — lookup functions used inside create_match/join_match
do $$ begin revoke execute on function public.can_play(uuid, text, text, text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.can_play_game(uuid, text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.team_size(text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.format_allowed(text, text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.mode_needs_veto(text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.maps_for_mode(text) from public, anon, authenticated; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.maps_needed(text) from public, anon, authenticated; exception when undefined_function then null; end $$;
