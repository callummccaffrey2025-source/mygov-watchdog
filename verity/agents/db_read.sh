#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
. agents/.lib.sh

BASE_URL="$(read_env NEXT_PUBLIC_SUPABASE_URL)"
ANON="$(read_env NEXT_PUBLIC_SUPABASE_ANON_KEY)"
: "${BASE_URL:?NEXT_PUBLIC_SUPABASE_URL missing in .env.local}"
: "${ANON:?NEXT_PUBLIC_SUPABASE_ANON_KEY missing in .env.local}"

TABLE="${1:?table name}"; shift
QUERY="${1:-select=*&limit=10}"
URL="${BASE_URL%/}/rest/v1/${TABLE}?${QUERY}"

curl -sSf "$URL" \
  -H "apikey: ${ANON}" \
  -H "Authorization: Bearer ${ANON}" \
  -H 'Accept: application/json' \
  || { echo; echo "Request failed → $URL" 1>&2; exit 1; }
echo
