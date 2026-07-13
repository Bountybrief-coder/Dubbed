-- Withdrawal fee: 2% + $0.25 flat per withdrawal.
-- The fee is deducted from the withdrawal amount so the user receives (amount - fee).
-- Idempotent: safe to re-run.

-- §1 — Add fee column to withdrawal_requests
alter table public.withdrawal_requests add column if not exists fee numeric default 0;

-- §2 — Create a helper function for fee calculation (matches frontend logic)
create or replace function public.calc_withdrawal_fee(p_amount numeric)
returns numeric language sql immutable as $$
  select round(p_amount * 0.02 + 0.25, 2);
$$;

-- §3 — Replace request_withdrawal to calculate and store the fee.
-- The full amount is still held from the user's balance; the fee is stored on
-- the request row so the payout Edge Function sends (amount - fee) to Stripe.
create or replace function public.request_withdrawal(p_amount numeric, p_destination text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_id uuid; v_block text; v_dec jsonb; v_auto boolean; v_fee numeric;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.check_rate_limit('withdrawal', 3, 300);
  if p_amount is null or p_amount < 10 then raise exception 'minimum withdrawal is $10'; end if;

  v_fee := public.calc_withdrawal_fee(p_amount);

  v_block := public.withdrawal_block_reason(auth.uid());
  if v_block is not null then raise exception 'cannot withdraw: %', v_block; end if;

  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < p_amount then raise exception 'insufficient available balance'; end if;

  update public.profiles
    set balance = balance - p_amount, pending_balance = pending_balance + p_amount
    where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -p_amount, 'withdrawal_hold');

  insert into public.withdrawal_requests(user_id, amount, fee, destination, provider, status)
    values (auth.uid(), p_amount, v_fee, p_destination, 'stripe', 'pending')
    returning id into v_id;

  v_dec := public.auto_withdrawal_decision(v_id);
  v_auto := (v_dec->>'decision') = 'auto_approve';

  if v_auto then
    update public.withdrawal_requests
      set status = 'processing', processing_at = now(),
          meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
            'auto_approved', true, 'auto_reason', v_dec->>'reason')
      where id = v_id;
    insert into public.notifications(user_id, text)
      values (auth.uid(), 'Withdrawal of $' || to_char(p_amount, 'FM999999990.00') || ' auto-approved — on its way. Fee: $' || to_char(v_fee, 'FM999999990.00'));
  else
    update public.withdrawal_requests
      set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
            'auto_approved', false, 'hold_reason', v_dec->>'reason')
      where id = v_id;
    insert into public.notifications(user_id, text)
      values (auth.uid(), 'Withdrawal of $' || to_char(p_amount, 'FM999999990.00') || ' submitted for review. Fee: $' || to_char(v_fee, 'FM999999990.00'));
  end if;

  return jsonb_build_object('id', v_id, 'auto_approved', v_auto, 'fee', v_fee);
end $$;
