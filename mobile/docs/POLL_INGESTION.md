# Poll Ingestion

## How to Run

```bash
# Dry run — prints parsed polls without writing to Supabase
python scripts/ingest_published_polls.py

# Write to Supabase
python scripts/ingest_published_polls.py --write

# Write + recompute aggregates
python scripts/ingest_published_polls.py --write --aggregate

# Limit to first N polls (for testing)
python scripts/ingest_published_polls.py --limit 5
```

## Requirements

- Python 3.10+
- `requests`, `supabase`, `python-dotenv` (pip install)
- `.env` file with `SUPABASE_URL` and `SUPABASE_KEY`

## Data Source

Wikipedia: "Opinion polling for the next Australian federal election"
- URL: https://en.wikipedia.org/wiki/Opinion_polling_for_the_next_Australian_federal_election
- License: CC-BY-SA 3.0
- API: MediaWiki API (`action=parse`, `prop=wikitext`)
- The script parses the first wikitable (main federal voting intention table)

## What Gets Parsed

For each poll row:
- Pollster name
- Field dates (start and end)
- Sample size
- Methodology (online panel, phone, mixed)
- Primary votes: ALP, L/NP, Greens, One Nation
- Two-party preferred: ALP, L/NP
- Source URL (extracted from `<ref>` citations)
- Wikipedia revision URL (for provenance)

## Upsert Behavior

Polls are upserted on the unique constraint `(pollster, field_end_date, poll_type, scope)`. Running the script multiple times is safe — it updates existing rows rather than creating duplicates.

## Aggregation

The `calculate_poll_aggregate` Postgres function computes simple averages over 30/60/90 day windows. It runs nightly via pg_cron (jobid 12, 3am AEST). Can also be triggered manually via `--aggregate` flag.

## Schedule

Currently run manually. To automate, add to the local crontab:
```
0 8 * * * cd ~/verity/mobile && python3 scripts/ingest_published_polls.py --write --aggregate >> ~/verity/logs/polls.log 2>&1
```
