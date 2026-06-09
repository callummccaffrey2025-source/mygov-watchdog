---
name: story-summary
model: claude-haiku-4-5-20251001
max_tokens: 120
used_by: scripts/ingest_news.py (compute_story_metrics, ~line 1089)
daily_cycle: true (orchestrate.py stage 1)
condition: only when article_count >= 5 and ANTHROPIC_API_KEY set
sync: mirror — prompt is inline in Python; this file documents the canonical text.
---

# User prompt (no system prompt)

Summarise this news story in exactly 2 sentences, neutral tone, no editorialising. Story: {headline}

Coverage headlines:
{up to 10 article titles as "- {title}"}

# Known risks
- No system prompt — relies entirely on the user instruction for neutrality
- Overlaps in purpose with news-summary.md (generate_ai_summaries.py) — two different
  summary prompts produce inconsistent voice for the same surface. Candidate for unification.
