# Fees — Dubbed

## Match Wagers

| Fee | Rate | Notes |
|-----|------|-------|
| Platform rake | 10% of pot | Deducted from winner payout |
| WAGR member rake | 0% | WAGR subscription exempts the rake |

## Side Bets (Event-Based)

| Fee | Rate | Notes |
|-----|------|-------|
| Rake | 5% of **profit** | Profit = (stake × odds) − stake. Rake is on profit only, not the full payout |
| WAGR member rake | 0% | WAGR members pay zero rake on side bets |
| Min bet | $1 | |
| Max bet | $100 | |

### Payout math

```
gross    = stake × odds
profit   = gross − stake
rake     = profit × 0.05        (0 if WAGR member)
net      = gross − rake          (credited to balance)
earnings = profit − rake         (credited to earnings tracker)
```

Losers forfeit their stake (already debited at placement).
Voided events refund all stakes in full.

### Ledger entries

Each settled winning bet produces two `wallet_ledger` rows:
1. `side_bet_payout` — the net payout amount
2. `side_bet_rake` — the rake deducted (0 for WAGR members, omitted if zero)

Voided bets produce a `side_bet_refund` ledger row.
