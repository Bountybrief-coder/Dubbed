-- Auto-win on report timeout: if one player reports and the opponent
-- doesn't respond within 2 hours, the reported result auto-stands.
-- Uses pg_cron to run every 15 minutes.
-- Idempotent: safe to re-run.

-- §1 — The auto-settle function
create or replace function public.auto_settle_report_timeout()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rec record;
begin
  for v_rec in
    select m.id as match_id, r.winner_id, r.reported_by
    from public.matches m
    join public.match_reports r on r.match_id = m.id
    where m.status = 'reported'
      and r.created_at < now() - interval '2 hours'
    group by m.id, r.winner_id, r.reported_by
    having count(*) = 1
  loop
    perform public.settle_match(v_rec.match_id, v_rec.winner_id);

    insert into public.match_messages(match_id, user_id, username, text, kind)
      values (v_rec.match_id, v_rec.reported_by, 'System',
        'Opponent did not respond within 2 hours. Match auto-settled with the reported result.', 'system');

    insert into public.notifications(user_id, text)
      select mp.user_id,
        case when mp.user_id = v_rec.reported_by
          then 'Your match was auto-settled in your favor (opponent timed out).'
          else 'You did not report your match result within 2 hours. The match was auto-settled.'
        end
      from public.match_players mp
      where mp.match_id = v_rec.match_id;
  end loop;
end $$;

-- §2 — Schedule the cron job (every 15 minutes)
-- Unschedule first if it already exists (idempotent)
select cron.unschedule('auto-settle-report-timeout')
  where exists (
    select 1 from cron.job where jobname = 'auto-settle-report-timeout'
  );

select cron.schedule(
  'auto-settle-report-timeout',
  '*/15 * * * *',
  $$select public.auto_settle_report_timeout()$$
);
