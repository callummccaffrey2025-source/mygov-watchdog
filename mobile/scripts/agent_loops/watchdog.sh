#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Verity Watchdog — Self-healing data pipeline loop
#
# Detects failures → routes to the right fix → verifies the fix worked.
# Circuit breaker: gives up after 2 failed fix attempts per issue.
#
# Usage:
#   ./scripts/agent_loops/watchdog.sh              # Run once (cron mode)
#   ./scripts/agent_loops/watchdog.sh --loop 4h    # Run every 4 hours
#   ./scripts/agent_loops/watchdog.sh --dry-run    # Check only, don't fix
#
# Cron (every 4 hours, offset from pipeline):
#   0 1,5,9,13,17,21 * * * /bin/bash ~/verity/mobile/scripts/agent_loops/watchdog.sh >> ~/verity/logs/watchdog.log 2>&1
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="${HOME}/verity/mobile"
LOG_DIR="${HOME}/verity/logs"
WATCHDOG_LOG="${LOG_DIR}/watchdog.log"
WATCHDOG_STATE="${PROJECT_DIR}/scripts/agent_loops/.watchdog_state.json"
MAX_FIX_ATTEMPTS=2
DRY_RUN=false
LOOP_MODE=false
LOOP_INTERVAL=""

mkdir -p "$LOG_DIR"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --loop) LOOP_MODE=true; LOOP_INTERVAL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Convert interval like "4h" to seconds
interval_to_seconds() {
  local val="${1%[hms]}"
  local unit="${1: -1}"
  case "$unit" in
    h) echo $((val * 3600)) ;;
    m) echo $((val * 60)) ;;
    s) echo "$val" ;;
    *) echo $((val * 3600)) ;; # default hours
  esac
}

timestamp() { date "+%Y-%m-%d %H:%M:%S"; }

log() {
  echo "[$(timestamp)] $1" | tee -a "$WATCHDOG_LOG"
}

# ── State management (circuit breaker) ────────────────────────────────

init_state() {
  if [[ ! -f "$WATCHDOG_STATE" ]]; then
    echo '{}' > "$WATCHDOG_STATE"
  fi
}

get_fix_attempts() {
  local issue="$1"
  python3 -c "
import json, sys
with open('$WATCHDOG_STATE') as f: state = json.load(f)
print(state.get('$issue', {}).get('attempts', 0))
" 2>/dev/null || echo "0"
}

record_fix_attempt() {
  local issue="$1"
  local success="$2"
  python3 -c "
import json
from datetime import datetime
with open('$WATCHDOG_STATE') as f: state = json.load(f)
if '$issue' not in state: state['$issue'] = {'attempts': 0, 'history': []}
entry = state['$issue']
entry['attempts'] += 1
entry['history'].append({'at': datetime.utcnow().isoformat(), 'success': $success})
if $success:
    entry['attempts'] = 0  # reset on success
with open('$WATCHDOG_STATE', 'w') as f: json.dump(state, f, indent=2)
"
}

reset_state() {
  echo '{}' > "$WATCHDOG_STATE"
}

# ── Health check ──────────────────────────────────────────────────────

run_health_check() {
  log "═══ WATCHDOG HEALTH CHECK ═══"
  cd "$PROJECT_DIR"

  # Run data_monitor.py and capture output + exit code
  local output
  local exit_code=0
  output=$(python3 scripts/data_monitor.py 2>&1) || exit_code=$?

  echo "$output" >> "$WATCHDOG_LOG"

  # Parse which checks failed
  FAILED_CHECKS=()
  while IFS= read -r line; do
    if echo "$line" | grep -q "✗"; then
      # Extract check name (second field after ✗)
      local check_name
      check_name=$(echo "$line" | sed 's/.*✗[[:space:]]*//' | awk '{print $1}')
      FAILED_CHECKS+=("$check_name")
    fi
  done <<< "$output"

  if [[ ${#FAILED_CHECKS[@]} -eq 0 ]]; then
    log "✓ ALL CHECKS PASSED — nothing to fix"
    reset_state
    return 0
  fi

  log "✗ FAILED: ${FAILED_CHECKS[*]}"
  return 1
}

# ── Fix routing ───────────────────────────────────────────────────────
# Maps each health check failure to the correct remediation action.
# This is where the loop replaces you — each fix is what you'd do manually.

fix_issue() {
  local issue="$1"
  local attempts
  attempts=$(get_fix_attempts "$issue")

  if [[ "$attempts" -ge "$MAX_FIX_ATTEMPTS" ]]; then
    log "⊘ CIRCUIT BREAKER: $issue has failed $attempts fix attempts — skipping (needs human)"
    return 1
  fi

  log "⚡ Attempting fix for: $issue (attempt $((attempts + 1))/$MAX_FIX_ATTEMPTS)"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "  [DRY RUN] Would fix: $issue"
    return 0
  fi

  cd "$PROJECT_DIR"
  local fix_exit=0

  case "$issue" in
    articles_fresh)
      # News is stale — re-run the triple-source ingestion
      log "  → Running: python3 scripts/ingest_news.py --fresh"
      python3 scripts/ingest_news.py --fresh >> "$WATCHDOG_LOG" 2>&1 || fix_exit=$?
      ;;

    stories_active)
      # Not enough stories clustered — re-ingest news (stories are derived from articles)
      log "  → Running: python3 scripts/ingest_news.py --fresh"
      python3 scripts/ingest_news.py --fresh >> "$WATCHDOG_LOG" 2>&1 || fix_exit=$?
      ;;

    brief_present)
      # Daily brief missing — trigger the Edge Function
      log "  → Triggering daily brief Edge Function"
      local sb_url sb_key
      sb_url=$(python3 -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.environ['SUPABASE_URL'])")
      sb_key=$(python3 -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.environ['SUPABASE_KEY'])")
      curl -s -X POST "${sb_url}/functions/v1/generate-daily-brief" \
        -H "Authorization: Bearer ${sb_key}" \
        -H "Content-Type: application/json" \
        >> "$WATCHDOG_LOG" 2>&1 || fix_exit=$?
      ;;

    bias_coverage)
      # Bias scores missing on recent articles — run the MBFC scraper
      log "  → Running: python3 scripts/scrape_mbfc_bulk.py"
      if [[ -f scripts/scrape_mbfc_bulk.py ]]; then
        python3 scripts/scrape_mbfc_bulk.py >> "$WATCHDOG_LOG" 2>&1 || fix_exit=$?
      else
        log "  ⚠ scrape_mbfc_bulk.py not found — skipping"
        fix_exit=1
      fi
      ;;

    members_active)
      # Member count dropped — this is serious, don't auto-fix, escalate
      log "  ⚠ Member count issue — escalating (not safe to auto-fix)"
      python3 scripts/ops_alert.py --force >> "$WATCHDOG_LOG" 2>&1
      fix_exit=1  # Force circuit breaker to kick in
      ;;

    *)
      log "  ⚠ Unknown issue: $issue — no auto-fix available"
      fix_exit=1
      ;;
  esac

  if [[ $fix_exit -eq 0 ]]; then
    log "  ✓ Fix completed for: $issue"
    record_fix_attempt "$issue" "True"
    return 0
  else
    log "  ✗ Fix failed for: $issue"
    record_fix_attempt "$issue" "False"
    return 1
  fi
}

# ── Verify fixes ──────────────────────────────────────────────────────

verify_fixes() {
  log "── Verifying fixes... ──"
  sleep 10  # Give Edge Functions / DB a moment to settle

  local output
  local exit_code=0
  cd "$PROJECT_DIR"
  output=$(python3 scripts/data_monitor.py 2>&1) || exit_code=$?

  local still_broken=()
  while IFS= read -r line; do
    if echo "$line" | grep -q "✗"; then
      local check_name
      check_name=$(echo "$line" | sed 's/.*✗[[:space:]]*//' | awk '{print $1}')
      still_broken+=("$check_name")
    fi
  done <<< "$output"

  if [[ ${#still_broken[@]} -eq 0 ]]; then
    log "✓ ALL FIXES VERIFIED — system healthy"
    reset_state
    return 0
  else
    log "⚠ Still broken after fixes: ${still_broken[*]}"
    return 1
  fi
}

# ── Alert on unresolved issues ────────────────────────────────────────

escalate() {
  log "🔴 ESCALATING — issues could not be auto-fixed"
  cd "$PROJECT_DIR"
  python3 scripts/ops_alert.py >> "$WATCHDOG_LOG" 2>&1 || true
}

# ── Main loop ─────────────────────────────────────────────────────────

run_once() {
  init_state

  if run_health_check; then
    return 0
  fi

  # Attempt fixes for each failed check
  local any_fix_failed=false
  for issue in "${FAILED_CHECKS[@]}"; do
    fix_issue "$issue" || any_fix_failed=true
  done

  # If we attempted any fixes, verify they worked
  if [[ "$DRY_RUN" == "false" ]]; then
    if ! verify_fixes; then
      escalate
      return 1
    fi
  fi

  return 0
}

# ── Entry point ───────────────────────────────────────────────────────

log "═══════════════════════════════════════════════════"
log "WATCHDOG START $(if $DRY_RUN; then echo '(DRY RUN)'; fi)"
log "═══════════════════════════════════════════════════"

if [[ "$LOOP_MODE" == "true" ]]; then
  SLEEP_SECONDS=$(interval_to_seconds "$LOOP_INTERVAL")
  log "Loop mode: running every ${LOOP_INTERVAL} (${SLEEP_SECONDS}s)"
  while true; do
    run_once || true
    log "Sleeping ${LOOP_INTERVAL} until next check..."
    sleep "$SLEEP_SECONDS"
  done
else
  run_once
  exit_code=$?
  log "WATCHDOG COMPLETE (exit: $exit_code)"
  exit $exit_code
fi
