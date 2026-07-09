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

The app is fully wired to Supabase and builds cleanly. Before taking real money and real users, these are the things that still need doing. They're ordered roughly by how much they matter.

## 1. Payments (Stripe) — REQUIRED before real deposits

Right now `deposit()` calls a `deposit` RPC that **credits balance directly**. That's a testing placeholder — it means anyone who can call the RPC can mint balance. Before launch:

- Add Stripe Checkout (or Payment Element) on the frontend for the deposit flow.
- Create a Supabase **Edge Function** that receives the Stripe webhook, verifies the signature, records the event in `payment_events` (the `external_id` unique column prevents double-processing), and only then credits balance via a service-role write.
- **Revoke `execute` on the client-callable `deposit` RPC** so the browser can no longer credit balance. Balance should only ever go up from a verified webhook.

## 2. Admin surfaces — needed to operate

The schema and RPCs exist, but there's no admin UI yet. You need internal pages (or a protected route) for:

- **Dispute review** — list `match_disputes` where `status = 'open'`, show both `match_reports` + evidence, and call `settle_match_admin(match_id, winner_id, note)`.
- **Withdrawal review** — ✅ built. The Admin · Withdrawals page (`AdminWithdrawalsPage`) lists/filters/searches requests, approves (fires the Stripe payout Edge Function), and rejects (auto-refunds). Only the dispute-review UI above still needs building.
- Seed admins by inserting their profile id into `app_admins`. `is_admin()` gates all admin RPCs and policies.

## 3. File storage (avatars + evidence)

Avatar upload and match/dispute evidence currently use `URL.createObjectURL` — the image only exists in the browser tab. To persist:

- Create a Supabase **Storage** bucket (e.g. `avatars`, `evidence`).
- Upload the file, get the public (or signed) URL, and save that URL to `profiles.avatar_url` / the report's `evidence_url`.
- Wire the "upload" stubs in `MatchRoomPage` (report + dispute modals) and the avatar picker in `ProfilePage`.

## 4. Tournament bracket + settlement

`join_tournament` holds entry and fills the pot. What's not built yet:

- Bracket generation / seeding once a tournament fills or its start time hits.
- Result reporting per round.
- Final payout split (the UI already previews 70/30 of the net pot; the actual payout needs a server-side settlement RPC that mirrors `settle_match`).

## 5. Side betting settlement

`place_bet` records a bet and holds stake. There's no market resolution yet — you'll need an admin/automated way to settle bets and pay winners.

## 6. Hardening / polish

- **Rate limiting** on chat and match creation (Supabase doesn't do this out of the box — consider an Edge Function or a per-user throttle table).
- **Profanity / moderation** on chat messages and team names (only usernames are filtered right now).
- **Email templates** — customize the Supabase confirmation email branding.
- **Realtime auth** — make sure Realtime is enabled for the tables the app subscribes to (matches, chat_messages, notifications, profiles, match_reports, match_disputes). The migrations add them to the `supabase_realtime` publication, but double-check in the dashboard.
- **Responsible-gambling** footer copy is present; add age-gating / self-exclusion if you operate in regulated regions, and check the legal status of skill-based wagering where your users are.

## 7. Nice-to-haves

- Trim unused rules from the old `styles.css` (the new components use `theme.css`; the old file is still imported for any leftover classes and is harmless but larger than needed).
- Deep links / real routing (currently a lightweight in-memory router in `App.jsx`). Swap in `react-router` if you want shareable URLs and back-button support.
- Password reset UI (the `requestPasswordReset` service exists; there's no screen for it yet).
