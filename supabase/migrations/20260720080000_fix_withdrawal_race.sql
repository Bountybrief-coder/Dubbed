-- SECURITY FIX: TOCTOU race in request_withdrawal. It read available balance
-- via available_to_withdraw() with no row lock, so two concurrent withdrawals
-- could both pass the "amount exceeds available" check before either deducted,
-- driving balance negative / over-withdrawing. Every other money function locks
-- the balance row FOR UPDATE first; do the same here.
create or replace function public.request_withdrawal(p_amount numeric, p_destination text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_block text;
  v_bal numeric;
  v_available numeric;
  v_fee numeric;
  v_auto boolean;
  v_id uuid;
begin
  perform public.check_not_banned();
  v_block := public.withdrawal_block_reason(auth.uid());
  if v_block is not null then raise exception '%', v_block; end if;

  -- Lock the balance row so concurrent withdrawals serialize.
  select balance into v_bal from public.profiles where id = auth.uid() for update;
  v_available := greatest(0, coalesce(v_bal, 0));
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
end $function$;
