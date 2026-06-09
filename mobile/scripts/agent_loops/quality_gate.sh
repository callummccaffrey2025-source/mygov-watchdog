#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Verity Quality Gate — Post-pipeline quality sweep
#
# Runs after the daily pipeline (news + brief) to catch issues before
# users see them. Chains Claude agents for content moderation and
# data auditing.
#
# Usage:
#   ./scripts/agent_loops/quality_gate.sh              # Full sweep
#   ./scripts/agent_loops/quality_gate.sh --stage mod   # Content moderation only
#   ./scripts/agent_loops/quality_gate.sh --stage audit  # Data audit only
#   ./scripts/agent_loops/quality_gate.sh --stage summ   # AI summaries only
#
# Cron (daily, 30 min after brief generation):
#   30 21 * * * /bin/bash ~/verity/mobile/scripts/agent_loops/quality_gate.sh >> ~/verity/logs/quality_gate.log 2>&1
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="${HOME}/verity/mobile"

# Cron's PATH lacks nvm — resolve the claude CLI explicitly. nvm paths are
# node-version-specific, so search instead of hardcoding one.
if ! command -v claude >/dev/null 2>&1; then
  CLAUDE_BIN=$(ls -t "$HOME"/.nvm/versions/node/*/bin/claude 2>/dev/null | head -1)
  if [[ -n "${CLAUDE_BIN:-}" ]]; then
    export PATH="$(dirname "$CLAUDE_BIN"):$PATH"
  fi
fi

LOG_DIR="${HOME}/verity/logs"
GATE_LOG="${LOG_DIR}/quality_gate.log"
REPORT_DIR="${LOG_DIR}/quality_reports"
RUN_STAGE="${1:-all}"

mkdir -p "$LOG_DIR" "$REPORT_DIR"

timestamp() { date "+%Y-%m-%d %H:%M:%S"; }
today() { date "+%Y-%m-%d"; }
log() { echo "[$(timestamp)] $1" | tee -a "$GATE_LOG"; }

REPORT_FILE="${REPORT_DIR}/$(today).md"

# ── Stage 1: Content Moderation ──────────────────────────────────────
# Reviews the latest community posts for policy violations.
# Uses the content-moderator agent (Haiku — fast and cheap).

run_content_moderation() {
  log "── Stage 1: Content Moderation ──"

  local prompt="You are the content moderator for Verity. Review the latest 30 community posts and any unresolved reports.

Run these checks from ~/verity/mobile:

1. Query the latest 30 community_posts — check each body for hate speech, misinformation, spam, doxxing, or non-political content
2. Query unresolved community_reports
3. Report findings in this format:

## Content Moderation Report — $(today)
Posts reviewed: N
Flagged: N

| post_id | preview | violation | recommended_action |
|---------|---------|-----------|-------------------|

If nothing flagged, just say: 'All clear — N posts reviewed, 0 violations.'

Be strict on hate speech and misinformation. Be lenient on strong political opinions — this is a democracy app."

  cd "$PROJECT_DIR"
  local output
  output=$(claude -p "$prompt" -a content-moderator --dangerously-skip-permissions 2>&1) || true

  echo "" >> "$REPORT_FILE"
  echo "$output" >> "$REPORT_FILE"
  log "  Content moderation complete"
}

# ── Stage 2: Data Audit ──────────────────────────────────────────────
# Checks data completeness and consistency.
# Uses data-auditor agent (Sonnet — needs to reason about numbers).

run_data_audit() {
  log "── Stage 2: Data Audit ──"

  local prompt="You are the data auditor for Verity. Run a comprehensive data quality check from ~/verity/mobile.

Query Supabase for:
1. Total articles, stories, and sources — compare to yesterday
2. Articles missing source_id or published_at
3. Stories with article_count < 2 (weak clusters)
4. Members missing photo_url, party, or electorate
5. Bills missing plain_summary
6. News sources missing bias_score
7. Today's daily brief — is ai_text populated?
8. Latest pipeline_runs entry — status and timestamp

Output format:
## Data Audit — $(today)

| Metric | Value | Status |
|--------|-------|--------|
| Total articles | N | ✓/✗ |
| ...

End with: 'Data quality score: X/8 checks passed'

Numbers only, no commentary."

  cd "$PROJECT_DIR"
  local output
  output=$(claude -p "$prompt" -a data-auditor --dangerously-skip-permissions 2>&1) || true

  echo "" >> "$REPORT_FILE"
  echo "$output" >> "$REPORT_FILE"
  log "  Data audit complete"
}

# ── Stage 3: AI Summary Backfill ─────────────────────────────────────
# Generates AI summaries for any stories that are eligible but missing them.
# Direct script call — no agent needed.

run_summary_backfill() {
  log "── Stage 3: AI Summary Backfill ──"

  cd "$PROJECT_DIR"

  # Check how many stories need summaries
  local eligible
  eligible=$(python3 -c "
from dotenv import load_dotenv; load_dotenv()
import os; from supabase import create_client
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
r = sb.table('news_stories').select('id', count='exact').gte('article_count', 5).is_('ai_summary', 'null').execute()
print(r.count or 0)
" 2>/dev/null) || eligible="0"

  if [[ "$eligible" -gt 0 ]]; then
    log "  $eligible stories need AI summaries — generating..."
    if [[ -f scripts/generate_ai_summaries.py ]]; then
      python3 scripts/generate_ai_summaries.py >> "$GATE_LOG" 2>&1 || true
      echo "## AI Summaries — $(today)" >> "$REPORT_FILE"
      echo "Generated summaries for $eligible stories" >> "$REPORT_FILE"
    else
      log "  ⚠ generate_ai_summaries.py not found"
    fi
  else
    log "  All eligible stories have AI summaries ✓"
  fi
}

# ── Orchestrate ───────────────────────────────────────────────────────

log "═══════════════════════════════════════════════════"
log "QUALITY GATE START"
log "═══════════════════════════════════════════════════"

echo "# Verity Quality Report — $(today)" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

case "$RUN_STAGE" in
  --stage)
    shift
    case "${1:-}" in
      mod)   run_content_moderation ;;
      audit) run_data_audit ;;
      summ)  run_summary_backfill ;;
      *)     log "Unknown stage: ${1:-}. Use: mod, audit, summ"; exit 1 ;;
    esac
    ;;
  all|*)
    run_content_moderation
    run_data_audit
    run_summary_backfill
    ;;
esac

log "═══════════════════════════════════════════════════"
log "QUALITY GATE COMPLETE — report: $REPORT_FILE"
log "═══════════════════════════════════════════════════"
