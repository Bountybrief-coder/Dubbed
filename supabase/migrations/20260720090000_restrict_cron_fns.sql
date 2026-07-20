-- Harden: award_weekly_prizes and auto_settle_report_timeout are cron jobs
-- (pg_cron runs as the DB owner and bypasses EXECUTE grants) and are never
-- called from the client. Revoke EXECUTE from regular users so they can't be
-- triggered on demand via the REST API.
revoke execute on function public.award_weekly_prizes() from public, anon, authenticated;
revoke execute on function public.auto_settle_report_timeout() from public, anon, authenticated;
