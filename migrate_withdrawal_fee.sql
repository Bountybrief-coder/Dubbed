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

-- §3 — IMPORTANT: You must manually update your existing request_withdrawal RPC
-- to deduct the fee. Find the function in Supabase SQL Editor (search for
-- "request_withdrawal") and add these lines AFTER the balance deduction:
--
--   v_fee := public.calc_withdrawal_fee(p_amount);
--   -- Store the fee on the request row
--   -- (add v_fee numeric to the declare block)
--   -- Then when inserting into withdrawal_requests, set fee = v_fee
--   -- And the actual payout amount sent to Stripe = p_amount - v_fee
--   -- The fee stays in the platform's balance (not returned to user)
--
-- See DASHBOARD_STEPS.md for the exact patch instructions.
