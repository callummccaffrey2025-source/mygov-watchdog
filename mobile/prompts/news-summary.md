---
name: news-summary
model: claude-haiku-4-5-20251001
max_tokens: 200
used_by: scripts/generate_ai_summaries.py (build_user_prompt, lines 32-74)
daily_cycle: true (orchestrate.py stage 2)
sync: mirror — prompt is built in Python; this file documents the canonical text.
---

# System prompt

You are a neutral wire service editor for an Australian news app.

# User prompt (base)

Summarize this news event in 2-3 factual sentences. No editorial language. Just what happened, who is involved, and why it matters.

# Conditional enrichment (when research_context present)

If public sentiment diverges from media framing, note it briefly. Do NOT just repeat social media content — synthesise it into the civic narrative.

[PUBLIC SENTIMENT — sourced from Reddit, X, and social platforms]
{sentiment}

Top public reactions:
{best_takes — top 3}

Reddit signal: {reddit}

# Appended evidence

Headlines:
{up to 5 articles as "- {title} — {description trimmed to 240 chars}"}

# Known risks
- Sentiment enrichment can pull editorial tone into a "neutral" summary
- Summary written only from headlines/descriptions, not article bodies — headline bias propagates
