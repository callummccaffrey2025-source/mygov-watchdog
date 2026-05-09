# Database Migrations

## Convention

All schema changes to the Supabase database follow this process:

1. **Write the migration** in `scripts/migrations/YYYY-MM-DD_description.sql`
2. **Apply via Supabase MCP** using `apply_migration` or `execute_sql`
3. **Verify** by running `python scripts/verify_schema.py`
4. **Commit** the migration file with a descriptive message

## Directory Structure

```
scripts/
  archive/             ← Old migration files (pre-Prompt 4 baseline)
  migrations/          ← New migrations (post-baseline)
  verify_schema.py     ← Schema verification script
```

## Baseline

The production database state as of 2026-05-05 (Prompt 4) is the baseline. All 30 historical migration files have been archived to `scripts/archive/`. They represent the cumulative state that built the current schema, but should not be re-run.

New migrations go in `scripts/migrations/` and are additive — they describe changes FROM the baseline, not the full schema.

## Archived Schema

Tables moved to `archived` schema (not `public`) for data preservation:
- `archived.politicians` — backup of dropped politicians table
- `archived.donor_influence` — per-politician donor influence scores
- `archived.bill_electorate_sentiment` — electorate-bill sentiment data
- `archived.political_risk` — per-politician risk scores

See `docs/SCHEMA_AUDIT.md` for details on each.

## Verification

Run `python scripts/verify_schema.py` after any migration to confirm the schema matches expectations. The script checks:
- All expected tables exist
- Core tables have expected columns
- RLS is enabled on user-data tables
- Key indexes exist
