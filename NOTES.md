# Dubbed — production TODO

## V13 update — re-run supabase_setup.sql

This pass added GameBattles-style tournament presets, platform/skill-tier
rules, a Warzone/Black Ops Royale 1v1-2v2 cap, NA/EU host-region logic, a map
veto step between "lobby full" and "live," per-match team chat, a match
cancel-request flow, **and a full Stripe Connect Express withdrawal system**
(pending → processing → paid/rejected, fraud gating, admin dashboard, webhooks,
idempotency, immutable ledger, provider-agnostic schema). **Re-paste the full
`supabase_setup.sql`** — it's additive/idempotent and safe to re-run.

New withdrawal pieces: `profiles.pending_balance/suspended/stripe_*`,
`withdrawal_requests.provider/payout_id/transfer_id/transaction_id/
rejected_reason/completed_at/processing_at/meta`, the `payout_events`
idempotency table, and the `request_withdrawal` / `mark_withdrawal_processing`
/ `mark_withdrawal_paid` / `reject_withdrawal` / `sync_stripe_account` /
`admin_list_withdrawals` / `record_payout_event` RPCs.

**Shop**: `profiles.username_change_tokens/wagr_member/subscription_*`,
`shop_purchases`, `username_history`, `subscription_events`,
`stripe_customers` tables, and the `purchase_with_wallet` /
`change_username` (token-gated) / `perform_stat_reset` /
`grant_shop_item` / `sync_subscription` / `admin_list_shop_purchases` /
`admin_shop_stats` / `admin_refund_purchase` RPCs. Three additional Edge
Functions: `stripe-shop-checkout`, `stripe-billing-portal`,
`stripe-shop-webhook`. WAGR members get no match rake (0% instead of 10%). Edge functions live in
`supabase/functions/` — see that folder's README for env + deploy steps.

To operate withdrawals: (1) run the SQL, (2) set the Stripe env secrets and
deploy the 4 edge functions, (3) create the Stripe webhook endpoint, (4) seed
an admin (`insert into app_admins ...`) — the Admin · Withdrawals page then
appears in that user's account menu.

The app is fully wired to Supabase and builds cleanly.

## Completed

- **~~1. Payments (Stripe)~~** — DONE. `stripe-deposit-checkout` Edge Function creates Stripe Checkout sessions. `stripe-deposit-webhook` verifies signatures, records idempotent events, credits balance via `deposit_from_webhook` RPC. Fallback to direct `deposit` RPC still in place for dev/test.
- **~~2. Admin dispute review~~** — DONE. `AdminDisputesPage.jsx` lists/filters/searches disputes with settle (award to player) and cancel+refund actions.
- **~~3. File storage~~** — DONE. `uploadAvatar` and `uploadEvidence` use Supabase Storage buckets. Avatar upload wired in `ProfilePage`. Evidence upload wired in `MatchRoomPage` report + dispute modals (URL paste or direct file upload).
- **~~4. Tournament bracket + settlement~~** — DONE. `generate_bracket` seeds single-elimination brackets. `advance_bracket` auto-advances winners. `settle_tournament_auto` distributes prizes (1st/2nd/3rd) when the final match resolves. `settle_tournament` available for admin manual settlement.
- **~~5. Side betting settlement~~** — DONE. Pool events: `settle_bet_event` / `void_bet_event`. P2P offers: `settle_bet_offer` / `void_bet_offer`. Admin UI in `AdminSideBetsPage.jsx`.
- **~~6a. Weekly stats~~** — DONE. `settle_match` and `settle_tournament` now INSERT/UPSERT into `weekly_stats` via `upsert_weekly_stat()`. Run `migrate_weekly_stats.sql` to deploy.

## Remaining before launch

### DB migration required

Run `migrate_weekly_stats.sql` in the Supabase SQL Editor. It patches `settle_match`, `settle_tournament`, and `advance_bracket` to populate `weekly_stats`.

### Hardening / polish

- **Email templates** — customize the Supabase confirmation email branding.
- **Realtime auth** — make sure Realtime is enabled for the tables the app subscribes to (matches, chat_messages, notifications, profiles, match_reports, match_disputes). The migrations add them to the `supabase_realtime` publication, but double-check in the dashboard.
- **Responsible-gambling** footer copy is present; add age-gating / self-exclusion if you operate in regulated regions, and check the legal status of skill-based wagering where your users are.

### Nice-to-haves

- Trim unused rules from the old `styles.css` (the new components use `theme.css`; the old file is still imported for any leftover classes and is harmless but larger than needed).
- Deep links / real routing (currently a lightweight in-memory router in `App.jsx`). Swap in `react-router` if you want shareable URLs and back-button support.
- Password reset UI (the `requestPasswordReset` service exists; there's no screen for it yet).
