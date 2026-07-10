# Launch Readiness Report

Generated: 2026-07-10

---

## CODE-FIXED (done in this pass)

### Auth (Section 1)

| Check | Status | Detail |
|---|---|---|
| Sign up + email verification | PASS | `signUp()` passes username in `options.data`; `on_auth_user_created` trigger creates profile; `handle_user_verified` trigger sets `profiles.verified = true` on email confirm |
| Sign in by username | PASS | `email_for_username` SECURITY DEFINER RPC resolves username to email, then `signInWithPassword` |
| Wrong password message | PASS | Normalized to "Incorrect username or password." (no email/username enumeration) |
| Unverified email message | **FIXED** | Added explicit catch for Supabase's `email not confirmed` error with friendly message |
| Sign out | PASS | Clears session + profile state |
| Session persistence | PASS | `persistSession: true`, `autoRefreshToken: true` in Supabase client config |
| Password reset | PASS | `requestPasswordReset()` calls `resetPasswordForEmail()`, UI in AuthModal reset mode |
| Change password (re-auth) | **FIXED** | Was missing re-auth. Now requires current password, verifies via `signInWithPassword` before `updateUser` |
| Change email (re-auth) | **FIXED** | Was missing re-auth. Now requires current password verification. Supabase sends confirmation to both addresses |
| Boot loading freeze fix | PASS | `BOOT_TIMEOUT` (8s) + `FAILSAFE_TIMEOUT` (9s) + `finally` block ensures `setLoading(false)` always fires |
| Auth trigger exists | PASS (in SQL) | `on_auth_user_created` and `on_auth_user_verified` in `supabase_setup.sql` |
| Anon key only on client | PASS | `lib/supabase.js` uses `VITE_SUPABASE_ANON_KEY` only; service-role key only in Edge Functions |
| Service-role never in client | PASS | Grep confirms zero occurrences of `service_role`, `sk_live`, `sk_test` in `src/` |
| RLS enforces identity | PASS | `wallet_ledger`, `notifications`, `withdrawal_requests` all have `auth.uid() = user_id` policies; profiles writable only for safe columns via column-level grant |
| Admin gated by `is_admin()` | PASS | All admin RPCs check `is_admin()` or `auth.role() = 'service_role'` |
| `is_admin()` stack overflow | **FIXED** | `app_admins` RLS called `is_admin()` which reads `app_admins` — infinite recursion. Fixed by making `is_admin()` SECURITY DEFINER so its query bypasses RLS |
| `platform_stats()` enum bug | **FIXED** | Referenced nonexistent `'completed'` enum value in match_status filter — removed |

### Supabase Integration (Section 2)

| Check | Status | Detail |
|---|---|---|
| `get_leaderboard` RPC signature | PASS | `(text, text, text, int)` matches client call `{ p_metric, p_region, p_platform, p_limit }` |
| `get_my_rank` RPC signature | PASS | `(text, text, text)` matches client call |
| `platform_stats` RPC | PASS | Returns `{total_matches, total_winnings, open_lobbies}` matching client destructure |
| `deposit_from_webhook` RPC | PASS | `(uuid, numeric, text)` matches Edge Function call |
| `payment_events` insert | **FIXED** | Column was `type` (wrong) — fixed to `event_type`. Removed nonexistent `processed` column |
| `email_for_username` grants | PASS | Granted to `anon, authenticated` |
| Realtime channels | PASS | Profile, withdrawals, trophies, match messages — all reference correct table/filter patterns |
| Storage bucket references | PASS | `avatars` bucket for profile pics, `match-evidence` for reports |
| Supabase-not-configured stub | PASS | `supabaseConfigured` flag + full stub client prevents white-screen when env vars missing |
| RLS security patch | PASS | `rls_security_patch.sql` revokes dangerous INSERT grants from anon+authenticated, forces all writes through SECURITY DEFINER RPCs |

### Netlify Config (Section 3)

| Check | Status | Detail |
|---|---|---|
| SPA redirect | PASS | `/* → /index.html 200` — client routes work on refresh/deep-link |
| Build command | PASS | `npm run build` → `vite build` (Node 20) |
| Publish dir | PASS | `dist` |
| HSTS | PASS | `max-age=31536000; includeSubDomains; preload` |
| X-Frame-Options | PASS | `DENY` |
| X-Content-Type-Options | PASS | `nosniff` |
| Referrer-Policy | PASS | `strict-origin-when-cross-origin` |
| CSP | PASS | Allows `self` scripts/styles, Supabase connect+images, Stripe Checkout frames, Twitch frames. No unsafe-eval. `frame-ancestors: none` prevents clickjacking |
| Permissions-Policy | PASS | Camera/mic/geo off, payment=self |
| Asset caching | PASS | `/assets/*` gets 1-year immutable cache (Vite fingerprints filenames) |

**CSP note**: The app uses redirect-based Stripe Checkout (no embedded Stripe.js). If you
later add Stripe Elements, you'll need `https://js.stripe.com` in `script-src` and
`https://api.stripe.com` in `connect-src`.

### Stripe Integration (Section 4)

| Check | Status | Detail |
|---|---|---|
| Deposit checkout | PASS | Edge Function creates Checkout Session with caller auth + server-side amount; no client-set prices |
| Deposit webhook | PASS | Signature verified via `STRIPE_DEPOSIT_WEBHOOK_SECRET`; idempotent via `payment_events.external_id` unique; credits via `deposit_from_webhook` RPC (service-role only) |
| Shop checkout | PASS | Server-priced via `shop_price()` RPC; supports one-time (payment) + subscription (WAGR); reuses Stripe customer |
| Shop webhook | PASS | Signature verified; idempotent via `subscription_events` + `shop_purchases.stripe_ref`; grants entitlements via `grant_shop_item` (service-role only) |
| Connect onboarding | PASS | Creates Express account, stores `stripe_account_id`, returns one-time Account Link |
| Connect status sync | PASS | Retrieves account from Stripe, syncs via `sync_stripe_account` RPC |
| Payout | PASS | Creates Stripe Transfer with idempotency key `dubbed_wd_{id}`; admin or owner (auto-approved) can trigger |
| Payout webhook | PASS | Signature verified; idempotent via `record_payout_event`; handles `account.updated`, `transfer.created`, `transfer.reversed`, `payout.failed` |
| Billing portal | PASS | Opens Stripe Customer Portal for subscription management |
| Secret key server-only | PASS | `STRIPE_SECRET_KEY` only accessed in Edge Functions via `Deno.env.get()` |
| Webhook signatures | PASS | All 3 webhook endpoints verify `stripe-signature` header with distinct secrets |
| Money paths idempotent | PASS | Every webhook checks for duplicate event/session IDs before processing |
| Money paths transactional | PASS | All balance changes use `FOR UPDATE` row locks in SECURITY DEFINER RPCs |

### No Mocks / Senior-Level (Section 5)

| Check | Status | Detail |
|---|---|---|
| Mock/dummy/seed data | PASS | Zero mock data in production code. Placeholder text is only in input `placeholder` attributes (correct) |
| Hardcoded secrets | PASS | Zero occurrences of API keys, tokens, or secrets in `src/` or committed config |
| TODO/FIXME on critical paths | PASS | Zero occurrences in `src/` or `supabase/functions/` |
| Input validation | PASS | `validateUsername`, `validateEmail`, `validatePassword`, `validateEntry` on all mutations; server-side re-validation in every RPC |
| Error handling | PASS | Consistent `{ data, error }` pattern across all services; RPCs raise exceptions with human messages |
| Money column safety | PASS | `balance`, `xp`, `wins`, `losses`, `earnings`, `streak` locked at DB level — `REVOKE UPDATE` from authenticated, only RPCs can modify |
| Rate limiting | PASS | `check_rate_limit()` on withdrawals (3/5min); client-side debounce on match creation |
| Profanity filter | PASS | Leetspeak-normalized check on usernames with reserved-name blocklist |
| Password validation consistency | **NOTE** | `validation.js` requires 6 chars, ProfilePage now matches (was 8, fixed) |

---

## YOU-MUST-DO-IN-DASHBOARD (from DASHBOARD_STEPS.md)

These are launch-blockers that require human action in live dashboards:

### Critical (cannot launch without)

1. **Run SQL migrations** in Supabase SQL Editor (supabase_setup.sql + patches + rls_security_patch.sql)
2. **Configure Supabase Auth** — enable email provider, confirm email ON, set site URL + redirect URLs
3. **Deploy Edge Functions** (9 functions via `supabase functions deploy`)
4. **Set Edge Function secrets** — STRIPE_SECRET_KEY, 3x webhook secrets, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
5. **Register 3 Stripe webhooks** with correct event subscriptions
6. **Set Netlify env vars** — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, then redeploy
7. **Create first admin** via SQL INSERT into `app_admins`

### Important (needed for full functionality)

8. **Enable Realtime** on key tables (profiles, matches, notifications, etc.)
9. **Create Storage buckets** — `avatars` (public), `match-evidence` (private)
10. **Enable Stripe Connect** — Express accounts for payouts
11. **Configure Stripe Customer Portal** — for WAGR subscription management
12. **Set up pg_cron jobs** — membership expiry, ban expiry, rate-limit cleanup, tournament scheduler

### Before real money

13. **Stripe approval** — submit your platform for live gaming/wagering approval (external review)
14. **Switch test → live keys** in Supabase secrets + re-create webhooks with live signing secrets

---

## Summary

| Area | Code Status | Dashboard Status |
|---|---|---|
| Authentication | GREEN — all flows verified + hardened | Needs: auth config (1c), site URL |
| Supabase | GREEN — RPCs match, RLS enforced, payment_events column fixed | Needs: SQL run (1a), Edge Functions (1f-1g), realtime (1d), storage (1e) |
| Netlify | GREEN — SPA redirect, security headers, CSP all correct | Needs: env vars (3a), domain (3b) |
| Stripe | GREEN — all 9 Edge Functions correct, idempotent, signature-verified | Needs: webhooks (2b), Connect (2c), secrets (1g) |
| Code quality | GREEN — no mocks, no secrets, no TODOs, consistent patterns | N/A |

**Bottom line**: Code is launch-ready. Execute DASHBOARD_STEPS.md in order, test the
full deposit→match→withdraw loop in Stripe test mode, then go live.
