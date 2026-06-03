# Verity Operations Runbook

## Daily Automated Pipeline (runs without human intervention)

All times AEST. Powered by Supabase pg_cron.

| Time | Job | What it does |
|------|-----|-------------|
| Every hour :17 | bill-change-notify | Checks for bill status changes, sends push notifications |
| 03:00 | close-expired-polls | Closes polls past their deadline |
| 04:30 | compute-stats | Calculates aggregate statistics |
| 05:00 | ingest-bills | Scrapes APH for new/updated bills |
| 05:00 | compute-mp-disconnect | Recalculates consistency scores |
| 05:00 | calculate-poll-aggregate | Refreshes 30/60/90-day poll averages |
| 06:00 | ingest-news | Ingests news from NewsAPI + Google RSS |
| 07:00 | generate-daily-brief | AI-generates the daily brief |
| 07:00 | daily-mp-notification | Sends "your MP voted" push notifications |
| 08:30 | generate-bill-summary | AI-summarizes bills without summaries |
| 08:45 | data-quality-check | Runs quality checks, logs issues |

## When You Open a Claude Code Session

Paste this single prompt to get a full status report and auto-fix:

```
Run the Verity daily standup: check pipeline health, fix any TypeScript errors,
run the bill ingestion if stale, and tell me what needs my attention.
```

## What Needs Human Attention

- **App Store submission** — needs Pty Ltd + D-U-N-S
- **Legal review** — defamation lawyer before public launch
- **Anthropic API credits** — top up when low
- **New feature decisions** — product direction
- **PR/media outreach** — launch story

## What Does NOT Need Human Attention

- Bill/news/brief data freshness (pg_cron handles it)
- Push notifications (Edge Functions handle it)
- Data quality monitoring (automated checks)
- TypeScript/build errors (Claude Code fixes on request)

## Pipeline Health Check (run in Claude Code)

```sql
SELECT pipeline_name, last_success_at, is_stale, error_count
FROM pipeline_health_status;
```

## Self-Improvement

Claude Code learnings are stored in `~/.gstack/projects/*/learnings.jsonl`.
Each session builds on prior context via `/context-save` and `/context-restore`.
The CLAUDE.md file is the persistent brain — always up to date.
