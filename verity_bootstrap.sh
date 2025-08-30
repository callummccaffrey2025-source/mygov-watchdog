#!/usr/bin/env bash
# Re-exec under Bash if launched from zsh/sh
if [ -z "${BASH_VERSION:-}" ]; then
  if [ -x /opt/homebrew/bin/bash ]; then exec /opt/homebrew/bin/bash "$0" "$@"; else exec /bin/bash "$0" "$@"; fi
fi
set -euo pipefail

log(){ printf "\n\033[1m▶ %s\033[0m\n" "$*"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing $1. Install it and re-run."; exit 1; }; }

need jq; need supabase; need vercel; need pnpm

TARGET_REF="${TARGET_REF:-}"
if [[ -z "$TARGET_REF" ]]; then
  echo "Set TARGET_REF=<supabase-ref> first (e.g., export TARGET_REF=sksgckurougyydhfmcse)"; exit 1
fi

# -------- Supabase link & keys --------
log "Linking Supabase project: $TARGET_REF"
supabase link --project-ref "$TARGET_REF" >/dev/null || true

log "Fetching Supabase API keys"
supabase projects api-keys --project-ref "$TARGET_REF" -o env > .supabase.prod.env

export SUPABASE_URL="https://${TARGET_REF}.supabase.co"
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(grep '^SUPABASE_ANON_KEY=' .supabase.prod.env | cut -d= -f2-)"
export SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .supabase.prod.env | cut -d= -f2-)"

# -------- .env.local upsert --------
log "Upserting .env.local core vars"
awk -v site="https://verity.run" \
    -v url="$SUPABASE_URL" \
    -v anon="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -v srole="$SUPABASE_SERVICE_ROLE_KEY" '
BEGIN{FS=OFS="="}
function put(k,v){ if(v!=""){ seen[k]=1; kv[k]=v } }
{ if($1~/^[A-Za-z_][A-Za-z0-9_]*$/){ if(!seen[$1]) order[++n]=$1; kv[$1]=$2 } }
END{
  put("NEXT_PUBLIC_SITE_URL",site)
  put("NEXT_PUBLIC_SUPABASE_URL",url)
  put("NEXT_PUBLIC_SUPABASE_ANON_KEY",anon)
  put("SUPABASE_SERVICE_ROLE_KEY",srole)
  for(i=1;i<=n;i++) print order[i],kv[order[i]];
  if(!("NEXT_PUBLIC_SITE_URL" in seen)) print "NEXT_PUBLIC_SITE_URL",kv["NEXT_PUBLIC_SITE_URL"];
  if(!("NEXT_PUBLIC_SUPABASE_URL" in seen)) print "NEXT_PUBLIC_SUPABASE_URL",kv["NEXT_PUBLIC_SUPABASE_URL"];
  if(!("NEXT_PUBLIC_SUPABASE_ANON_KEY" in seen)) print "NEXT_PUBLIC_SUPABASE_ANON_KEY",kv["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if(!("SUPABASE_SERVICE_ROLE_KEY" in seen)) print "SUPABASE_SERVICE_ROLE_KEY",kv["SUPABASE_SERVICE_ROLE_KEY"];
}' .env.local 2>/dev/null > .env.local.new && mv .env.local.new .env.local

# -------- Back-compat export (supaAdmin alias) --------
if [[ -f src/lib/supabaseAdmin.ts ]]; then
  if ! grep -q 'export { supabaseAdmin as supaAdmin }' src/lib/supabaseAdmin.ts; then
    log "Adding supaAdmin alias export"
    printf '\nexport { supabaseAdmin as supaAdmin };\n' >> src/lib/supabaseAdmin.ts
  fi
fi

# -------- Force dynamic for API routes (avoid build freeze) --------
log "Ensuring API routes are dynamic"
while IFS= read -r f; do
  grep -q "export const dynamic = 'force-dynamic'" "$f" || \
    printf "export const dynamic = 'force-dynamic';\n%s" "$(cat "$f")" > "$f.tmp" && mv "$f.tmp" "$f"
done < <(find src/app/api -type f -name 'route.ts' 2>/dev/null || true)

# -------- Push envs to Vercel (prod/preview/dev) --------
log "Pushing core envs to Vercel"
for env in production preview development; do
  for K in NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
    V="$(grep -E "^$K=" .env.local | cut -d= -f2- || true)"
    [[ -z "$V" ]] && continue
    { printf "%s" "$V" | vercel env add "$K" "$env" >/dev/null; } || true
  done
done

# -------- Normalise vercel.json cron for Hobby (once/day) --------
if [[ -f vercel.json ]] && jq -e '.crons' vercel.json >/dev/null 2>&1; then
  log "Setting cron to once daily (02:00 UTC) for Hobby"
  tmp="$(mktemp)"; jq '.crons = [ { "path": "/api/cron/worker-crawl", "schedule": "0 2 * * *" } ]' vercel.json > "$tmp" && mv "$tmp" vercel.json
fi

# -------- Deploy Supabase function if present --------
if [[ -d supabase/functions/crawler ]]; then
  log "Deploying Supabase function: crawler"
  supabase secrets set SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --project-ref "$TARGET_REF" >/dev/null
  supabase functions deploy crawler --project-ref "$TARGET_REF" || true
else
  log "No supabase/functions/crawler found; skipping function deploy"
fi

# -------- Seed two demo docs --------
log "Seeding two demo docs to validate ingestion/search"
jq -cn '
[
 {"title":"Bail Act NSW — 2024 amendment","url":"https://legislation.nsw.gov.au/bail-2024","jurisdiction":"NSW","content":"curated summary"},
 {"title":"Commonwealth Budget 2024–25","url":"https://budget.gov.au/2024-25","jurisdiction":"AU","content":"curated summary"}
] | .[]' | while read -r row; do
  curl -sS "$SUPABASE_URL/rest/v1/document" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$row" >/dev/null || true
done

# -------- Build & deploy web --------
log "Installing deps & building"
pnpm install --frozen-lockfile || pnpm install
pnpm build

log "Deploying to Vercel prod"
vercel deploy --prod

log "Done. Manual items remain: rotate Supabase keys if leaked, Stripe + webhook, RevenueCat, app store provisioning, Sentry DSN, CI tokens."
