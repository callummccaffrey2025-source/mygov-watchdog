# Prompt Registry

**These files are the real source code of Verity's editorial voice.** A one-word
change to the daily brief prompt shifts the tone of how 225 MPs are covered.
Treat every edit here like a schema migration: deliberate, reviewed, diffed.

## Rules
1. Every LLM prompt in the pipeline has a file here. The file is the canonical version.
2. Each file's frontmatter records: model, max_tokens, the code location that uses it, and whether it runs in the daily 5am cycle.
3. **Sync discipline**: prompts marked `sync: mirror` are duplicated in code (Edge Functions bundle their prompts at deploy time). If you edit the prompt here, you MUST update the code and redeploy. If you edit the code, update the mirror. `git diff prompts/` is how a human reviews editorial changes.
4. Changes to `daily-brief.md` are graded by `scripts/grade_brief.py` every morning — a bad prompt edit will trip the gate, not reach users silently.

## Inventory (daily 5am cycle — highest stakes)

| Prompt | Model | Used by | Stakes |
|--------|-------|---------|--------|
| daily-brief.md | haiku-4.5 | supabase/functions/generate-daily-brief/index.ts | HIGHEST — first thing users read |
| news-summary.md | haiku-4.5 | scripts/generate_ai_summaries.py | High — appears on every story card |
| story-summary.md | haiku-4.5 | scripts/ingest_news.py compute_story_metrics() | High — inline story summaries |
| brief-grader.md | sonnet-4.6 + haiku-4.5 | scripts/grade_brief.py | The gate itself |

## On-demand prompts (not yet extracted — lower priority)
- classify_divisions.py / classify-divisions Edge Fn — division → policy issue tags
- summarise_bills.py (SONNET — the only non-Haiku writer) — bill plain-English summaries
- generate_bill_arguments.py — for/against arguments
- explain-bill, generate-bill-summary, ask-verity, verify-claim, generate-daily-poll Edge Fns
- detect_contradictions.py, find_vote_speech_contradictions.py
