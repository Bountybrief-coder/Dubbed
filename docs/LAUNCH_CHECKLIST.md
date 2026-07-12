# Dubbed v14 Launch Checklist

Generated 2026-07-10. PASS/FAIL/FIXED per item.

---

## Section 1 — Loading Freeze

| # | Item | Status | Detail |
|---|------|--------|--------|
| 1.1 | `useAuth.jsx` timeout wrapping | **PASS** | `withTimeout(promise, 8000, label)` wraps `getSession`, `getProfile`, `is_admin`. `finally` block always calls `setLoading(false)`. |
| 1.2 | Absolute failsafe timer | **PASS** | 9 s `FAILSAFE_TIMEOUT` → `setLoading(false)` + `setBootError()`. Cleared in cleanup. |
| 1.3 | `useAsync.js` timeout | **PASS** | `raceTimeout(promise, 12000)` default. Every caller exposes `reload` + error state with Retry button. |
| 1.4 | Tab-refocus data refresh | **FIXED** | Added `useVisibilityRefresh(reload)` to MatchfinderPage, GamePage, WalletPage, NotificationsPage. Already present in LeaderboardPage, TeamsPage, ProfilePage. MatchRoomPage uses live Realtime subscriptions. |
| 1.5 | Realtime subscriptions survive reconnect | **PASS** | `supabase-js` v2 auto-reconnects channels. Profile updates via `postgres_changes` subscription in `useAuth` (line 130-151). Match room has 3 separate realtime channels (match, cancel requests, chat). |
| 1.6 | Global ErrorBoundary | **PASS** | Root-level `<ErrorBoundary>` in `main.jsx` (catches AuthProvider/ToastProvider crashes). Per-page `<ErrorBoundary>` in `App.jsx` (line 198) catches individual page crashes. Both show "Something went wrong" + Reload button. |
| 1.7 | ConnectionBanner | **PASS** | Detects `online`/`offline` events. Shows reconnecting banner when offline. |
| 1.8 | App never freezes on splash | **PASS** | `loading` is set to `false` in: (a) `finally` block after getSession+loadProfile, (b) failsafe timer at 9 s. No code path skips it. |

**Section 1 verdict: PASS**

---

## Section 2 — Trophies

| # | Item | Status | Detail |
|---|------|--------|--------|
| 2.1 | `settle_tournament` inserts trophies | **PASS** | 1st/2nd/3rd each get `INSERT INTO trophies(user_id, title, place, tone, game, prize, bracket_size)`. Tone = `gold`/`silver`/`bronze` for paid, `wagr` for free-entry. |
| 2.2 | `settle_tournament_auto` inserts trophies | **PASS** | Same trophy insertions as `settle_tournament`, no `is_admin()` gate. Called by `advance_bracket` when final match resolves. |
| 2.3 | Trophies visible on player card | **PASS** | `MatchRoomPage` loads `trophies` table for all match players (lines 56-66), counts gold/silver/bronze, displays via `TrophyIcon`. |
| 2.4 | Trophy shelf on profile | **PASS** | `ProfilePage` calls `getTrophies(userId)` (line 522), renders `TrophyShelf` component with `TrophyIcon` per trophy row. |
| 2.5 | RLS allows trophy reads | **PASS** | `trophies read` policy: `for select using (true)` — public read. |

**Section 2 verdict: PASS**

---

## Section 3 — Deposits (Stripe)

| # | Item | Status | Detail |
|---|------|--------|--------|
| 3.1 | Checkout → webhook → balance | **PASS** | `stripe-deposit-checkout` creates Checkout session with `metadata.dubbed_user_id + type=deposit + amount`. `stripe-deposit-webhook` verifies Stripe signature, checks `checkout.session.completed`, credits via `deposit_from_webhook` RPC. |
| 3.2 | Webhook signature verification | **PASS** | `stripe.webhooks.constructEventAsync(body, sig, STRIPE_DEPOSIT_WEBHOOK_SECRET)` — rejects bad signatures with 400. |
| 3.3 | Idempotency | **PASS** | Checks `payment_events.external_id = session.id` before processing. Skips duplicates with `{ received: true, duplicate: true }`. |
| 3.4 | `deposit_from_webhook` service-role only | **PASS** | `if not (auth.role() = 'service_role') then raise exception` — cannot be called from client. |
| 3.5 | Dev deposit not reachable from anon | **PASS** | `REVOKE EXECUTE ON FUNCTION public.deposit(numeric) FROM anon` at line 2819. |
| 3.6 | Minimum deposit | **PASS** | Edge Function: `if (!amount || Number(amount) < 5)` → 400 "Minimum deposit is $5". |
| 3.7 | Wallet UI | **PASS** | `WalletPage` shows balance, deposit modal, withdraw modal, ledger, withdrawal history, purchase history. Deposit success detected via `?deposit=success` query param. |

**Section 3 verdict: PASS**

### Required external steps (not in code)

- [ ] **Stripe approval**: Switch from test mode to live. Set live Stripe keys.
- [ ] **Edge Function secrets**: Set `STRIPE_SECRET_KEY`, `STRIPE_DEPOSIT_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` in Supabase Edge Function environment.
- [ ] **Stripe webhook endpoints**: Create webhook endpoints in Stripe Dashboard pointing to the deployed Edge Function URLs for `stripe-deposit-webhook` and `stripe-payout-webhook`.
- [ ] **Dev deposit lockdown**: Before go-live, also `REVOKE EXECUTE ON FUNCTION public.deposit(numeric) FROM authenticated` to block the dev/test deposit bypass entirely.

---

## Section 4 — XP + Cash Matches for All Games

| # | Item | Status | Detail |
|---|------|--------|--------|
| 4.1 | All 7 games defined | **PASS** | BO7, MW4, WZ, BOR, WWII, BO1, BO2 in `GAMES` array (`utils/games.js`). |
| 4.2 | Both `cash` and `xp` match kinds | **PASS** | `create_match` RPC accepts `p_kind` = `cash` or `xp`. Matchfinder filters by kind. Entry fee = 0 for XP matches. |
| 4.3 | Format caps per game | **PASS** | BO7/MW4/WWII/BO1/BO2: 1v1–4v4. WZ/BOR: 1v1–2v2. Kill Race modes: always 1v1–2v2. |
| 4.4 | Platform restrictions | **PASS** | WWII/BO1/BO2 are console-only (PSN/Xbox). `join_match` enforces team platform match. `checkGameEligibility` checks linked accounts. |
| 4.5 | Map pools per game/mode | **PASS** | `GAME_MAP_POOLS` defines maps for each game×mode. Map veto uses these pools. |
| 4.6 | XP awards | **PASS** | `settle_match`: winner +100 XP, loser +25 XP. `settle_tournament`: 1st +500, 2nd +250, 3rd +100 XP. |
| 4.7 | Cash payout + rake | **PASS** | 5% rake (0% for WAGR members). `RAKE_CONFIG` in `utils/games.js`. `settle_match` calculates payout after rake. |
| 4.8 | Weekly stats | **PASS** | `upsert_weekly_stat()` called from both `settle_match` (per-player) and `settle_tournament` (placed winners). |

**Section 4 verdict: PASS**

---

## Section 5 — Match Acceptance Flow

| # | Item | Status | Detail |
|---|------|--------|--------|
| 5.1 | No double-accept race | **PASS** | `join_match` uses `SELECT ... FOR UPDATE` on the match row. Checks `status = 'open'`. Checks `already joined` (match_players). All inside a single transaction. |
| 5.2 | Entry fee held atomically | **PASS** | `SELECT balance ... FOR UPDATE` on profile row. Balance check + deduction + wallet_ledger insert all in same transaction. |
| 5.3 | Status transitions | **PASS** | `open` → `live` (when player count reaches `team_size * 2`). If veto needed: `veto_status = 'pending'`. If not: `veto_status = 'complete'`, `host_region` resolved. |
| 5.4 | Chat opens on fill | **PASS** | System message "Lobby is full. Map veto has started." / "Match is live — good luck." inserted when match goes live. |
| 5.5 | Eligibility shown inline | **PASS** | `checkGameEligibility` returns `{ eligible, reason, cta }`. Non-eligible shows `AlertTriangle` + hint ("Link acct", "Need team"). |
| 5.6 | AcceptMatchModal | **PASS** | Full info bar (game, mode, format, series, platform, input, region, skill tier, weapon restriction, entry). Veto ban selection if needed. Roster selection for squads. |
| 5.7 | Optimistic UI after join | **PASS** | `doJoin()` calls `refreshProfile()` (balance update), `reload()` (matchfinder refresh), `onOpenMatch()` (navigate to match room). |
| 5.8 | No dead-ends | **PASS** | Error toast on join failure. Loading state on join button. Match not found / error states have retry buttons. |
| 5.9 | Rate limiting | **PASS** | `check_rate_limit('join_match', 10, 60)` — max 10 joins per 60 seconds. `check_rate_limit('create_match', 5, 60)` — max 5 creates per 60 seconds. |
| 5.10 | Ban check | **PASS** | `check_not_banned()` at start of `join_match` and `create_match`. |

**Section 5 verdict: PASS**

---

## Overall Go/No-Go

| Area | Verdict |
|------|---------|
| Loading / resilience | PASS |
| Trophies | PASS |
| Deposits (Stripe) | PASS (external steps required) |
| All games XP + Cash | PASS |
| Match acceptance | PASS |
| Build | PASS (1.61 s, no warnings) |

### External must-dos before go-live

1. **Stripe live keys** — Switch from test mode. Set `STRIPE_SECRET_KEY` (live), `STRIPE_PUBLISHABLE_KEY` (live) in both the app `.env` and Supabase Edge Function secrets.
2. **Webhook secrets** — Create Stripe webhook endpoints for deposit + payout Edge Functions. Set `STRIPE_DEPOSIT_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`.
3. **Run `migrate_weekly_stats.sql`** — Execute in Supabase SQL Editor to patch `settle_match`, `settle_tournament`, `advance_bracket` with weekly stats population.
4. **Edge Function deploy** — Deploy all 7 Edge Functions (`stripe-deposit-checkout`, `stripe-deposit-webhook`, `stripe-payout`, `stripe-payout-webhook`, `stripe-shop-checkout`, `stripe-billing-portal`, `stripe-shop-webhook`).
5. **Edge Function env** — Set `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_DEPOSIT_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_SHOP_WEBHOOK_SECRET` in Supabase Dashboard → Edge Functions → Secrets.
6. **Revoke dev deposit** — Run `REVOKE EXECUTE ON FUNCTION public.deposit(numeric) FROM authenticated;` to close the test-only direct deposit path.
7. **Supabase Realtime** — Verify `matches`, `chat_messages`, `notifications`, `profiles`, `match_reports`, `match_disputes`, `match_cancel_requests`, `trophies` are in the `supabase_realtime` publication. Check in Dashboard → Database → Replication.
8. **Admin seed** — `INSERT INTO app_admins(user_id) VALUES ('your-uuid');` for your account.
9. **Netlify deploy** — Run `vite build` and deploy `dist/` to Netlify. Verify `_redirects` file exists for SPA routing.
10. **Email templates** — Customize Supabase auth email templates (confirmation, password reset) with Dubbed branding.

### Verdict: **GO** (pending external steps above)
