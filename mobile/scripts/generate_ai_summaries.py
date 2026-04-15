#!/usr/bin/env python3
"""
generate_ai_summaries.py — Generate neutral 2-3 sentence AI summaries for
news stories that don't have one yet.

Uses Anthropic Claude Haiku 4.5 against ANTHROPIC_API_KEY from .env.
Targets news_stories with article_count >= 5 and ai_summary IS NULL.

Usage:
    python scripts/generate_ai_summaries.py
"""
import os
import sys
import time
import logging

# Load .env explicitly (avoids find_dotenv frame issue on Python 3.14)
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

import anthropic
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 200
SYSTEM_PROMPT = "You are a neutral wire service editor for an Australian news app."


def build_user_prompt(headline: str, articles: list[dict]) -> str:
    """Build the user prompt from a story headline + its articles."""
    lines: list[str] = []
    for a in articles[:5]:
        title = (a.get("title") or "").strip()
        desc = (a.get("description") or "").strip()
        if not title:
            continue
        if desc:
            # Trim long descriptions
            if len(desc) > 240:
                desc = desc[:240] + "…"
            lines.append(f"- {title} — {desc}")
        else:
            lines.append(f"- {title}")
    headlines_block = "\n".join(lines) if lines else f"- {headline}"
    return (
        "Summarize this news event in 2-3 factual sentences. "
        "No editorial language. Just what happened, who is involved, "
        "and why it matters.\n\n"
        f"Headlines:\n{headlines_block}"
    )


def fetch_story_articles(sb, story_id: int) -> list[dict]:
    """Fetch the top 5 articles for a story."""
    junction = (
        sb.table("news_story_articles")
        .select("article_id")
        .eq("story_id", story_id)
        .limit(5)
        .execute()
    )
    ids = [r["article_id"] for r in (junction.data or [])]
    if not ids:
        return []
    arts = (
        sb.table("news_articles")
        .select("title, description")
        .in_("id", ids)
        .execute()
    )
    return arts.data or []


def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    anth_key = os.environ.get("ANTHROPIC_API_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY in .env")
    if not anth_key:
        raise SystemExit("Missing ANTHROPIC_API_KEY in .env")

    sb = create_client(url, key)
    client = anthropic.Anthropic(api_key=anth_key)

    log.info("Querying stories needing AI summaries…")
    stories = (
        sb.table("news_stories")
        .select("id, headline, article_count")
        .gte("article_count", 3)
        .is_("ai_summary", "null")
        .order("article_count", desc=True)
        .execute()
    ).data or []

    total = len(stories)
    log.info("Found %d stories needing summaries", total)
    if total == 0:
        return

    generated = 0
    failed = 0
    examples: list[tuple[str, str]] = []
    total_input_tokens = 0
    total_output_tokens = 0

    for i, story in enumerate(stories, start=1):
        story_id = story["id"]
        headline = story["headline"]

        articles = fetch_story_articles(sb, story_id)
        if not articles:
            log.warning("Story %d (%s) has no articles, skipping", story_id, headline[:50])
            continue

        prompt = build_user_prompt(headline, articles)

        try:
            msg = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            summary = msg.content[0].text.strip() if msg.content else None
            if not summary:
                failed += 1
                log.warning("Empty response for story %d", story_id)
                continue

            # Track token usage for cost estimate
            try:
                total_input_tokens += msg.usage.input_tokens
                total_output_tokens += msg.usage.output_tokens
            except AttributeError:
                pass

            sb.table("news_stories").update({"ai_summary": summary}).eq("id", story_id).execute()
            generated += 1

            if len(examples) < 3:
                examples.append((headline, summary))

        except Exception as e:
            failed += 1
            log.warning("AI summary failed for story %d: %s", story_id, e)
            continue

        if i % 10 == 0 or i == total:
            log.info("[%d/%d] generated=%d failed=%d", i, total, generated, failed)

        time.sleep(0.5)

    # ── Final report ─────────────────────────────────────────────────────
    # Haiku 4.5 pricing: $1/MTok input, $5/MTok output (approx)
    cost_input = total_input_tokens * 1.0 / 1_000_000
    cost_output = total_output_tokens * 5.0 / 1_000_000
    total_cost = cost_input + cost_output

    print()
    print("═══════════════ SUMMARY ═══════════════")
    print(f"  Stories processed:  {total}")
    print(f"  Summaries generated: {generated}")
    print(f"  Failed:              {failed}")
    print(f"  Input tokens:        {total_input_tokens:,}")
    print(f"  Output tokens:       {total_output_tokens:,}")
    print(f"  Estimated cost:      ${total_cost:.4f}")
    print("════════════════════════════════════════")
    print()
    if examples:
        print("Example summaries:")
        for i, (headline, summary) in enumerate(examples, start=1):
            print(f"\n{i}. {headline[:70]}")
            print(f"   → {summary}")
        print()


if __name__ == "__main__":
    main()
