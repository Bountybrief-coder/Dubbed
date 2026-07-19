-- Update purchase_with_wallet to credit $1 on WAGR membership purchase
CREATE OR REPLACE FUNCTION public.purchase_with_wallet(p_item text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_price numeric; v_bal numeric; v_pid uuid; v_name text; v_cat text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_price := public.shop_price(p_item);
  IF v_price IS NULL THEN RAISE EXCEPTION 'unknown shop item'; END IF;
  v_name := public.shop_item_name(p_item);
  v_cat  := public.shop_item_category(p_item);

  SELECT balance INTO v_bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_bal < v_price THEN RAISE EXCEPTION 'insufficient wallet balance'; END IF;

  UPDATE public.profiles SET balance = balance - v_price WHERE id = auth.uid();
  INSERT INTO public.wallet_ledger(user_id, delta, reason) VALUES (auth.uid(), -v_price, 'shop_' || p_item);

  INSERT INTO public.shop_purchases(user_id, item_key, item_name, category, price, payment_method, status)
    VALUES (auth.uid(), p_item, v_name, v_cat, v_price, 'wallet', 'completed')
    RETURNING id INTO v_pid;

  IF p_item = 'username_change' THEN
    UPDATE public.profiles SET username_change_tokens = username_change_tokens + 1 WHERE id = auth.uid();
  ELSIF p_item = 'wagr_membership' THEN
    UPDATE public.profiles SET
      wagr_member = true,
      subscription_status = 'active',
      subscription_provider = 'wallet',
      subscription_end = greatest(coalesce(subscription_end, now()), now()) + interval '30 days',
      balance = balance + 1.00
    WHERE id = auth.uid();
    INSERT INTO public.wallet_ledger(user_id, delta, reason) VALUES (auth.uid(), 1.00, 'wagr_monthly_credit');
  ELSIF p_item = 'double_xp_token' THEN
    UPDATE public.profiles SET
      double_xp_active_until = greatest(coalesce(double_xp_active_until, now()), now()) + interval '24 hours'
    WHERE id = auth.uid();
  END IF;

  INSERT INTO public.notifications(user_id, text)
    VALUES (auth.uid(), 'Purchase successful: ' || v_name || ' ($' || to_char(v_price,'FM999990.00') || ').');
  RETURN v_pid;
END $function$;

-- Auto-renew WAGR memberships (called by cron or admin)
-- Charges $7.99 from wallet, extends 30 days, credits $1
CREATE OR REPLACE FUNCTION public.wagr_auto_renew()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_count int := 0;
  v_price numeric := 7.99;
BEGIN
  FOR v_row IN
    SELECT id, balance FROM public.profiles
    WHERE wagr_member = true
      AND subscription_status = 'active'
      AND subscription_provider = 'wallet'
      AND subscription_end <= now()
    FOR UPDATE
  LOOP
    IF v_row.balance >= v_price THEN
      UPDATE public.profiles SET
        balance = balance - v_price + 1.00,
        subscription_end = now() + interval '30 days'
      WHERE id = v_row.id;
      INSERT INTO public.wallet_ledger(user_id, delta, reason) VALUES (v_row.id, -v_price, 'wagr_renewal');
      INSERT INTO public.wallet_ledger(user_id, delta, reason) VALUES (v_row.id, 1.00, 'wagr_monthly_credit');
      INSERT INTO public.shop_purchases(user_id, item_key, item_name, category, price, payment_method, status)
        VALUES (v_row.id, 'wagr_membership', 'WAGR Membership (Renewal)', 'membership', v_price, 'wallet', 'completed');
      INSERT INTO public.notifications(user_id, text)
        VALUES (v_row.id, 'WAGR Membership renewed! $1.00 credit added to your wallet.');
      v_count := v_count + 1;
    ELSE
      UPDATE public.profiles SET
        wagr_member = false,
        subscription_status = 'expired'
      WHERE id = v_row.id;
      INSERT INTO public.notifications(user_id, text)
        VALUES (v_row.id, 'WAGR Membership expired — insufficient wallet balance for renewal.');
    END IF;
  END LOOP;
  RETURN v_count;
END $function$;

GRANT EXECUTE ON FUNCTION public.wagr_auto_renew() TO service_role;
