# SQL Function Wiring Verification

Audited 2026-07-09. 48 distinct RPC calls from frontend, 97 total SQL functions.

## Frontend → SQL: All 48 RPC Calls Match

Every `supabase.rpc()` call has a matching `CREATE FUNCTION` with correct parameter names, types, and return values.

| Category | Call Sites | Distinct RPCs | Mismatches |
|---|---|---|---|
| Auth/Profile | 3 | 3 | 0 |
| Wallet | 8 | 8 | 0 |
| Shop | 6 | 6 | 0 |
| Matches | 7 | 7 | 0 |
| Tournaments | 5 | 5 | 0 |
| Chat/Side Bets | 6 | 6 | 0 |
| P2P Bets | 5 | 5 | 0 |
| Admin (bans/disputes/revenue/support) | 13 | 13 | 0 |
| Other (notif/achieve/leaderboard/stats) | 5 | 5 | 0 |
| **Total** | **58** | **48** | **0** |

## Orphaned SQL Functions (49 — all accounted for)

- **4 trigger functions**: sync_username_lower, handle_new_user, handle_user_verified, match_msg_set_username
- **20 internal helpers**: check_rate_limit, shop_price, shop_item_name, shop_item_category, is_reserved_username, auto_withdrawal_decision, check_not_banned, advance_bracket, team_size, format_allowed, mode_needs_veto, maps_for_mode, maps_needed, resolve_host, can_play, can_play_game, settle_match, settle_tournament, settle_match_bets, purge_old_rate_limits
- **9 webhook/service_role**: deposit_from_webhook, mark_withdrawal_paid, sync_stripe_account, grant_shop_item, sync_subscription, record_subscription_event, grant_wagr_monthly_credit, record_payout_event, withdrawal_by_ref
- **5 scheduled/cron**: expire_wallet_memberships, run_tournament_scheduler, purge_old_chat, rollover_week, tournament_maintenance
- **1 potentially redundant**: mark_withdrawal_processing_admin (explicit admin param variant)
- **1 legacy/dead**: request_withdrawal_legacy_removed

## SECURITY DEFINER Functions

All 90+ SECURITY DEFINER functions include `SET search_path = public`. No exceptions.
