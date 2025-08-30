#!/usr/bin/env bash
set -e
: "${SUPABASE_URL:?SUPABASE_URL must be exported}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY must be exported}"

rows=(
  "Hansard|https://www.aph.gov.au/Parliamentary_Business/Hansard|AU|parliament"
  "PM – Media|https://www.pm.gov.au/media|AU|agency"
  "Attorney-General – Media|https://www.attorneygeneral.gov.au/media|AU|agency"
  "Health – News|https://www.health.gov.au/news|AU|agency"
)

for row in "${rows[@]}"; do
  IFS="|" read -r name url jurisdiction type <<< "$row"
  payload=$(printf '{"p_name":"%s","p_url":"%s","p_jurisdiction":"%s","p_type":"%s"}' \
    "$name" "$url" "$jurisdiction" "$type")
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/create_crawl_job" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" | (command -v jq >/dev/null 2>&1 && jq . || cat)
done

echo "✅ Seeded sources."
