-- migrate_wagr_cron.sql
-- Sets up pg_cron to auto-renew WAGR memberships daily at midnight UTC.
-- Idempotent: safe to run multiple times.

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Grant usage so cron can invoke functions in public schema
GRANT USAGE ON SCHEMA cron TO postgres;

-- 3. Remove any existing job with this name (idempotent)
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'wagr-auto-renew';

-- 4. Schedule daily at midnight UTC
SELECT cron.schedule(
  'wagr-auto-renew',
  '0 0 * * *',
  $$SELECT public.wagr_auto_renew()$$
);
