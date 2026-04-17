#!/usr/bin/env bash
set -euo pipefail
echo "== Verity Doctor =="
missing=0
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  if ! grep -qE "^$k=" .env.local 2>/dev/null; then
    echo "• missing $k in .env.local"
    missing=1
  fi
done
if [ $missing -eq 1 ]; then
  echo "Add the missing keys to .env.local and rerun."
  exit 1
fi

echo "• Supabase sanity (bills_mv → 1 row max)"
if ! agents/db_read.sh bills_mv 'select=id&limit=1' >/dev/null; then
  echo "  ↳ REST check failed. Verify Supabase URL/key and RLS/view names."
else
  echo "  ↳ ok"
fi

echo "• /api/ask smoke"
ans="$(agents/ask_smoke.sh || true)"
if [ -z "$ans" ]; then
  echo "  ↳ no answer (server not running?). Try: pnpm dev"
else
  echo "  ↳ got response: $(printf '%s' "$ans" | head -c 80)..."
fi

echo "• Build"
pnpm -s next build || echo "  ↳ build returned non-zero (we ignore while stabilizing)"
echo "Done."
