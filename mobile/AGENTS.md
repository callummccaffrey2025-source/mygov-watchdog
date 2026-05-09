# Verity Agent Team

Your AI ops team for running Verity. You make decisions, they do the work.

## Quick Commands

```bash
# "Is everything running?"
claude -a ops-status

# "What happened this week?"
claude -a weekly-reporter

# "The pipeline broke, fix it"
claude -a pipeline-operator

# "Check community posts for problems"
claude -a content-moderator

# "Audit the data quality"
claude -a data-auditor

# "Ingest new data from [source]"
claude -a data-ingester
```

## Agent Roster

| Agent | Model | Purpose | Can Write? |
|-------|-------|---------|------------|
| `ops-status` | Haiku | 30-second system health check | No |
| `pipeline-operator` | Sonnet | Diagnose + fix pipeline issues | Yes |
| `weekly-reporter` | Sonnet | Weekly status report | No |
| `content-moderator` | Haiku | Flag community policy violations | No |
| `data-auditor` | Sonnet | Deep data completeness audit | No |
| `data-ingester` | Sonnet | Build/run ingestion scripts | Yes |
| `design-enforcer` | Sonnet | Review UI against DESIGN.md | No |
| `perf-optimizer` | Sonnet | Find and fix performance issues | No |

## Automation (runs without you)

### Cron (laptop)
```
# Full pipeline: 6am AEST daily
0 20 * * * bash ~/verity/mobile/scripts/verity_cron.sh full >> ~/verity/logs/cron.log 2>&1

# News refresh: every 6 hours
0 2,8,14 * * * bash ~/verity/mobile/scripts/verity_cron.sh news >> ~/verity/logs/cron.log 2>&1
```

### GitHub Actions (server)
- `pipeline.yml` — Same schedule as cron, but runs on GitHub's servers (works when laptop is closed)
- `ingest-mp-statements.yml` — Daily MP media releases
- `ingest-federal-funding.yml` — Daily federal funding data

### Supabase pg_cron (database)
- `ingest-news-daily` — 6am AEST news via Edge Function
- `generate-daily-brief-daily` — 7am AEST AI brief via Edge Function
- `daily-mp-notification` — 7am AEST push notifications

## Alert Chain

When something breaks:
1. **macOS notification** — immediate popup on your Mac
2. **Slack** — if `SLACK_WEBHOOK_URL` is set in `.env`
3. **Push notification** — if `ADMIN_PUSH_TOKEN` is set in `.env`

Set up Slack: Create a Slack app → Incoming Webhooks → Add to channel → Copy URL → Add to `.env`:
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx
ADMIN_PUSH_TOKEN=ExponentPushToken[your-token]
```

## Your Daily Routine

**Morning (2 min):**
```bash
claude -a ops-status
```
Green? You're done. Issues? Run `claude -a pipeline-operator` to investigate.

**Weekly (5 min):**
```bash
claude -a weekly-reporter
```
Review the report. Flag anything that needs a decision.

**As needed:**
```bash
claude -a content-moderator    # Review flagged community posts
claude -a data-auditor         # Deep data quality check
```

## Scripts

| Script | Purpose | Schedule |
|--------|---------|----------|
| `scripts/orchestrate.py` | Master pipeline (news→votes→summaries→health) | Daily 6am |
| `scripts/ops_alert.py` | Health check + alert (Slack/push/macOS) | After pipeline |
| `scripts/verity_cron.sh` | Cron entry point (full/news/health/status) | Cron |
| `scripts/data_monitor.py` | 5 health checks, logs to pipeline_runs | Part of pipeline |
| `scripts/ingest_news.py` | Triple-source news ingestion | Every 6h |
| `scripts/ingest_votes.py` | TheyVoteForYou division votes | Daily |
| `scripts/generate_ai_summaries.py` | Claude Haiku summaries for stories | After news |
