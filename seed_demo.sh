#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_URL:?}"; : "${SUPABASE_SERVICE_ROLE_KEY:?}"

docs='[
  {"title":"Bail Act NSW — 2024 amendment","url":"https://legislation.nsw.gov.au/bail-2024","jurisdiction":"NSW","content":"curated summary"},
  {"title":"Commonwealth Budget 2024–25","url":"https://budget.gov.au/2024-25","jurisdiction":"AU","content":"curated summary"}
]'
echo "$docs" | jq -c '.[]' | while read -r row; do
  curl -sS "$SUPABASE_URL/rest/v1/document" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$row" >/dev/null
done
echo "Seeded."
