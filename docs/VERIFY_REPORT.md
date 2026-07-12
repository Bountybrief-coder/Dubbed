# DUBBED v14 — Full Verification Report

**Date:** 2026-07-09
**Scope:** 96 SQL functions, 10 edge functions, 17 services, 24 pages, full schema.

---

## Executive Summary

| Section | Findings | Fixed | Noted |
|---------|----------|-------|-------|
| 1. Schema/RPC integrity | 4 | 4 | 0 |
| 2. SQL money/state | 8 | 6 | 2 |
| 3. Edge functions | 0 | 0 | 0 |
| 4. Service layer | 4 | 2 | 2 |
| 5. Page/UI | 2 | 2 | 0 |
| **Total** | **18** | **14** | **4** |

**Critical money bugs fixed:** Team pot over-count (platform hemorrhaging money), match rake mismatch (users overpaying), cancel refund over-pay (phantom refunds to non-paying roster members), WAGR renewal double-credit ($2/mo instead of $1).

---

## Section 1 — Schema / RPC Integrity Audit

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| S1-1 | CRITICAL | FIXED | Missing `grant_wagr_monthly_credit` — WAGR renewal silently failed |
| S1-2 | LOW | FIXED | `admin_ban_user` signature missing 2 params (p_ban_type, p_ip_address) |
| S1-3 | LOW | FIXED | `admin_unban_user` signature missing p_mark_redeemed |
| S1-4 | DEAD CODE | FIXED | Duplicate `place_bet` 4-param overload (ambiguous resolution risk) |

**Confirmed OK:** All 55 client RPCs exist. All 31 `.from()` tables exist. All edge function RPCs valid. Key columns present. RLS patterns correct. Idempotency guards on withdrawals and webhooks.

---

## Section 2 — SQL Function Tests (Money/State)

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| S2-1 | HIGH | FIXED | Match rake 10% server vs 5% client |
| S2-2 | HIGH | FIXED | Team pot `entry × players` but only captains pay → money drain |
| S2-3 | HIGH | FIXED | Cancel refund overpays roster members who never paid |
| S2-4 | MED | FIXED | WAGR renewal double-credits $1 (sync_subscription + grant_wagr_monthly_credit) |
| S2-5 | LOW | FIXED | Opponent team lookup matched teammates (user_id → team_id) |
| S2-6 | LOW | FIXED | create_match ledger missing ref_id |
| S2-7 | LOW | NOTED | WAGR display showed 2% rake, server gives 0% → fixed client to 0% |
| S2-8 | LOW | NOTED | grant_shop_item only handles username_change entitlement via Stripe |

**Confirmed OK:** settle_bet, settle_bet_event, settle_bet_offer (correct 5% rake math, FOR UPDATE, idempotent). All void/cancel/refund functions (correct refund, status guards). settle_tournament (2% house, correct 83/10/7 split). Withdrawal flow (hold model, FOR UPDATE, admin-gated). Shop purchases (server-side pricing, entitlement grants). rollover_week (idempotent, correct tiers). tournament_maintenance (auto-start, refund guard, skip-locked concurrency).

---

## Section 3 — Edge Function Tests

All 9 edge functions + 1 shared utility reviewed. **No findings.**

| Function | Auth | Signature | Idempotency | DB calls |
|----------|------|-----------|-------------|----------|
| stripe-connect-onboard | getCaller | N/A | account reuse | profiles.update |
| stripe-connect-status | getCaller | N/A | N/A | sync_stripe_account |
| stripe-deposit-checkout | getCaller | N/A | N/A | Stripe session |
| stripe-deposit-webhook | stripe-sig | STRIPE_DEPOSIT_WEBHOOK_SECRET | payment_events | deposit_from_webhook |
| stripe-payout | getCaller+admin | N/A | Stripe idempotency key | mark_withdrawal_processing_admin |
| stripe-shop-checkout | getCaller | N/A | N/A | shop_price (server-side pricing) |
| stripe-shop-webhook | stripe-sig | STRIPE_SHOP_WEBHOOK_SECRET | subscription_events | sync_subscription, grant_shop_item, grant_wagr_monthly_credit |
| stripe-webhook | stripe-sig | STRIPE_WEBHOOK_SECRET | payout_events | mark_withdrawal_paid, reject_withdrawal |
| stripe-billing-portal | getCaller | N/A | N/A | stripe_customers |

---

## Section 4 — Service Layer Tests

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| S4-1 | MED | NOTED | matchChatService inserts username from client (display spoofing in match chat). RLS enforces real user_id but display name is untrusted. |
| S4-2 | LOW | FIXED | SHOP_CATALOG wagr_membership price $9.99 vs server $4.99. Fixed to $4.99. |
| S4-3 | LOW | FIXED | WAGR benefits text said "2% rake" but server gives 0%. Updated to "0% rake". |
| S4-4 | LOW | NOTED | joinMatch doesn't pass optional p_team_id (team auto-resolved server-side) |

**Confirmed OK:** authService, banService, betService, chatService, disputeService, leaderboardService, notificationService, p2pBetService, profileService, teamService, tournamentService, walletService — all correct RPC calls, proper error handling.

---

## Section 5 — Page / UI Smoke Pass

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| S5-1 | MED | FIXED | TeamsPage showed PSN+Xbox for BO1/BO2 (PS5-only games). Used `platformsForGame()`. |
| S5-2 | LOW | FIXED | HomePage WAGR marketing copy said "half the rake" — updated to "zero rake". |

**Confirmed OK:** Build clean (1.66s, no warnings). All imports valid. All 24 pages render without undefined references. Auth guards on protected pages. Game data from centralized config.

**Visual notes (no code fix needed):** Game cover images for WWII/BO1/BO2 fall back to BO7 image — need `wwii.png`, `bo1.png`, `bo2.png` in `src/assets/` when available.

---

## Section 6 — Hardening Summary

### Migrations deployed
| File | Fixes |
|------|-------|
| `migrate_verify_fixes.sql` | S1-1 through S1-4 |
| `migrate_s2_rake_pot.sql` | S2-1, S2-2, S2-5 |
| `migrate_s2_batch2.sql` | S2-3, S2-4 |
| `migrate_s2_create_match_refid.sql` | S2-6 |
| `migrate_s2_fixes.sql` | Platform checks (BO1/BO2) |
| `migrate_s2_tournament.sql` | Tournament platform check |
| `migrate_bo1_bo2.sql` | can_play generalization |

### Frontend deployed
- `src/utils/games.js`: WAGR rake 0%, BO1/BO2 game data, platformsForGame
- `src/services/shopService.js`: WAGR price $4.99, benefits text
- `src/pages/HomePage.jsx`: WAGR marketing copy
- `src/pages/TeamsPage.jsx`: Platform picker for console-only games
- `src/pages/RulesPage.jsx`: BO1/BO2 rules sections
- `src/components/CreateMatchModal.jsx`: Platform auto-lock for single-platform games

### Remaining items (NOTED, not blocking)
1. **S2-8:** `grant_shop_item` should handle `double_xp_token` and `wagr_membership` entitlements for the Stripe checkout path (currently only `username_change`).
2. **S4-1:** Match chat username spoofing — either use server-side username lookup in the RLS policy or add a trigger.
3. **Cover images:** Provide `wwii.png`, `bo1.png`, `bo2.png` for game cards.
