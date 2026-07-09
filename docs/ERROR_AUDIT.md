# Error Audit — 2026-07-09

Systematic audit of frontend-to-backend mismatches causing runtime errors.

## Root Cause
Frontend code calls RPCs and columns that were never created in the live Supabase DB
because `supabase_setup.sql` wasn't re-run after schema additions. No ErrorBoundary
meant these errors white-screened entire sections instead of showing friendly errors.

## Findings

### 1. Missing RPC Functions (6 total)
All called from frontend with no SQL definition. **Fixed in commit `c6992ea`.**

| RPC | Called From | Impact | Fix |
|-----|-----------|--------|-----|
| `platform_stats` | HomePage.jsx | Homepage hero stats show 0/0/0 | Created: aggregates matches/winnings/open lobbies |
| `get_achievements` | ProfilePage.jsx | Achievements panel silently empty | Created: returns from new `achievements` table |
| `mark_all_notifications_read` | notificationService.js | "Mark all read" button errors | Created: bulk update notifications |
| `get_revenue_dashboard` | AdminRevenuePage.jsx | Admin revenue page errors | Created: aggregates wallet_ledger rake entries |
| `admin_revert_match` | AdminMatchSupportPage.jsx | Revert button errors | Created: undoes settlement + reverses payouts |
| `admin_set_match_status` | AdminMatchSupportPage.jsx | Status change button errors | Created: force status with cancel refund |

### 2. Missing Columns (8 total)
Frontend selects/joins on columns that didn't exist in the DDL.

| Table | Column | Impact | Fix |
|-------|--------|--------|-----|
| `matches` | `team_name` | Select returns null (no crash, just missing data) | Added via ALTER |
| `matches` | `map` | Select returns null | Added via ALTER |
| `matches` | `match_number` | Select returns null | Added via ALTER |
| `profiles` | `twitter` | Profile social links empty | Added via ALTER |
| `profiles` | `youtube` | Profile social links empty | Added via ALTER |
| `profiles` | `twitch_username` | Live page/profile empty | Added via ALTER |
| `profiles` | `favorite_game` | Profile settings don't save | Added via ALTER |
| `profiles` | `favorite_mode` | Profile settings don't save | Added via ALTER |

### 3. RPC Signature Mismatches (2 total)
Frontend passes arguments the SQL function didn't accept → Postgres "function not found."

| RPC | Missing Args | Fix |
|-----|-------------|-----|
| `create_match` | `p_map`, `p_veto_ban`, `p_map_pool` | Added to function signature |
| `join_match` | `p_veto_ban` | Added to function signature |

### 4. Profile Update Grant Too Narrow
`GRANT UPDATE` on profiles only allowed 5 columns but frontend writes 11.
Updates to `twitter`, `youtube`, `twitch_username`, `platform`, `favorite_game`,
`favorite_mode` silently failed.

**Fix:** Expanded grant to include all editable columns.

### 5. Platform Constraint Too Narrow
`matches_platform_chk` only allowed 3 values but WWII split ladders added
`'PlayStation Only'` and `'Xbox Only'`. Creating WWII matches would fail.

**Fix:** Updated constraint to include all 5 platform values.

### 6. No ErrorBoundary
Any component throw → white screen. No error logged visibly.

**Fix:** Global ErrorBoundary already existed in `main.jsx`. Added per-route
ErrorBoundary in `App.jsx` keyed by `pageKey` so crashes are isolated to the
current page and navigating away resets. (Commit `758b619`.)

### 7. Auth Boot Hang
`useAuth.jsx` had no timeout on `getProfile`/`is_admin` — if either hung,
the app showed the splash spinner forever.

**Fix:** Each call wrapped in 8s timeout race. `setLoading(false)` in `finally`.
9s absolute failsafe. (Commit `d57ef6d`.)

## Missing `achievements` Table
The `get_achievements` RPC references an `achievements` table that didn't exist.
Created with columns matching frontend expectations: `id, user_id, title,
description, icon, tier, xp_reward, earned_at`. RLS policy allows public reads.

## DB Migration Required
Re-run the full `supabase_setup.sql` in the Supabase SQL Editor — every statement
is idempotent. See `docs/MIGRATIONS.md` for the specific delta if preferred.

## Guardrail Added
`scripts/check-rpc-drift.sh` — compares frontend `supabase.rpc()` calls against
SQL function definitions. Run before deploy to catch drift. (Commit `ec32bdd`.)
