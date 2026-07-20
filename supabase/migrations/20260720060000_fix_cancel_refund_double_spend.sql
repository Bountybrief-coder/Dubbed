-- SECURITY FIX: repeatable double-refund on match cancel.
-- request/respond_match_cancel never checked match status, and the requester
-- could accept their own request. Since 'match_entry' ledger rows persist after
-- a cancel, a participant could request->self-accept repeatedly on an already
-- cancelled/settled cash match and mint refunds each time.
-- Fix: (1) only request cancel on an active match, (2) block refund once the
-- match is finalized, (3) the opponent (not the requester) must accept.

create or replace function public.request_match_cancel(p_match uuid, p_reason text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid;
begin
  perform public.check_not_banned();
  if not exists (select 1 from public.match_players where match_id = p_match and user_id = auth.uid())
    then raise exception 'not a participant'; end if;
  if (select status from public.matches where id = p_match) not in ('open','live','veto')
    then raise exception 'match is not active'; end if;
  if exists (select 1 from public.tournament_matches where match_id = p_match)
    then raise exception 'Tournament matches cannot be cancelled. Report your result instead.'; end if;
  if exists (select 1 from public.match_cancel_requests where match_id = p_match and status = 'pending')
    then raise exception 'cancel already requested'; end if;
  insert into public.match_cancel_requests(match_id, requested_by, reason)
    values (p_match, auth.uid(), p_reason)
    returning id into v_id;
  insert into public.notifications(user_id, text)
    select mp.user_id, 'Your opponent requested to cancel the match.'
    from public.match_players mp where mp.match_id = p_match and mp.user_id <> auth.uid();
  return v_id;
end $function$;

create or replace function public.respond_match_cancel(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_req public.match_cancel_requests; v_m public.matches; v_pid uuid;
begin
  select * into v_req from public.match_cancel_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'request already resolved'; end if;
  select * into v_m from public.matches where id = v_req.match_id for update;
  if not (exists (select 1 from public.match_players where match_id=v_m.id and user_id=auth.uid()) or public.is_admin())
    then raise exception 'not authorized'; end if;
  -- FIX: the requester cannot accept their own cancel (opponent consent required)
  if auth.uid() = v_req.requested_by and not public.is_admin()
    then raise exception 'the other player must accept the cancellation'; end if;
  -- FIX: never refund a finalized match (blocks repeat refunds)
  if v_m.status in ('settled','cancelled')
    then raise exception 'match is already finalized'; end if;

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
end $function$;
