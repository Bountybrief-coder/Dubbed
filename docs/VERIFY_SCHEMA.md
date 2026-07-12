# Verification Pass — Sections 1 & 2

**Run date:** 2026-07-09
**Scope:** All 55 client RPCs, 96 SQL functions, 31 tables, 10 edge functions.

---

# Section 1 — Schema / RPC Integrity Audit

## Summary

| Severity | Count | Status | Description |
|----------|-------|--------|-------------|
| CRITICAL | 1 | FIXED | Missing SQL function (`grant_wagr_monthly_credit`) |
| LOW | 2 | FIXED | Client sends params the SQL signature ignores (`admin_ban_user`, `admin_unban_user`) |
| DEAD CODE | 1 | FIXED | Duplicate `place_bet` overload (4-param version is dead) |

All 55 client-called RPCs exist in SQL (except the CRITICAL below).
All 31 `.from()` tables exist.
All edge function DB calls reference valid RPCs/tables.
Key columns verified present.

---

### CRITICAL — `grant_wagr_monthly_credit` does not exist

**Call site:** `supabase/functions/stripe-shop-webhook/index.ts:126`

**Impact:** WAGR membership monthly renewal silently fails to credit the $1 wallet top-up.

**Fix:** Created the function with per-month idempotency. Deployed via `migrate_verify_fixes.sql`.

---

### LOW — `admin_ban_user` / `admin_unban_user` signature mismatches

Client sends 5/3 params but SQL only accepted 3/2. Extra params silently dropped.

**Fix:** Added missing params to SQL signatures. Deployed via `migrate_verify_fixes.sql`.

---

### DEAD CODE — duplicate `place_bet` (4-param overload)

**Fix:** Dropped. Deployed via `migrate_verify_fixes.sql`.

---

## Confirmed OK (Section 1)

- All 55 unique client RPCs map to existing SQL functions
- All 31 `.from()` tables exist in schema
- All edge function RPCs exist and reference valid functions/tables
- Key columns verified present
- Edge function auth patterns: all check `is_admin()` or `auth.uid()` appropriately
- Idempotency: withdrawal UUID used as Stripe idempotency key; `record_payout_event` guards duplicate webhook processing
- RLS on `app_settings`, `wallet_ledger`, `withdrawal_requests`, `rate_limits` all use `using (false)` with SECURITY DEFINER RPCs

---

# Section 2 — SQL Function Tests (Money/State Priority)

## Summary

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| S2-1 | HIGH | FIXED | Match rake 10% server vs 5% client — users overpay |
| S2-2 | HIGH | FIXED | Team pot over-count — `entry * v_players` but only captains pay; platform hemorrhages money |
| S2-3 | HIGH | FIXED | Cancel refund over-pays roster members who never paid entry |
| S2-4 | MED | FIXED | WAGR renewal double-credits $1 (sync_subscription + grant_wagr_monthly_credit) |
| S2-5 | LOW | FIXED | Opponent team lookup matched teammates instead of opponents |
| S2-6 | LOW | FIXED | create_match ledger entry missing ref_id (join_match had it) |
| S2-7 | LOW | NOTED | WAGR display: client shows 2% rake for WAGR, server gives 0% |
| S2-8 | LOW | NOTED | grant_shop_item only handles username_change (not double_xp_token via Stripe) |

---

### S2-1 HIGH (FIXED) — Rake rate mismatch on matches

**Client** `RAKE_CONFIG.standard = 0.05` (5%) at `src/utils/games.js:310`.
**Server** `settle_match` used `round(v_pot * 0.10, 2)` (10%).

Users saw estimated payouts based on 5% but actually had 10% taken. Bets (5%) and tournaments (2%) were consistent.

**Fix:** Changed server to `0.05`. Deployed via `migrate_s2_rake_pot.sql`.

---

### S2-2 HIGH (FIXED) — Team pot over-count (money drain)

`settle_match` calculated `v_pot := v_m.entry * v_players` where `v_players` = count of ALL `match_players`. But only team captains pay entry — roster members are inserted into `match_players` without being charged.

**Example (2v2 $20 entry):** Collected = $40 (2 captains). Calculated pot = $80 (4 players × $20). Winner receives $76. Platform loses $36 per match.

**Fix:** Changed to `v_pot := v_m.entry * 2` (always 2 paying sides — UI enforces full roster for squad modes). Deployed via `migrate_s2_rake_pot.sql`.

---

### S2-3 HIGH (FIXED) — Cancel refund over-pays roster members

`respond_match_cancel` refunded `v_m.entry` to EVERY `match_player`, including roster members who never paid. Same root cause as S2-2 applied to refunds.

Also: `status <> 'open'` gate meant creators got no refund if match was still open (no opponent joined yet).

**Fix:** Refund only users who actually paid — identified via `created_by` flag and `wallet_ledger` entries with `ref_id = match_id`. Removed the `status <> 'open'` gate. Deployed via `migrate_s2_batch2.sql`.

---

### S2-4 MED (FIXED) — WAGR renewal double-credits $1

On WAGR renewal, Stripe sends `customer.subscription.updated` AND `invoice.paid`. Both events credited $1:

1. `subscription.updated` → `sync_subscription` → `balance + 1.00` (no idempotency)
2. `invoice.paid` → `grant_wagr_monthly_credit` → `balance + 1.00` (per-month idempotent)

Event ordering is non-deterministic. If `subscription.updated` fires first, `grant_wagr_monthly_credit`'s idempotency catches the duplicate. But if `invoice.paid` fires first, `sync_subscription` blindly adds another $1. Result: $2/month instead of $1.

**Fix:** Removed the inline $1 credit from `sync_subscription`. The `grant_wagr_monthly_credit` function (called from `invoice.paid`) is the single source of truth with per-month idempotency. Deployed via `migrate_s2_batch2.sql`.

---

### S2-5 LOW (FIXED) — Opponent team lookup bug

`settle_match` team credit loop found opponent team via `user_id <> v_mp.user_id`, which could match a teammate in team modes. Changed to `team_id <> v_mp.team_id`. Deployed via `migrate_s2_rake_pot.sql`.

---

### S2-6 LOW (FIXED) — create_match ledger missing ref_id

`create_match` inserted wallet_ledger without `ref_id` (match hadn't been inserted yet). `join_match` correctly included `ref_id`. Fixed by moving ledger insert to after match insert. Deployed via `migrate_s2_create_match_refid.sql`.

---

### S2-7 LOW (NOTED) — WAGR rake display mismatch

Client `RAKE_CONFIG.wagr = 0.02` (2%) but server gives WAGR members 0% rake. Users see lower estimated payout than they actually receive — not harmful, but misleading marketing copy on HomePage and MatchRoomPage. No code change made; flagged for business decision.

---

### S2-8 LOW (NOTED) — grant_shop_item missing entitlements

`purchase_with_wallet` handles `username_change`, `wagr_membership`, and `double_xp_token`. But `grant_shop_item` (Stripe checkout path) only handles `username_change`. If `double_xp_token` is ever sold via Stripe (not wallet), the entitlement won't activate. Currently harmless if these items are wallet-only. No code change made; flagged for awareness.

---

## Confirmed OK (Section 2)

**Bet settlement** (`settle_bet`, `settle_match_bets`, `settle_bet_event`, `settle_bet_offer`):
- Correct math: gross = stake × odds, profit = gross − stake, rake = 5% of profit (WAGR 0%)
- FOR UPDATE locks on all reads-before-write
- Idempotent: checks `status <> 'open'` before settling

**Bet refunds** (`void_bet_event`, `void_bet_offer`, `cancel_bet_offer`):
- Full stake refund, ledger entry, status guard, FOR UPDATE locks

**Tournament settlement** (`settle_tournament`):
- 2% house cut, 83.3%/10%/6.7% split, admin-only, idempotent, correct pot = entry × joined

**Withdrawal flow** (`request_withdrawal`, `mark_withdrawal_processing`, `mark_withdrawal_paid`, `reject_withdrawal`):
- Hold model: balance → pending_balance on request, pending_balance cleared on paid, balance restored on reject
- FOR UPDATE locks, idempotent terminal states, admin/service_role gated
- Rate limited (3 per 5 minutes), $10 minimum, block reasons checked

**Shop purchases** (`purchase_with_wallet`, `admin_refund_purchase`):
- FOR UPDATE on balance read, correct entitlement grants, refund reverses entitlements

**Weekly rewards** (`rollover_week`):
- Idempotent via weekly_rewards uniqueness check, correct prize tiers

**Tournament maintenance** (`tournament_maintenance`):
- Auto-start, auto-refund with `refunded` guard flag, `skip locked` for concurrency
