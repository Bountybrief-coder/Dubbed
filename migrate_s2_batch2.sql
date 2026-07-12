-- Section 2 batch 2: cancel refund over-pay, WAGR double-credit, create_match ref_id

-- FIX S2-3: respond_match_cancel refunds ALL match_players including roster who never paid.
-- Now refunds only the creator (created_by) and anyone with a match_entry ledger for this match.
-- Also removes status <> 'open' gate — creator should be refunded even if no opponent joined.
create or replace function public.respond_match_cancel(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.match_cancel_requests; v_m public.matches; v_pid uuid;
begin
  select * into v_req from public.match_cancel_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'request already resolved'; end if;
  select * into v_m from public.matches where id = v_req.match_id for update;
  if not (exists (select 1 from public.match_players where match_id=v_m.id and user_id=auth.uid()) or public.is_admin())
    then raise exception 'not authorized'; end if;

  if p_accept then
    update public.match_cancel_requests set status='accepted', resolved_by=auth.uid(), resolved_at=now() where id=p_request;
    if v_m.kind = 'cash' then
      for v_pid in
        select distinct uid from (
          select v_m.created_by as uid
          union
          select wl.user_id from public.wallet_ledger wl
          where wl.reason = 'match_entry' and wl.ref_id = v_m.id
        ) paying where uid is not null
      loop
        update public.profiles set balance = balance + v_m.entry where id = v_pid;
        insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_pid, v_m.entry, 'match_cancel_refund', v_m.id);
      end loop;
    end if;
    update public.matches set status='cancelled' where id=v_m.id;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      values (v_m.id, auth.uid(), 'System', 'Cancellation accepted. Match closed' || (case when v_m.kind='cash' then ' and entries refunded.' else '.' end), 'system');
  else
    update public.match_cancel_requests set status='declined', resolved_by=auth.uid(), resolved_at=now() where id=p_request;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      values (v_m.id, auth.uid(), 'System', 'Cancellation request declined. Match continues.', 'system');
  end if;
end $$;

-- FIX S2-4: sync_subscription double-credits $1 on renewal.
-- Remove the inline $1 credit from sync_subscription — grant_wagr_monthly_credit
-- (called from invoice.paid webhook) handles it with per-month idempotency.
create or replace function public.sync_subscription(
  p_user uuid, p_status text, p_subscription_id text, p_current_period_end timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare v_active boolean; v_was boolean;
begin
  if not (auth.role() = 'service_role' or public.is_admin()) then raise exception 'not authorized'; end if;
  v_active := p_status in ('active','trialing');
  select wagr_member into v_was from public.profiles where id = p_user;

  update public.profiles set
    wagr_member = v_active,
    subscription_status = p_status,
    subscription_provider = 'stripe',
    subscription_id = coalesce(p_subscription_id, subscription_id),
    subscription_end = p_current_period_end
    where id = p_user;

  if v_active and not coalesce(v_was,false) then
    insert into public.notifications(user_id, text) values (p_user, 'WAGR Membership activated. No-fee wagers and perks are live.');
  elsif v_active and coalesce(v_was,false) then
    insert into public.notifications(user_id, text) values (p_user, 'WAGR Membership renewed.');
  elsif not v_active and coalesce(v_was,false) then
    insert into public.notifications(user_id, text) values (p_user, 'Your WAGR Membership has ended. Premium perks were removed.');
  end if;
end $$;
