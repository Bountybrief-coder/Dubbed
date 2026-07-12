# Database Migrations

Run `supabase_setup.sql` in full — it's idempotent (`CREATE IF NOT EXISTS`, `CREATE OR REPLACE`).

If you need to run only the delta from what's new, here's the ordered list of additions
that may be missing from the live DB. Run these in the Supabase SQL Editor in order.

## 1. Profile columns (social + favorites)
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS twitter text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS youtube text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS twitch_username text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorite_game text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorite_mode text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS platform text DEFAULT 'PC + Console';
```

## 1b. Profile update grant (expand to include new columns)
```sql
GRANT UPDATE (avatar_url, activision_id, psn, xbox, region, twitter, youtube, twitch_username, platform, favorite_game, favorite_mode) ON public.profiles TO authenticated;
```

## 2. Match columns (team_name, map, match_number)
```sql
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS map text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_number integer;
```

## 3. Platform constraint update (WWII split ladders)
```sql
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_platform_chk;
ALTER TABLE public.matches ADD CONSTRAINT matches_platform_chk
  CHECK (platform IN ('Console Only','PC Only','PC + Console Mixed','PlayStation Only','Xbox Only')) NOT VALID;
```

## 4. Tournament status enum + maintenance tables
```sql
ALTER TYPE tournament_status ADD VALUE IF NOT EXISTS 'archived';
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS refunded boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.tournament_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  action        text NOT NULL,
  detail        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tlog_tourney_idx ON public.tournament_log(tournament_id, created_at DESC);
```

## 5. Tournament templates + scheduler
```sql
-- Run the tournament_templates and tournament_schedules CREATE TABLE blocks from supabase_setup.sql
-- Then run the run_tournament_scheduler() function
-- Then run tournament_schedule_setup.sql to populate templates
```

## 6. Achievements table
```sql
CREATE TABLE IF NOT EXISTS public.achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon        text NOT NULL DEFAULT 'trophy',
  tier        text NOT NULL DEFAULT 'bronze',
  xp_reward   integer NOT NULL DEFAULT 0,
  earned_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ach_user_idx ON public.achievements(user_id);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements read" ON public.achievements FOR SELECT USING (true);
```

## 7. Missing RPC functions (run these or re-run supabase_setup.sql)
- `mark_all_notifications_read()` — marks all notifications read for caller
- `platform_stats()` — homepage stats (total matches, winnings, open lobbies)
- `get_achievements(uuid)` — returns achievements for a user
- `get_revenue_dashboard()` — admin revenue aggregation
- `admin_revert_match(uuid, text)` — undo match settlement
- `admin_set_match_status(uuid, text, text)` — force match status change
- `tournament_maintenance()` — auto-archive/refund/start tournaments
- `run_tournament_scheduler()` — create tournaments from templates
- `create_match` — updated signature (added p_map, p_veto_ban, p_map_pool)
- `join_match` — updated signature (added p_veto_ban)
- `generate_bracket` — updated signature (added p_auto boolean)

## 8. P2P Bet Offers table + RPCs
```sql
-- Run the bet_offers CREATE TABLE block from supabase_setup.sql
-- Then run all 5 P2P RPCs: create_bet_offer, accept_bet_offer,
-- settle_bet_offer, void_bet_offer, cancel_bet_offer
-- Realtime publication is added automatically
```

## Easiest path
Re-run the entire `supabase_setup.sql` — every statement is idempotent.
Then run `tournament_schedule_setup.sql` to populate tournament templates.

## Cron jobs (set up in Supabase dashboard or via pg_cron)
```sql
SELECT cron.schedule('dubbed-tournament-maintenance', '*/3 * * * *', $$SELECT public.tournament_maintenance()$$);
SELECT cron.schedule('dubbed-tournament-scheduler', '*/2 * * * *', $$SELECT public.run_tournament_scheduler()$$);
SELECT cron.schedule('dubbed-ban-expiry', '*/5 * * * *', $$SELECT public.check_ban_expiry()$$);
```
