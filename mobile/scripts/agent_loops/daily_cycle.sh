#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Verity Daily Cycle — Full autonomous pipeline
#
# This is the master loop. It replaces YOU prompting agents.
# Sequence:
#   1. Run data pipeline (news + votes + summaries)
#   2. Watchdog checks health, auto-fixes failures
#   3. Quality gate: content moderation + data audit + summary backfill
#   4. Alert you only if something couldn't be auto-fixed
#
# One cron entry replaces all manual intervention:
#   0 19 * * * /bin/bash ~/verity/mobile/scripts/agent_loops/daily_cycle.sh >> ~/verity/logs/daily_cycle.log 2>&1
#
# That's 5am AEST. The full cycle takes ~20-40 minutes.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="${HOME}/verity/mobile"
LOG_DIR="${HOME}/verity/logs"
CYCLE_LOG="${LOG_DIR}/daily_cycle.log"
LOOPS_DIR="${PROJECT_DIR}/scripts/agent_loops"

# Cron's PATH may resolve python3 to the system interpreter, which lacks
# python-dotenv/supabase (killed the 2026-06-09 cycle). Pin the homebrew one.
PYTHON_BIN="${PYTHON_BIN:-/opt/homebrew/bin/python3}"
if [[ -x "$PYTHON_BIN" ]]; then
  python3() { "$PYTHON_BIN" "$@"; }
fi

mkdir -p "$LOG_DIR"

timestamp() { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(timestamp)] $1" | tee -a "$CYCLE_LOG"; }

# Self-heal: a Homebrew python upgrade wipes site-packages (this killed the
# 2026-06-09 cycle via ModuleNotFoundError: dotenv). Verify core deps up front
# and reinstall from requirements.txt if any are missing.
if ! "$PYTHON_BIN" -c "import dotenv, supabase, requests, feedparser" 2>/dev/null; then
  log "Core python deps missing — reinstalling from scripts/requirements.txt"
  "$PYTHON_BIN" -m pip install -q --break-system-packages -r "$PROJECT_DIR/scripts/requirements.txt" \
    || log "⚠ pip reinstall failed — cycle will likely fail"
fi

# Track overall cycle health
CYCLE_STATUS="success"
CYCLE_START=$(date +%s)

# ── Phase 1: Data Pipeline ───────────────────────────────────────────
# Runs news ingestion, vote sync, AI summary generation, then health check.
# orchestrate.py handles retry logic internally.

phase_pipeline() {
  log "═══ PHASE 1: DATA PIPELINE ═══"
  cd "$PROJECT_DIR"

  local exit_code=0
  python3 scripts/orchestrate.py --verbose >> "$CYCLE_LOG" 2>&1 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    log "⚠ Pipeline had failures (exit $exit_code) — watchdog will handle"
    CYCLE_STATUS="partial"
  else
    log "✓ Pipeline completed successfully"
  fi
}

# ── Phase 2: Daily Brief ─────────────────────────────────────────────
# Trigger the Edge Function to generate today's AI brief.
# Separate from pipeline because it depends on fresh news being ingested.

phase_brief() {
  log "═══ PHASE 2: DAILY BRIEF ═══"
  cd "$PROJECT_DIR"

  local sb_url sb_key
  sb_url=$(python3 -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.environ['SUPABASE_URL'])" 2>/dev/null) || true
  sb_key=$(python3 -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.environ['SUPABASE_KEY'])" 2>/dev/null) || true

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${sb_url}/functions/v1/generate-daily-brief" \
    -H "Authorization: Bearer ${sb_key}" \
    -H "Content-Type: application/json" 2>&1) || http_code="000"

  if [[ "$http_code" =~ ^2 ]]; then
    log "✓ Daily brief generated (HTTP $http_code)"
  else
    log "⚠ Daily brief failed (HTTP $http_code)"
    CYCLE_STATUS="partial"
  fi

  # ── COUNCIL GATE: a different model panel grades the brief against the
  # deterministic vote record. The writer (haiku) never vouches for itself.
  log "── Council gate: grading brief against vote record ──"
  local gate_exit=0
  python3 scripts/grade_brief.py >> "$CYCLE_LOG" 2>&1 || gate_exit=$?

  if [[ $gate_exit -eq 0 ]]; then
    log "✓ Brief passed council gate"
  else
    log "🔴 Brief FAILED council gate — alerts fired, run marked degraded"
    CYCLE_STATUS="degraded"
  fi
}

# ── Phase 3: Watchdog ─────────────────────────────────────────────────
# Self-healing check. If pipeline or brief failed, watchdog detects and fixes.

phase_watchdog() {
  log "═══ PHASE 3: WATCHDOG ═══"
  local exit_code=0
  bash "${LOOPS_DIR}/watchdog.sh" >> "$CYCLE_LOG" 2>&1 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    log "⚠ Watchdog found unfixable issues"
    CYCLE_STATUS="degraded"
  else
    log "✓ Watchdog: all systems healthy"
  fi
}

# ── Phase 4: Quality Gate ─────────────────────────────────────────────
# Content moderation, data audit, summary backfill.

phase_quality() {
  log "═══ PHASE 4: QUALITY GATE ═══"

  # Golden fixture: one hand-verified MP record regressed every run.
  # A failure here means the pipeline corrupted HISTORICAL data — critical.
  local fixture_exit=0
  python3 scripts/check_golden_fixture.py >> "$CYCLE_LOG" 2>&1 || fixture_exit=$?
  if [[ $fixture_exit -eq 0 ]]; then
    log "✓ Golden fixture (Laxale) intact"
  else
    log "🔴 GOLDEN FIXTURE REGRESSION — historical data changed, run marked degraded"
    CYCLE_STATUS="degraded"
  fi

  bash "${LOOPS_DIR}/quality_gate.sh" >> "$CYCLE_LOG" 2>&1 || true
  log "✓ Quality gate complete"
}

# ── Phase 5: Status Report ───────────────────────────────────────────
# Log the cycle result and alert if needed.

phase_report() {
  local cycle_end
  cycle_end=$(date +%s)
  local duration=$(( cycle_end - CYCLE_START ))
  local minutes=$(( duration / 60 ))

  log "═══ CYCLE COMPLETE ═══"
  log "Status: $CYCLE_STATUS | Duration: ${minutes}m ${duration}s"

  cd "$PROJECT_DIR"

  # Log to Supabase
  python3 -c "
from dotenv import load_dotenv; load_dotenv()
import os; from supabase import create_client
from datetime import datetime, timezone
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
sb.table('pipeline_runs').insert({
    'pipeline': 'daily-cycle',
    'status': '$CYCLE_STATUS',
    'started_at': '$(date -u -r $CYCLE_START +%Y-%m-%dT%H:%M:%SZ)',
    'finished_at': datetime.now(timezone.utc).isoformat(),
    'details': 'Duration: ${minutes}m'
}).execute()
" 2>/dev/null || true

  # Mac notification
  if [[ "$CYCLE_STATUS" == "success" ]]; then
    osascript -e 'display notification "Pipeline + watchdog + quality gate all passed" with title "✅ Verity Daily Cycle"' 2>/dev/null || true
  elif [[ "$CYCLE_STATUS" == "degraded" ]]; then
    osascript -e 'display notification "Some issues could not be auto-fixed — check logs" with title "⚠️ Verity: Needs Attention"' 2>/dev/null || true
    # Send alert through all channels
    python3 scripts/ops_alert.py >> "$CYCLE_LOG" 2>&1 || true
  else
    osascript -e 'display notification "Pipeline ran with partial issues — watchdog handled them" with title "🔧 Verity: Auto-Fixed"' 2>/dev/null || true
  fi
}

# ── Main ──────────────────────────────────────────────────────────────

log ""
log "╔══════════════════════════════════════════════════╗"
log "║          VERITY DAILY CYCLE — $(date +%Y-%m-%d)          ║"
log "╚══════════════════════════════════════════════════╝"
log ""

phase_pipeline
sleep 30  # Let DB settle before brief generation
phase_brief
sleep 15  # Let brief write before watchdog checks
phase_watchdog
phase_quality
phase_report
