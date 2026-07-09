# Dubbed — Fee Schedule

All money math lives in SQL (SECURITY DEFINER RPCs). The JS `RAKE_CONFIG` in
`src/utils/games.js` is used for display/estimation only — the SQL functions
are authoritative.

## Match Rake

| Context | Rate | WAGR Member | Source |
|---|---|---|---|
| Cash match (winner's pot) | 10% | 0% | `settle_match` in `supabase_setup.sql` |

Winner receives: `pot - rake`. Loser receives nothing (entry already debited).

> **Note:** `RAKE_CONFIG.standard` in JS is `0.05` (5%) while the SQL charges
> 10%. The JS value is used in the match-creation UI for estimates. The SQL
> is what actually runs. Align these if/when the business rate is finalized.

## Tournament Rake

| Context | Rate | Source |
|---|---|---|
| Tournament pot (entry × joined teams) | 2% | `settle_tournament` |

Payout split after rake: 1st 83.3%, 2nd 10%, 3rd 6.7%.

## Side-Bet Rake

| Context | Rate | WAGR Member | Source |
|---|---|---|---|
| Winning bet profit (gross − stake) | 5% | 0% | `settle_bet` |

- **Won:** gross = stake × odds. profit = gross − stake. rake = profit × 5%.
  Net credited = gross − rake. Ledger reason: `bet_payout`.
- **Lost:** no movement — stake was debited at `place_bet` time.
- **Void:** full stake refund. Ledger reason: `bet_refund`.

Bets linked to a match (`match_id` column) auto-settle when `settle_match`
runs via `settle_match_bets`.

## Withdrawal Fee

**$0.** No fees are charged on withdrawals. The full requested amount is sent
via Stripe Transfer to the user's connected Express account. See
`request_withdrawal`, `mark_withdrawal_paid`, and `stripe-payout/index.ts`.

## Deposit Fee

**$0.** Stripe Checkout handles deposits; any Stripe processing fees are
absorbed by the platform, not passed to the user.

## Minimum Rake

`RAKE_CONFIG.minimum` in JS is `$0.25`. This is a UI-side floor used for
display estimates in the match-creation flow. The SQL `settle_match` does
not enforce a minimum — it takes a flat 10% (or 0% for WAGR).
