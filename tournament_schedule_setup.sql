-- ============================================================================
-- DUBBED TOURNAMENT SCHEDULE SETUP
-- Creates templates + schedules for the full daily rotation
-- ============================================================================

-- ============================================================================
-- 1. INSERT TOURNAMENT TEMPLATES (from TOURNAMENT_ROTATION presets)
--    daily_times uses ET (America/New_York) — converted from UTC schedule hours
-- ============================================================================

-- SND tournaments
INSERT INTO public.tournament_templates
  (title, game, mode, format, team_size, entry_fee, region, platform, series,
   max_entries, min_entries, recurrence, daily_times, schedule_tz, reg_open_minutes,
   registration_minutes, lead_minutes, enabled)
VALUES
  -- daily-snd-4v4-na-10: UTC 0 = ET 20:00
  ('Daily 4v4 SND BO1 — NA Only',
   'Call of Duty: Black Ops 7', 'Search & Destroy', '4v4', 4, 10.00,
   'NA', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['20:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-snd-4v4-naeu-10: UTC 19 = ET 15:00
  ('Daily 4v4 SND BO1 — NA + EU',
   'Call of Duty: Black Ops 7', 'Search & Destroy', '4v4', 4, 10.00,
   'NA + EU', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['15:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-snd-2v2-na-5: UTC 22 = ET 18:00
  ('Daily 2v2 SND BO1 — NA Only',
   'Call of Duty: Black Ops 7', 'Search & Destroy', '2v2', 2, 5.00,
   'NA', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['18:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-snd-1v1-na-5: UTC 1 = ET 21:00
  ('Daily 1v1 SND — NA Only',
   'Call of Duty: Black Ops 7', 'Search & Destroy', '1v1', 1, 5.00,
   'NA', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['21:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-snd-1v1-naeu-5: UTC 20 = ET 16:00
  ('Daily 1v1 SND — NA + EU',
   'Call of Duty: Black Ops 7', 'Search & Destroy', '1v1', 1, 5.00,
   'NA + EU', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['16:00'], 'America/New_York', 45, 60, 10, true),

  -- weekend-snd-4v4-na-25: UTC 23 = ET 19:00 (weekend only — handled via daily_times, admin can toggle)
  ('Weekend 4v4 SND BO3 — NA Only',
   'Call of Duty: Black Ops 7', 'Search & Destroy', '4v4', 4, 25.00,
   'NA', 'PC + Console Mixed', 'Best of 3',
   32, 2, 'daily', ARRAY['19:00'], 'America/New_York', 45, 60, 10, true),

  -- Hardpoint tournaments
  -- daily-hp-4v4-na-10: UTC 23 = ET 19:00
  ('Daily 4v4 Hardpoint — NA Only',
   'Call of Duty: Black Ops 7', 'Hardpoint', '4v4', 4, 10.00,
   'NA', 'PC + Console Mixed', 'Best of 3',
   16, 2, 'daily', ARRAY['19:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-hp-4v4-naeu-10: UTC 20 = ET 16:00
  ('Daily 4v4 Hardpoint — NA + EU',
   'Call of Duty: Black Ops 7', 'Hardpoint', '4v4', 4, 10.00,
   'NA + EU', 'PC + Console Mixed', 'Best of 3',
   8, 2, 'daily', ARRAY['16:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-hp-2v2-na-5: UTC 2 = ET 22:00
  ('Daily 2v2 Hardpoint — NA Only',
   'Call of Duty: Black Ops 7', 'Hardpoint', '2v2', 2, 5.00,
   'NA', 'PC + Console Mixed', 'Best of 3',
   16, 2, 'daily', ARRAY['22:00'], 'America/New_York', 45, 60, 10, true),

  -- Warzone Resurgence tournaments
  -- daily-wz-res-2v2-na-5: UTC 1 = ET 21:00
  ('Daily 2v2 Resurgence Kill Race — NA Only',
   'Warzone', 'Resurgence Kill Race', '2v2', 2, 5.00,
   'NA', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['21:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-wz-res-2v2-naeu-5: UTC 21 = ET 17:00
  ('Daily 2v2 Resurgence Kill Race — NA + EU',
   'Warzone', 'Resurgence Kill Race', '2v2', 2, 5.00,
   'NA + EU', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['17:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-wz-res-1v1-na-5: UTC 0 = ET 20:00
  ('Daily 1v1 Resurgence Kill Race — NA Only',
   'Warzone', 'Resurgence Kill Race', '1v1', 1, 5.00,
   'NA', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['20:00'], 'America/New_York', 45, 60, 10, true),

  -- Black Ops Royale tournaments
  -- daily-bor-2v2-na-5: UTC 2 = ET 22:00
  ('Daily 2v2 Black Ops Royale Kill Race — NA Only',
   'Black Ops Royale', 'Kill Race', '2v2', 2, 5.00,
   'NA', 'PC + Console Mixed', 'Best of 1',
   8, 2, 'daily', ARRAY['22:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-bor-2v2-naeu-5: UTC 21 = ET 17:00
  ('Daily 2v2 Black Ops Royale Kill Race — NA + EU',
   'Black Ops Royale', 'Kill Race', '2v2', 2, 5.00,
   'NA + EU', 'PC + Console Mixed', 'Best of 1',
   8, 2, 'daily', ARRAY['17:00'], 'America/New_York', 45, 60, 10, true),

  -- daily-bor-1v1-na-5: UTC 23 = ET 19:00
  ('Daily 1v1 Black Ops Royale Survival — NA Only',
   'Black Ops Royale', 'Survival', '1v1', 1, 5.00,
   'NA', 'PC + Console Mixed', 'Best of 1',
   16, 2, 'daily', ARRAY['19:00'], 'America/New_York', 45, 60, 10, true)
;

-- ============================================================================
-- 2. CREATE SCHEDULE ENTRIES FOR EACH TEMPLATE
-- ============================================================================

INSERT INTO public.tournament_schedules (template_id, active, next_run_at)
SELECT id, true, now()
FROM public.tournament_templates
WHERE enabled = true
ON CONFLICT (template_id) DO UPDATE SET active = true, updated_at = now();

-- ============================================================================
-- 3. SET UP CRON JOB — run scheduler every 2 minutes
-- ============================================================================

SELECT cron.schedule(
  'dubbed-tournament-scheduler',
  '*/2 * * * *',
  $$SELECT public.run_tournament_scheduler()$$
);

-- ============================================================================
-- 4. ALSO ADD A BAN EXPIRY CRON — check every 5 minutes
-- ============================================================================

SELECT cron.schedule(
  'dubbed-ban-expiry',
  '*/5 * * * *',
  $$SELECT public.check_ban_expiry()$$
);
