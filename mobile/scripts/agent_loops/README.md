# Agent Loops

Autonomous loops that prompt agents instead of you.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  daily_cycle.sh                      │
│              (one cron, runs at 5am AEST)            │
│                                                      │
│  Phase 1: orchestrate.py    → ingest news + votes    │
│  Phase 2: generate-daily-brief Edge Function         │
│  Phase 3: watchdog.sh       → detect + fix failures  │
│  Phase 4: quality_gate.sh   → moderate + audit       │
│  Phase 5: report            → log + alert if needed  │
└─────────────────────────────────────────────────────┘
```

## Scripts

### `daily_cycle.sh` — Master orchestrator
One cron entry runs the entire daily cycle. Replaces all manual prompting.

```bash
# Install (replaces your existing cron jobs):
crontab -e
0 19 * * * /bin/bash ~/verity/mobile/scripts/agent_loops/daily_cycle.sh >> ~/verity/logs/daily_cycle.log 2>&1
```

### `watchdog.sh` — Self-healing monitor
Detects pipeline failures and auto-fixes them. Circuit breaker prevents infinite retry loops.

```bash
# One-shot (after pipeline):
./scripts/agent_loops/watchdog.sh

# Dry run (check only):
./scripts/agent_loops/watchdog.sh --dry-run

# Continuous (every 4 hours):
./scripts/agent_loops/watchdog.sh --loop 4h

# Standalone cron (if not using daily_cycle.sh):
0 1,5,9,13,17,21 * * * /bin/bash ~/verity/mobile/scripts/agent_loops/watchdog.sh
```

Fix routing:
| Health check failed | Auto-fix action |
|---|---|
| `articles_fresh` | Re-run `ingest_news.py --fresh` |
| `stories_active` | Re-run `ingest_news.py --fresh` |
| `brief_present` | Trigger `generate-daily-brief` Edge Function |
| `bias_coverage` | Run `scrape_mbfc_bulk.py` |
| `members_active` | **Escalate** — not safe to auto-fix |

### `quality_gate.sh` — Post-pipeline quality sweep
Runs Claude agents for content moderation and data auditing.

```bash
# Full sweep:
./scripts/agent_loops/quality_gate.sh

# Individual stages:
./scripts/agent_loops/quality_gate.sh --stage mod    # content moderation
./scripts/agent_loops/quality_gate.sh --stage audit  # data audit
./scripts/agent_loops/quality_gate.sh --stage summ   # AI summary backfill
```

## Logs

| File | Purpose |
|---|---|
| `~/verity/logs/daily_cycle.log` | Master cycle log |
| `~/verity/logs/watchdog.log` | Watchdog decisions |
| `~/verity/logs/quality_gate.log` | Quality gate output |
| `~/verity/logs/quality_reports/YYYY-MM-DD.md` | Daily quality reports |

## Circuit Breaker

The watchdog tracks fix attempts in `.watchdog_state.json`. After 2 failed fix attempts for the same issue, it stops trying and escalates via `ops_alert.py` (macOS notification + Slack + push).

Reset manually: `echo '{}' > scripts/agent_loops/.watchdog_state.json`

## What this replaces

Before: you wake up, check if the pipeline ran, manually re-run broken stages, prompt agents to audit data.

After: one cron job at 5am handles everything. You get a macOS notification:
- "All passed" — go back to sleep
- "Auto-fixed" — watchdog handled it
- "Needs attention" — something the system couldn't fix (member count drop, API key expired)
