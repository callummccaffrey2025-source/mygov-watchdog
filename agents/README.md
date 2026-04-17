# Verity Managed Agents

This directory contains YAML configurations for the three scheduled background
jobs that keep the Verity app fresh.

## Agents

| Agent | Schedule (AEST) | Purpose |
|---|---|---|
| `news-pipeline` | 6:00am | Ingest news → cluster stories → compute bias → backfill images → AI summaries |
| `daily-brief` | 7:00am | Generate AI-powered daily brief + push notifications |
| `data-monitor` | 8:00am | Health check on data freshness; alert on failure |

The order matters: news must be fresh before the brief generates, and both
must complete before the monitor runs.

---

## Required environment variables / secrets

Set these in your scheduler's secret store (or in a local `.env` for testing):

```
SUPABASE_URL=https://zmmglikiryuftqmoprqm.supabase.co
SUPABASE_KEY=eyJhbGc...                # service-role key for write access
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   # same key, used by daily-brief auth header
NEWSAPI_KEY=...                        # https://newsapi.org/account
ANTHROPIC_API_KEY=sk-ant-...           # https://console.anthropic.com
```

Plus, the `daily-brief` Edge Function on Supabase needs its own
`ANTHROPIC_API_KEY` secret (it can't read the local `.env`):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... \
  --project-ref zmmglikiryuftqmoprqm
```

---

## Deployment options

These YAML files describe what each agent should do but are scheduler-agnostic.
Pick one of:

### Option 1 — Local cron (simplest)

```cron
# m h dom mon dow command
0 6  * * * cd /Users/callummccaffrey/verity/mobile && python scripts/pipeline.py >> ~/verity-logs/news-pipeline.log 2>&1
0 7  * * * curl -X POST https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/generate-daily-brief -H "Authorization: Bearer $SUPABASE_KEY" -H "Content-Type: application/json" -d '{}' >> ~/verity-logs/daily-brief.log 2>&1
0 8  * * * cd /Users/callummccaffrey/verity/mobile && python scripts/data_monitor.py >> ~/verity-logs/data-monitor.log 2>&1
```

### Option 2 — Supabase pg_cron (production, currently in use)

```sql
SELECT cron.schedule(
  'ingest-news-daily', '0 20 * * *',
  $$ SELECT net.http_post(
    url := 'https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/ingest-news',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb
  ) $$
);
```

This is the live setup. Two cron jobs already exist:
- jobid 2: `ingest-news-daily` at `0 20 * * *`
- jobid 3: `generate-daily-brief-daily` at `0 21 * * *`

### Option 3 — GitHub Actions

Translate each YAML into a `.github/workflows/<name>.yml` with `schedule: cron:` and a `python` step that runs the entrypoint.

### Option 4 — Anthropic Agent Skills / Claude Code scheduler

If using a managed agent runner that consumes this YAML format directly,
deploy with whatever CLI ships with that runner. The schema here is
designed to be portable.

---

## Viewing logs

All agents log their runs to Supabase tables:
- `pipeline_runs` — news-pipeline status + details
- `daily_brief_runs` — daily-brief outcomes (Edge Function logs in Supabase Dashboard → Functions → generate-daily-brief)
- `health_check_runs` — data-monitor results

Query the latest run of each:

```sql
SELECT pipeline, status, finished_at, error
FROM pipeline_runs
ORDER BY finished_at DESC
LIMIT 5;
```

---

## Manual triggers

Run any agent on demand:

```bash
# News pipeline
cd ~/verity/mobile && python scripts/pipeline.py

# Daily brief
curl -X POST https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/generate-daily-brief \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" -d '{}'

# Data monitor
cd ~/verity/mobile && python scripts/data_monitor.py

# AI summaries (run after pipeline if any new stories cleared the threshold)
cd ~/verity/mobile && python scripts/generate_ai_summaries.py
```
