# Match Layout — Remaining TODOs

## Reporting
- [ ] Wire Supabase Storage upload for evidence (currently text URL input only)
- [ ] Implement 2-hour auto-accept timer server-side (currently documented as
      a rule but not enforced — needs a cron/pg_cron job or edge function)
- [ ] Per-map score validation (ensure scores are numeric, reject obviously
      wrong entries like "6-4" on a Hardpoint map)

## Host Table
- [ ] Map 3 host auto-resolve after Maps 1–2 scores are submitted (currently
      shows "TBD" — needs the reported scores parsed and compared)
- [ ] Surface host assignment in real-time as veto completes

## Chat Dock
- [ ] "No Show" button should start a countdown timer visible to both teams
- [ ] "Request Admin" should create a record in a support queue table (not
      just a chat message) so admins see it in their dashboard
- [ ] Rate-limit system messages to prevent spam

## Tournament Context
- [ ] "Back to bracket" should preserve scroll position to the clicked node
- [ ] Show bracket advancement preview after reporting in a tournament match

## Side Bets
- [ ] Build a bet placement UI (currently only the RPC + service exist)
- [ ] Show active bets in the match room sidebar
- [ ] Bet history page in user profile

## Leaderboard — Weekly Stats Wiring
- [ ] In `settle_match`: UPSERT into `weekly_stats` for each participant
      (xp_gained ± 100/25, wins/losses ± 1, earnings_gained for winner).
      Week start = `date_trunc('week', now())::date` (ISO weeks start Monday;
      adjust to Sunday if needed).
- [ ] In `settle_tournament`: UPSERT into `weekly_stats` for placed players
      (xp_gained + 500/250/100, earnings_gained).
- [ ] Set up `pg_cron` or Supabase scheduled function to call `rollover_week()`
      every Sunday at 00:00 UTC.
- [ ] After wiring, remove the "Weekly tracking coming soon" stub in
      `LeaderboardPage.jsx` and enable the weekly scope to query `weekly_stats`.
- [ ] Re-run `supabase_setup.sql` to create `weekly_stats`, `weekly_rewards`
      tables, `get_leaderboard`/`get_my_rank`/`rollover_week` functions, and
      new indexes on `profiles(earnings desc)` / `profiles(streak desc)`.

## Part B (v14)
- [ ] Ledger integrity checks (double-entry audit)
- [ ] Anti-fraud system
- [ ] Dispute management dashboard
- [ ] Realtime match status updates (beyond current Supabase subscriptions)
- [ ] Leaderboards page
- [ ] Onboarding flow
- [ ] Mobile / accessibility pass
- [ ] Rules-as-data (move hardcoded rules to DB/config)

## Linked-Account Verification
- [ ] Live Activision ID verification via Activision API (currently format-only)
- [ ] Live PSN / Xbox gamertag verification via Sony/Microsoft APIs
- [ ] Periodic re-validation of linked accounts (detect renamed/deleted tags)

## SQL Migration Notes
- Re-run `supabase_setup.sql` to apply: `activision_id` column addition,
  `can_play_game` function, and updated `create_match`/`join_match` gates.
  All statements are idempotent (`add column if not exists`, `create or replace`).
