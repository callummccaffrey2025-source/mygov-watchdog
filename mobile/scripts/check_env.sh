#!/usr/bin/env bash
# check_env.sh — Validate required environment variables are set.
#
# Usage:
#   bash scripts/check_env.sh
#
# Reads from .env via dotenv if available, otherwise checks current shell env.
# Exit code 1 if any required var is missing. Prints names only, never values.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

# Source .env if it exists (without export, just for checking)
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

ERRORS=0
WARNINGS=0

check_required() {
  local var_name="$1"
  local description="$2"
  if [ -z "${!var_name:-}" ]; then
    echo "  MISSING: $var_name — $description"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK:      $var_name"
  fi
}

check_optional() {
  local var_name="$1"
  local description="$2"
  if [ -z "${!var_name:-}" ]; then
    echo "  SKIP:    $var_name — $description (optional)"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  OK:      $var_name"
  fi
}

echo "Verity Environment Check"
echo "========================"
echo ""

echo "1. Client-side (required for app to run)"
check_required "EXPO_PUBLIC_SUPABASE_URL" "Supabase project URL"
check_required "EXPO_PUBLIC_SUPABASE_ANON_KEY" "Supabase anon key"
echo ""

echo "2. Database access (required for scripts)"
check_required "SUPABASE_URL" "Supabase project URL (scripts)"
check_required "SUPABASE_KEY" "Supabase service role key"
echo ""

echo "3. AI features"
check_required "ANTHROPIC_API_KEY" "Claude API key for AI summaries/briefs"
echo ""

echo "4. Data ingestion APIs"
check_required "THEYVOTEFORYOU_API_KEY" "TheyVoteForYou API"
check_required "OPENAUSTRALIA_API_KEY" "OpenAustralia API (Hansard)"
check_required "NEWSAPI_KEY" "NewsAPI.org"
check_required "GNEWS_KEY" "GNews API"
check_required "MEDIASTACK_KEY" "Mediastack API"
echo ""

echo "5. Optional services"
check_optional "PINECONE_API_KEY" "Vector embeddings (experimental)"
check_optional "PINECONE_HOST" "Pinecone host (experimental)"
check_optional "OPENAI_API_KEY" "OpenAI embeddings (experimental)"
check_optional "SLACK_WEBHOOK_URL" "Ops alerts to Slack"
check_optional "ADMIN_PUSH_TOKEN" "Ops alerts via push notification"
check_optional "EXPO_PUBLIC_ADMIN_EMAILS" "Admin emails for Daily Question"
echo ""

echo "========================"
if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS required variable(s) missing, $WARNINGS optional skipped"
  echo "See docs/ENVIRONMENT.md for setup instructions."
  exit 1
else
  echo "PASS: All required variables set ($WARNINGS optional skipped)"
  exit 0
fi
