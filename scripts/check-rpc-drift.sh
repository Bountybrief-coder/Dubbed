#!/bin/bash
# Check for frontend RPC calls with no matching SQL definition.
# Run from project root: bash scripts/check-rpc-drift.sh

set -euo pipefail

FRONTEND_RPCS=$(grep -roh 'supabase\.rpc("[^"]*"' src/ 2>/dev/null | sed 's/.*rpc("\([^"]*\)".*/\1/' | sort -u)
SQL_FUNCS=$(grep -o 'create or replace function public\.[a-z_]*' supabase_setup.sql 2>/dev/null | sed 's/.*public\.\([a-z_]*\)/\1/' | sort -u)

MISSING=$(comm -23 <(echo "$FRONTEND_RPCS") <(echo "$SQL_FUNCS"))

if [ -z "$MISSING" ]; then
  echo "✓ All frontend RPCs have matching SQL definitions."
  exit 0
else
  echo "✗ Frontend calls these RPCs but no SQL definition found:"
  echo "$MISSING" | while read -r rpc; do
    FILE=$(grep -rln "supabase\.rpc(\"$rpc\"" src/ 2>/dev/null | head -1)
    echo "  - $rpc  ($FILE)"
  done
  exit 1
fi
