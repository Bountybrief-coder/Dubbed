# Dubbed Production Launch Checklist

## 1. SQL Migrations (run in order)

```bash
# Step 1: Base schema (if fresh DB — skip if already deployed)
supabase db query --linked -f supabase_setup.sql

# Step 2: Production audit fixes (B1 prize split, B2 balance CHECK, B3 revoke deposit)
supabase db query --linked -f migrate_prod_audit.sql

# Step 3: Tournament check-in system
supabase db query --linked -f migrate_tournament_checkin.sql

# Step 4: CRITICAL — Lock down internal RPCs + cap bets
supabase db query --linked -f migrate_security_lockdown.sql
```

## 2. Environment Variables

### Frontend (Netlify — already set)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon (public) key

### Edge Functions (Supabase secrets — set via `supabase secrets set`)
- `STRIPE_SECRET_KEY` — Stripe secret key (sk_live_...)
- `STRIPE_DEPOSIT_WEBHOOK_SECRET` — Stripe webhook secret for deposits
- `STRIPE_SHOP_WEBHOOK_SECRET` — Stripe webhook secret for shop
- `STRIPE_WEBHOOK_SECRET` — Stripe general webhook secret
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (never in frontend)

## 3. Supabase Dashboard Settings

- [ ] Enable Realtime for all tables listed in the publication block
- [ ] Verify RLS is ON for all 42 tables (query: `select tablename from pg_tables where schemaname='public' and tablename not in (select tablename from pg_tables where schemaname='public' and rowsecurity=true)`)
- [ ] Confirm `auth.email` sign-in enabled
- [ ] Set rate limits on auth endpoints
- [ ] Enable email confirmation (if desired)

## 4. Stripe Configuration

- [ ] Configure Stripe checkout return URLs for production domain (dubbed.pro)
- [ ] Set up Stripe webhook endpoints pointing to Edge Functions
- [ ] Test deposit → balance credit flow end-to-end
- [ ] Test withdrawal → payout flow end-to-end

## 5. Netlify Configuration (already done)

- [x] SPA fallback: `/* → /index.html` (netlify.toml + _redirects)
- [x] Security headers: HSTS, X-Frame-Options, CSP, nosniff
- [x] Cache-Control on /assets/* (immutable, 1yr)
- [x] Node 20 for build

## 6. Pre-Launch Smoke Test

1. **Auth**: Sign up → verify email → sign in → profile loads
2. **Wallet**: Deposit $5 → balance updates → ledger shows entry
3. **XP Match**: Create → join from 2nd account → report → settle → stats update
4. **Cash Match**: Create $5 → join → report → settle → winner gets payout
5. **Tournament**: Create → register → check in → bracket generates → play through
6. **P2P Bet**: Create offer → accept from 2nd account → admin settles → payout
7. **Side Bet**: Admin creates event → place bet → admin settles → payout
8. **Shop**: Buy username change → use it → verify
9. **Withdrawal**: Request $10 → verify hold → approve → payout arrives
10. **Realtime**: Open match → watch it update live in another tab

## 7. Blockers Resolved

| # | Issue | Fix | Status |
|---|---|---|---|
| B1 | Tournament prize split mismatch | `migrate_prod_audit.sql` + `supabase_setup.sql` | **FIXED IN CODE** |
| B2 | No balance >= 0 constraint | `migrate_prod_audit.sql` | **READY TO DEPLOY** |
| B3 | deposit RPC callable by authenticated | `migrate_prod_audit.sql` | **READY TO DEPLOY** |
| B4 | No tournament check-in | `migrate_tournament_checkin.sql` + frontend | **READY TO DEPLOY** |
| B5 | settle_match callable by anyone (steal pot) | `migrate_security_lockdown.sql` REVOKE | **READY TO DEPLOY** |
| B6 | settle_bet callable by anyone (force-win) | `migrate_security_lockdown.sql` REVOKE | **READY TO DEPLOY** |
| B7 | settle_tournament_auto callable by anyone | `migrate_security_lockdown.sql` REVOKE | **READY TO DEPLOY** |
| B8 | place_bet no stake/odds cap (infinite payout) | `migrate_security_lockdown.sql` + `supabase_setup.sql` | **READY TO DEPLOY** |
