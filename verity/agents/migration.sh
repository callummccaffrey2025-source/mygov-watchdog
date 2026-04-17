#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
NAME="${1:?name-like add_bill_fts}"
STAMP=$(date -u +%Y%m%d%H%M%S)
FILE="supabase/migrations/${STAMP}_${NAME}.sql"
mkdir -p supabase/migrations
{
  echo "-- ${NAME}"
  echo "-- up"
  echo
  echo "-- down"
} > "$FILE"
echo "$FILE"
