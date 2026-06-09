# Verity Sprint — Active Tasks

Shared task file read by all swarm agents. Each agent picks tasks matching their track.

## How it works
- Agents claim tasks by writing their track name to the Status field
- Only pick tasks matching your track tag
- Mark DONE with a one-line summary when finished
- If blocked, mark BLOCKED with the reason

---

## Track: infra

### S-001 | Fix pipeline_runs check constraint
- Status: TODO
- Description: The `pipeline_runs` table has a check constraint on `status` that rejects "error" and "partial". The data_monitor.py and orchestrate.py write these values. Fix the constraint to allow: success, error, partial, failed, running.
- Files: Supabase migration
- Acceptance: `python3 scripts/data_monitor.py` logs to pipeline_runs without 400 errors

### S-002 | Increase votes ingestion reliability
- Status: TODO
- Description: `ingest_votes.py` times out at 20 min when ingesting all 1,929 divisions. Add a `--recent N` flag that only fetches divisions from the last N days (default 30). The daily pipeline should use `--recent 7`. Full ingestion stays available via `--all`.
- Files: scripts/ingest_votes.py, scripts/orchestrate.py
- Acceptance: `python3 scripts/ingest_votes.py --recent 7` completes in under 5 minutes

---

## Track: ui

### S-003 | Consolidate NewsScreen vs NewsScreenV2
- Status: TODO
- Description: Both exist — NewsScreen is used as a stack screen, NewsScreenV2 as a tab. Confusing. Rename NewsScreenV2 to NewsScreen, update all navigation references in App.tsx.
- Files: screens/NewsScreen*.tsx, App.tsx
- Acceptance: Only one NewsScreen file exists, tsc passes, news tab works

---

## Track: data

### S-004 | Env var naming consistency
- Status: TODO
- Description: `TVFY_API_KEY` vs `THEYVOTEFORYOU_API_KEY` and `SUPABASE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY` used interchangeably across 40+ scripts. Standardize to `THEYVOTEFORYOU_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` everywhere. Keep backward-compatible fallback in .env only.
- Files: scripts/*.py, .env
- Acceptance: All scripts use canonical names, still work with existing .env

---

## Track: perf

### S-005 | Memoize list item components
- Status: TODO
- Description: EnhancedStoryCard, MemberCard, and BillCard are rendered in FlatLists but not wrapped in React.memo. Wrap each in React.memo with appropriate comparison functions.
- Files: components/EnhancedStoryCard.tsx (or wherever they live), components/MemberCard.tsx, components/BillCard.tsx
- Acceptance: Components wrapped in React.memo, tsc passes

### S-006 | Lazy load screens in App.tsx
- Status: TODO
- Description: All 30+ screens are eagerly imported in App.tsx. Use React.lazy or the navigation `lazy` prop to defer loading of non-initial screens.
- Files: App.tsx
- Acceptance: Only HomeScreen, ExploreScreen, and the tab screens load eagerly. Others lazy. tsc passes.

---

## Track: quality

### S-007 | Design system audit
- Status: TODO
- Description: Run the design-enforcer agent prompt against all screens. Report violations of DESIGN.md (wrong colors, spacing, font sizes, non-Ionicon icons). Fix the top 5 violations.
- Files: screens/*.tsx
- Acceptance: Top 5 violations fixed, tsc passes
