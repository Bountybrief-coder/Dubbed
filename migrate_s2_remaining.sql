-- S2-8 fix: grant_shop_item handles all entitlements (not just username_change)
create or replace function public.grant_shop_item(p_user uuid, p_item text, p_stripe_ref text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_price numeric; v_pid uuid; v_name text; v_cat text;
begin
  if not (auth.role() = 'service_role') then raise exception 'service role only'; end if;
  if p_stripe_ref is not null and exists (select 1 from public.shop_purchases where stripe_ref = p_stripe_ref)
    then return null; end if;
  v_price := public.shop_price(p_item);
  if v_price is null then raise exception 'unknown shop item'; end if;
  v_name := public.shop_item_name(p_item);
  v_cat  := public.shop_item_category(p_item);

  insert into public.shop_purchases(user_id, item_key, item_name, category, price, payment_method, status, stripe_ref)
    values (p_user, p_item, v_name, v_cat, v_price, 'stripe', 'completed', p_stripe_ref)
    returning id into v_pid;

  if p_item = 'username_change' then
    update public.profiles set username_change_tokens = username_change_tokens + 1 where id = p_user;
  elsif p_item = 'double_xp_token' then
    update public.profiles set
      double_xp_active_until = greatest(coalesce(double_xp_active_until, now()), now()) + interval '24 hours'
    where id = p_user;
  end if;

  insert into public.notifications(user_id, text)
    values (p_user, 'Purchase successful: ' || v_name || '.');
  return v_pid;
end $$;
