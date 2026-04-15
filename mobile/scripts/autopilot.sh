#!/bin/bash
# Verity Autopilot — runs Claude Code in headless mode on the task queue
# Usage: ./scripts/autopilot.sh [max_tasks]

MAX_TASKS=${1:-3}
LOG_FILE="autopilot_log_$(date +%Y%m%d_%H%M%S).md"
TASK_FILE="AUTOPILOT_TASKS.md"

echo "# Autopilot Session $(date)" > "$LOG_FILE"
echo "Max tasks: $MAX_TASKS" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

for i in $(seq 1 $MAX_TASKS); do
  echo "--- Task $i of $MAX_TASKS ---"

  PROMPT="ultrathink — Read CLAUDE.md and DESIGN.md first.

You are running in autopilot mode. Read AUTOPILOT_TASKS.md and find the first task with Status: TODO.

For that task:
1. Read the Description and Acceptance criteria carefully
2. Implement the change following all rules in the AUTOPILOT_TASKS.md header
3. Use ONLY inline styles for any visual changes
4. Run npx tsc --noEmit — if errors, fix them. If you can't fix in 3 attempts, revert all changes and mark the task SKIPPED
5. Update the task's Status to DONE (or SKIPPED with reason)
6. Add a Log entry with: timestamp, files changed, what you did
7. Do NOT start another task — exit after completing one task

If all tasks are DONE or SKIPPED, say 'ALL TASKS COMPLETE' and exit."

  echo "Running task $i..."
  cd ~/verity/mobile && claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 | tee -a "$LOG_FILE"

  echo "" >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  echo ""

  # Check if all tasks are done
  if grep -q "ALL TASKS COMPLETE" "$LOG_FILE"; then
    echo "All tasks complete!"
    break
  fi

  # Small pause between tasks
  sleep 5
done

echo "Autopilot session complete. Log: $LOG_FILE"
