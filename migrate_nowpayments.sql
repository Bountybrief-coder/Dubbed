-- migrate_nowpayments.sql
-- Migrate from Stripe to NOWPayments (crypto payments).
-- Replaces Stripe Connect columns with crypto wallet fields.
-- Adds wallet-based subscription auto-renewal support.
-- Idempotent — safe to re-run.

-- ============================================================================
-- 1. Add crypto wallet columns to profiles (replaces 6 Stripe columns)
-- ============================================================================
do $$ begin
  alter table public.profiles add column crypto_wallet_address text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.profiles add column crypto_wallet_currency text default 'usdttrc20';
exception when duplicate_column then null; end $$;

-- ============================================================================
-- 2. Update withdrawal_requests default provider
-- ============================================================================
do $$ begin
  alter table public.withdrawal_requests alter column provider set default 'nowpayments';
exception when others then null; end $$;

do $$ begin
  alter table public.payment_events alter column provider set default 'nowpayments';
exception when others then null; end $$;

do $$ begin
  alter table public.payout_events alter column provider set default 'nowpayments';
exception when others then null; end $$;

-- ============================================================================
-- 3. Update withdrawal_block_reason to check crypto wallet instead of Stripe
-- ============================================================================
create or replace function public.withdrawal_block_reason(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_profile record;
  v_pending int;
  v_unsettled int;
begin
  select suspended, crypto_wallet_address, wagr_member
  into v_profile from public.profiles where id = p_user;

  if v_profile is null then return 'profile not found'; end if;
  if v_profile.suspended then return 'your account is suspended'; end if;
  if v_profile.crypto_wallet_address is null or v_profile.crypto_wallet_address = ''
    then return 'add a crypto wallet address first'; end if;

  select count(*) into v_pending from public.withdrawal_requests
  where user_id = p_user and status in ('pending','processing');
  if v_pending > 0 then return 'you have a pending withdrawal — wait for it to complete'; end if;

  select count(*) into v_unsettled from public.bets
  where user_id = p_user and status = 'open';
  if v_unsettled > 0 then return 'settle your open bets first'; end if;

  return null;
end $$;

-- ============================================================================
-- 4. Update auto_approve_withdrawal to check crypto wallet
-- ============================================================================
create or replace function public.auto_approve_withdrawal(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_profile record;
  v_setting boolean;
  v_amount numeric;
  v_prev_paid int;
begin
  select value into v_setting from public.app_settings where key = 'auto_payouts_enabled';
  if v_setting is not true then return false; end if;

  select crypto_wallet_address, suspended
  into v_profile from public.profiles where id = p_user;
  if v_profile.crypto_wallet_address is null then return false; end if;
  if v_profile.suspended then return false; end if;

  select count(*) into v_prev_paid from public.withdrawal_requests
  where user_id = p_user and status = 'paid';
  if v_prev_paid = 0 then return false; end if;

  return true;
end $$;

-- ============================================================================
-- 5. Update request_withdrawal to use nowpayments provider
-- ============================================================================
create or replace function public.request_withdrawal(p_amount numeric, p_destination text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_block text;
  v_available numeric;
  v_fee numeric;
  v_auto boolean;
  v_id uuid;
begin
  perform public.check_not_banned();
  v_block := public.withdrawal_block_reason(auth.uid());
  if v_block is not null then raise exception '%', v_block; end if;

  v_available := public.available_to_withdraw(auth.uid());
  if p_amount < 5 then raise exception 'minimum withdrawal is $5'; end if;
  if p_amount > v_available then raise exception 'amount exceeds available balance'; end if;

  v_fee := public.calculate_withdrawal_fee(p_amount);
  v_auto := public.auto_approve_withdrawal(auth.uid());

  update public.profiles set balance = balance - p_amount where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -p_amount, 'withdrawal_hold');

  insert into public.withdrawal_requests(user_id, amount, fee, destination, provider, status, meta)
  values (
    auth.uid(), p_amount, v_fee, coalesce(p_destination, 'crypto'), 'nowpayments',
    case when v_auto then 'processing' else 'pending' end,
    jsonb_build_object('auto_approved', v_auto, 'hold_reason',
      case when not v_auto then 'manual review required' else null end)
  ) returning id into v_id;

  if v_auto then
    update public.withdrawal_requests set processing_at = now() where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'auto_approved', v_auto);
end $$;

-- ============================================================================
-- 6. Admin list withdrawals — return crypto wallet instead of Stripe fields
-- ============================================================================
drop function if exists public.admin_list_withdrawals(text);
create or replace function public.admin_list_withdrawals(p_status text default null)
returns table(
  id uuid, user_id uuid, username text, amount numeric, fee numeric,
  status text, destination text, provider text, payout_id text, transfer_id text,
  transaction_id text, rejected_reason text, created_at timestamptz,
  processing_at timestamptz, completed_at timestamptz, meta jsonb,
  crypto_wallet_address text, suspended boolean
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'admin only'; end if;
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

-- ============================================================================
-- 7. Wallet-based subscription: cancel_wagr_membership RPC
-- ============================================================================
create or replace function public.cancel_wagr_membership()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set subscription_status = 'canceled'
  where id = auth.uid() and wagr_member = true;
end $$;

-- ============================================================================
-- 8. Wallet-based subscription: auto-renewal cron function
-- Called by pg_cron daily. Charges wallet for active memberships past their
-- subscription_end date. If balance insufficient, membership lapses.
-- ============================================================================
create or replace function public.renew_wallet_subscriptions()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_price numeric := 4.99;
begin
  for r in
    select id, balance from public.profiles
    where wagr_member = true
      and subscription_status = 'active'
      and subscription_end <= now()
  loop
    if r.balance >= v_price then
      update public.profiles
      set balance = balance - v_price,
          subscription_end = now() + interval '30 days'
      where id = r.id;
      insert into public.wallet_ledger(user_id, delta, reason)
      values (r.id, -v_price, 'shop_wagr_membership');
      insert into public.shop_purchases(user_id, item_key, item_name, category, price, payment_method, status)
      values (r.id, 'wagr_membership', 'WAGR Membership (renewal)', 'membership', v_price, 'wallet', 'completed');
      perform public.grant_wagr_monthly_credit(r.id);
    else
      update public.profiles
      set wagr_member = false, subscription_status = 'lapsed'
      where id = r.id;
    end if;
  end loop;
end $$;

-- Revoke direct access to internal renewal function
do $$ begin
  revoke execute on function public.renew_wallet_subscriptions() from public, anon, authenticated;
exception when undefined_function then null; end $$;

-- ============================================================================
-- 9. RLS: allow users to update their own crypto wallet columns
-- ============================================================================
do $$ begin
  drop policy if exists "Users can update own crypto wallet" on public.profiles;
exception when others then null; end $$;

create policy "Users can update own crypto wallet" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================================
-- 10. Grant execute on new user-facing RPCs
-- ============================================================================
grant execute on function public.cancel_wagr_membership() to authenticated;
grant execute on function public.withdrawal_block_reason(uuid) to authenticated;
