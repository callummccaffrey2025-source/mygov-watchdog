#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Verity Swarm — Parallel coordinated Claude Code agents
#
# Spawns multiple Claude Code sessions in parallel, each working on a
# different track. All agents share a coordination file so they know
# what others are doing and don't conflict.
#
# Usage:
#   ./scripts/agent_loops/swarm.sh                    # Run all tracks
#   ./scripts/agent_loops/swarm.sh --tracks infra,ui  # Run specific tracks
#   ./scripts/agent_loops/swarm.sh --plan              # Show what would run
#   ./scripts/agent_loops/swarm.sh --file SPRINT.md    # Use custom task file
#
# Prerequisites:
#   - claude CLI installed and authenticated
#   - SPRINT.md exists with tasks (or specify --file)
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail

PROJECT_DIR="${HOME}/verity/mobile"

# Cron's PATH lacks nvm — resolve the claude CLI explicitly. nvm paths are
# node-version-specific, so search instead of hardcoding one.
if ! command -v claude >/dev/null 2>&1; then
  CLAUDE_BIN=$(ls -t "$HOME"/.nvm/versions/node/*/bin/claude 2>/dev/null | head -1)
  if [[ -n "${CLAUDE_BIN:-}" ]]; then
    export PATH="$(dirname "$CLAUDE_BIN"):$PATH"
  fi
fi

LOG_DIR="${HOME}/verity/logs/swarm"
STATE_FILE="${PROJECT_DIR}/scripts/agent_loops/.swarm_state.json"
TASK_FILE="${PROJECT_DIR}/SPRINT.md"
PLAN_ONLY=false
SELECTED_TRACKS=""
MAX_PER_TRACK=2

mkdir -p "$LOG_DIR"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --tracks) SELECTED_TRACKS="$2"; shift 2 ;;
    --plan) PLAN_ONLY=true; shift ;;
    --file) TASK_FILE="${PROJECT_DIR}/$2"; shift 2 ;;
    --max) MAX_PER_TRACK="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

timestamp() { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(timestamp)] $1"; }

# ── Coordination state ────────────────────────────────────────────────
# Shared file all agents can read. Updated by this coordinator.

init_state() {
  cat > "$STATE_FILE" << EOF
{
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tracks": {},
  "completed": [],
  "conflicts": []
}
EOF
}

update_track_state() {
  local track="$1" status="$2" task="$3"
  python3 -c "
import json
with open('$STATE_FILE') as f: state = json.load(f)
state['tracks']['$track'] = {'status': '$status', 'task': '$task', 'updated': '$(date -u +%Y-%m-%dT%H:%M:%SZ)'}
if '$status' == 'done':
    state['completed'].append({'track': '$track', 'task': '$task'})
with open('$STATE_FILE', 'w') as f: json.dump(state, f, indent=2)
" 2>/dev/null
}

# ── Track definitions ─────────────────────────────────────────────────
# Each track is a lane of work. Agents in different tracks can run in
# parallel because they touch different files/areas.
#
# RULE: tracks must not overlap in the files they modify.

declare -A TRACK_SCOPE
declare -A TRACK_AGENT
declare -A TRACK_DESC

# Track: infra — data pipeline, scripts, edge functions
TRACK_SCOPE[infra]="scripts/ supabase/functions/"
TRACK_AGENT[infra]="pipeline-operator"
TRACK_DESC[infra]="Data pipeline, ingestion scripts, edge functions"

# Track: ui — screens, components, visual polish
TRACK_SCOPE[ui]=""
TRACK_AGENT[ui]=""
TRACK_DESC[ui]="Screens, components, visual changes"

# Track: data — Supabase queries, hooks, data layer
TRACK_SCOPE[data]=""
TRACK_AGENT[data]="data-auditor"
TRACK_DESC[data]="Hooks, queries, data integrity"

# Track: perf — performance optimization
TRACK_SCOPE[perf]=""
TRACK_AGENT[perf]="perf-optimizer"
TRACK_DESC[perf]="FlatList, memo, bundle size, lazy loading"

# Track: quality — design enforcement, accessibility, type safety
TRACK_SCOPE[quality]=""
TRACK_AGENT[quality]="design-enforcer"
TRACK_DESC[quality]="Design system compliance, a11y, TypeScript"

ALL_TRACKS="infra ui data perf quality"

# ── Build the shared context prompt ──────────────────────────────────

build_context() {
  local track="$1"
  local task_content=""

  if [[ -f "$TASK_FILE" ]]; then
    task_content=$(cat "$TASK_FILE")
  fi

  cat << PROMPT
You are one agent in a coordinated swarm building Verity, an Australian civic intelligence app.

## Your track: ${track}
${TRACK_DESC[$track]}

## Coordination
Other agents are working in parallel on different tracks. Read the swarm state to see what they're doing:
  cat scripts/agent_loops/.swarm_state.json

DO NOT modify files outside your track's scope. If you need a change in another track, note it in the swarm state file under "conflicts" and move on.

## Your scope
${TRACK_SCOPE[$track]:-"Any files relevant to your track (screens/, components/, hooks/, lib/)"}

## Task file
${task_content:-"No task file found. Run the data audit / design audit / perf audit for your track and fix what you find."}

## Rules
1. Read CLAUDE.md and DESIGN.md first
2. One task at a time — finish completely before starting the next
3. Run \`npx tsc --noEmit\` after every change — zero errors or revert
4. Maximum ${MAX_PER_TRACK} tasks per session
5. When done, write a summary of what you did to: ${LOG_DIR}/${track}_$(date +%Y%m%d).md
6. Never fabricate data. Never break existing functionality.
7. If you conflict with another track, STOP and document it — don't force through

## After each task
Update the swarm state:
python3 -c "
import json
with open('scripts/agent_loops/.swarm_state.json') as f: s = json.load(f)
s['tracks']['${track}'] = {'status': 'done', 'task': 'DESCRIBE_WHAT_YOU_DID', 'files': ['LIST_FILES_CHANGED']}
s['completed'].append({'track': '${track}', 'task': 'DESCRIBE_WHAT_YOU_DID'})
with open('scripts/agent_loops/.swarm_state.json', 'w') as f: json.dump(s, f, indent=2)
"
PROMPT
}

# ── Run a single track ────────────────────────────────────────────────

run_track() {
  local track="$1"
  local log_file="${LOG_DIR}/${track}_$(date +%Y%m%d_%H%M%S).log"

  log "🚀 Starting track: ${track}"
  update_track_state "$track" "running" "starting"

  local prompt
  prompt=$(build_context "$track")

  cd "$PROJECT_DIR"
  claude -p "$prompt" --dangerously-skip-permissions > "$log_file" 2>&1
  local exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    log "✓ Track ${track} completed"
    update_track_state "$track" "done" "completed"
  else
    log "✗ Track ${track} failed (exit $exit_code)"
    update_track_state "$track" "failed" "exit $exit_code"
  fi

  return $exit_code
}

# ── Main ──────────────────────────────────────────────────────────────

log "╔══════════════════════════════════════════════════╗"
log "║              VERITY SWARM                        ║"
log "╚══════════════════════════════════════════════════╝"

# Determine which tracks to run
if [[ -n "$SELECTED_TRACKS" ]]; then
  IFS=',' read -ra TRACKS <<< "$SELECTED_TRACKS"
else
  read -ra TRACKS <<< "$ALL_TRACKS"
fi

log "Tracks: ${TRACKS[*]}"
log "Task file: $TASK_FILE"
log "Max tasks per track: $MAX_PER_TRACK"

if [[ "$PLAN_ONLY" == "true" ]]; then
  log ""
  log "── PLAN (dry run) ──"
  for track in "${TRACKS[@]}"; do
    log "  Track: $track"
    log "    Scope: ${TRACK_SCOPE[$track]:-any}"
    log "    Agent: ${TRACK_AGENT[$track]:-default}"
    log "    Desc:  ${TRACK_DESC[$track]}"
  done
  log ""
  log "Run without --plan to execute."
  exit 0
fi

# Check task file exists
if [[ ! -f "$TASK_FILE" ]]; then
  log "⚠ No task file at $TASK_FILE"
  log "  Create SPRINT.md with tasks, or run with --file <path>"
  log "  Without tasks, agents will run audits for their track."
fi

# Initialize coordination state
init_state

# Launch all tracks in parallel
PIDS=()
TRACK_NAMES=()

for track in "${TRACKS[@]}"; do
  run_track "$track" &
  PIDS+=($!)
  TRACK_NAMES+=("$track")
done

log ""
log "All ${#PIDS[@]} tracks launched. Waiting for completion..."
log ""

# Wait for all tracks and collect results
RESULTS=()
for i in "${!PIDS[@]}"; do
  wait "${PIDS[$i]}" 2>/dev/null
  exit_code=$?
  RESULTS+=($exit_code)
done

# Summary
log "═══════════════════════════════════════════════════"
log "SWARM COMPLETE"
log ""

passed=0
failed=0
for i in "${!TRACK_NAMES[@]}"; do
  if [[ ${RESULTS[$i]} -eq 0 ]]; then
    log "  ✓ ${TRACK_NAMES[$i]}"
    ((passed++))
  else
    log "  ✗ ${TRACK_NAMES[$i]} (exit ${RESULTS[$i]})"
    ((failed++))
  fi
done

log ""
log "Passed: $passed/${#TRACKS[@]}, Failed: $failed/${#TRACKS[@]}"
log "Logs: $LOG_DIR/"
log "State: $STATE_FILE"
log "═══════════════════════════════════════════════════"

# Mac notification
if [[ $failed -eq 0 ]]; then
  osascript -e "display notification \"All ${passed} tracks completed\" with title \"✅ Verity Swarm\"" 2>/dev/null || true
else
  osascript -e "display notification \"${passed} passed, ${failed} failed — check logs\" with title \"⚠️ Verity Swarm\"" 2>/dev/null || true
fi

[[ $failed -eq 0 ]]
