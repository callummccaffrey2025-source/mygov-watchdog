#!/usr/bin/env python3
"""
extract_entities.py — Entity extraction pipeline for Verity news stories.

Processes news stories and extracts MP names, bill references, and quotes
using Claude Haiku 4.5. Results stored in story_entities table.

Run:        python scripts/extract_entities.py
Backfill:   python scripts/extract_entities.py --backfill
Limit:      python scripts/extract_entities.py --limit 10
"""
import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent.parent / ".env")
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Stop words (superset of ingest_news.py + VerityRealityCheck.tsx) ────────
STOP_WORDS = {
    "the", "a", "an", "in", "to", "for", "on", "and", "of", "is", "at",
    "by", "from", "with", "as", "its", "it", "that", "this", "are", "was",
    "has", "have", "be", "will", "not", "but", "says", "say", "after",
    "over", "into", "about", "up", "out", "new", "more", "than", "amid",
    "before", "during", "while", "what", "how", "why", "who", "call",
    "he", "she", "they", "his", "her", "their", "our", "we", "you",
    "just", "also", "said", "would", "could", "should", "may",
    "bill", "bills", "act", "acts", "amendment", "amendments",
    "been", "these", "those", "when", "where", "which",
}

# ── Politician aliases — last-name → full-name disambiguation ──────────────
POLITICIAN_ALIASES: dict[str, list[str]] = {
    "albanese": ["anthony albanese", "prime minister albanese", "pm albanese"],
    "dutton": ["peter dutton", "opposition leader dutton"],
    "chalmers": ["jim chalmers", "treasurer chalmers"],
    "wong": ["penny wong", "foreign minister wong"],
    "marles": ["richard marles", "deputy prime minister marles"],
    "bandt": ["adam bandt", "greens leader bandt"],
    "lambie": ["jacqui lambie"],
    "pocock": ["david pocock"],
    "plibersek": ["tanya plibersek"],
    "taylor": ["angus taylor"],
    "joyce": ["barnaby joyce"],
    "littleproud": ["david littleproud"],
    "ley": ["sussan ley"],
    "bowen": ["chris bowen"],
    "waters": ["larissa waters"],
    "thorpe": ["lidia thorpe"],
}

# Haiku pricing per million tokens
HAIKU_INPUT_COST = 0.25   # $/MTok
HAIKU_OUTPUT_COST = 1.25  # $/MTok

EXTRACTION_SYSTEM_PROMPT = """You extract political entities from Australian news summaries. Return JSON only.
Extract:
- members: [{name, role_mentioned, confidence}]
- bills: [{title_fragment, confidence}]
- quotes: [{speaker, text, confidence}]
Only extract entities explicitly mentioned. confidence 0.0-1.0.
For quotes, only include text inside quotation marks in the source."""


def tokenize_keywords(text: str) -> set[str]:
    """Lowercase, extract words >= 4 chars, filter stop words."""
    words = re.findall(r"[a-z]+", text.lower())
    return {w for w in words if w not in STOP_WORDS and len(w) >= 4}


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL or SUPABASE_KEY in .env")
        raise SystemExit(1)
    return create_client(url, key)


def load_members(sb: Client) -> list[dict]:
    """Load all active members for name matching."""
    result = sb.table("members").select("id, first_name, last_name").execute()
    return result.data or []


def match_member_exact(name: str, members: list[dict]) -> dict | None:
    """Pass 1: exact full-name match (case-insensitive)."""
    name_lower = name.lower().strip()
    for m in members:
        full = f"{m['first_name']} {m['last_name']}".lower()
        if full == name_lower:
            return m
    return None


def match_member_lastname(name: str, members: list[dict]) -> dict | None:
    """Pass 2: last-name match with alias disambiguation."""
    name_lower = name.lower().strip()
    # Check aliases first
    for alias_key, full_names in POLITICIAN_ALIASES.items():
        if alias_key == name_lower or name_lower in [n.lower() for n in full_names]:
            # Find member with this last name
            candidates = [m for m in members if m["last_name"].lower() == alias_key]
            if len(candidates) == 1:
                return candidates[0]
    # Direct last-name match (only if unambiguous)
    name_parts = name_lower.split()
    last_name = name_parts[-1] if name_parts else name_lower
    candidates = [m for m in members if m["last_name"].lower() == last_name]
    if len(candidates) == 1:
        return candidates[0]
    return None


def extract_entities_for_story(
    client: anthropic.Anthropic,
    story: dict,
    articles: list[dict],
) -> dict:
    """Call Haiku to extract entities from story articles. Returns parsed JSON."""
    # Concatenate titles + descriptions (~300 tokens)
    parts = []
    for art in articles[:3]:
        title = art.get("title") or ""
        desc = art.get("description") or ""
        parts.append(f"Title: {title}\nDescription: {desc}")

    user_text = (
        f"Story headline: {story.get('headline', '')}\n"
        f"Category: {story.get('category', 'politics')}\n\n"
        f"Articles:\n" + "\n---\n".join(parts)
    )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=EXTRACTION_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_text}],
    )

    # Parse response
    text = response.content[0].text.strip()

    usage = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
    }

    # Extract JSON from response — Haiku often wraps in code fences or adds trailing notes
    parsed = {"members": [], "bills": [], "quotes": []}
    # Try to find JSON object in the response
    json_start = text.find("{")
    json_end = text.rfind("}")
    if json_start >= 0 and json_end > json_start:
        try:
            parsed = json.loads(text[json_start:json_end + 1])
        except json.JSONDecodeError:
            log.warning("Failed to parse JSON from Haiku response for story %s: %s",
                        story["id"], text[json_start:json_start + 200])

    return {**parsed, "_usage": usage}


def match_bill_keyword(sb: Client, title_fragment: str) -> dict | None:
    """Tier 1: keyword match on bills.title/short_title with token overlap."""
    fragment_tokens = tokenize_keywords(title_fragment)
    if len(fragment_tokens) < 2:
        return None

    # Search using the longest token for ilike
    search_term = max(fragment_tokens, key=len)
    results = (
        sb.table("bills")
        .select("id, title, short_title, current_status, date_introduced")
        .or_(f"title.ilike.%{search_term}%,short_title.ilike.%{search_term}%")
        .limit(20)
        .execute()
    )

    best_match = None
    best_overlap = 0
    for bill in (results.data or []):
        bill_tokens = tokenize_keywords(
            f"{bill.get('title', '')} {bill.get('short_title', '')}"
        )
        overlap = len(fragment_tokens & bill_tokens)
        if overlap >= 3 and overlap > best_overlap:
            best_overlap = overlap
            best_match = bill

    return best_match


def match_bill_haiku(
    client: anthropic.Anthropic,
    headline: str,
    category: str,
    sb: Client,
) -> tuple[dict | None, dict]:
    """Tier 2: Haiku fallback — fetch recent bills in category, ask which matches."""
    usage = {"input_tokens": 0, "output_tokens": 0}
    if not category:
        return None, usage

    results = (
        sb.table("bills")
        .select("id, title, short_title, current_status, date_introduced")
        .order("date_introduced", desc=True)
        .limit(5)
        .execute()
    )
    if not results.data:
        return None, usage

    bill_list = "\n".join(
        f"{i+1}. {b.get('short_title') or b.get('title', 'Unknown')}"
        for i, b in enumerate(results.data)
    )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system="You match news headlines to Australian parliamentary bills. Return JSON only: {match_index: number|null, confidence: number}. match_index is 1-based. null if no match.",
        messages=[{"role": "user", "content": f"Headline: {headline}\n\nBills:\n{bill_list}"}],
    )

    usage = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
    }

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        parsed = json.loads(text)
        idx = parsed.get("match_index")
        conf = parsed.get("confidence", 0)
        if idx and conf >= 0.7 and 1 <= idx <= len(results.data):
            return results.data[idx - 1], usage
    except (json.JSONDecodeError, TypeError):
        pass

    return None, usage


def run(*, backfill: bool = False, limit: int = 50) -> dict:
    """Main entry point. Returns metrics dict."""
    sb = get_supabase()
    ai = anthropic.Anthropic()
    members = load_members(sb)

    # Create tracking row
    run_row = sb.table("entity_extraction_runs").insert({
        "started_at": datetime.now(tz=timezone.utc).isoformat(),
    }).execute()
    run_id = run_row.data[0]["id"]

    # Query unprocessed stories
    query = sb.table("v_civic_news_stories").select("id, headline, category, first_seen")
    if not backfill:
        # Get already-processed story IDs
        processed = sb.table("story_entities").select("story_id").execute()
        processed_ids = list({r["story_id"] for r in (processed.data or [])})
        if processed_ids:
            # Use not_.in_ filter
            query = query.not_.in_("id", processed_ids)

    query = query.gte("article_count", 3).limit(limit)
    stories_result = query.execute()
    stories = stories_result.data or []

    log.info("Found %d stories to process", len(stories))

    total_tokens_in = 0
    total_tokens_out = 0
    entities_inserted = 0
    stories_processed = 0
    errors = 0

    for i, story in enumerate(stories):
        log.info("Processing story %d/%d: %s", i + 1, len(stories), story.get("headline", "")[:80])

        try:
            # Fetch top 3 articles for this story
            articles_result = (
                sb.table("news_story_articles")
                .select("article_id")
                .eq("story_id", story["id"])
                .limit(3)
                .execute()
            )
            article_ids = [r["article_id"] for r in (articles_result.data or [])]
            if not article_ids:
                log.warning("No articles found for story %s, skipping", story["id"])
                continue

            articles = (
                sb.table("news_articles")
                .select("title, description, published_at")
                .in_("id", article_ids)
                .order("published_at", desc=True)
                .execute()
            ).data or []

            # Extract entities via Haiku
            extraction = extract_entities_for_story(ai, story, articles)
            total_tokens_in += extraction["_usage"]["input_tokens"]
            total_tokens_out += extraction["_usage"]["output_tokens"]

            entities_to_insert = []

            # Process member entities
            for member_info in extraction.get("members", []):
                if member_info.get("confidence", 0) < 0.7:
                    continue
                name = member_info.get("name", "")
                matched = match_member_exact(name, members) or match_member_lastname(name, members)
                if not matched:
                    continue
                entities_to_insert.append({
                    "story_id": story["id"],
                    "entity_type": "member",
                    "entity_value": name,
                    "member_id": matched["id"],
                    "confidence": member_info.get("confidence", 0.7),
                    "raw_mention": member_info.get("role_mentioned") or name,
                })

            # Process bill entities
            for bill_info in extraction.get("bills", []):
                if bill_info.get("confidence", 0) < 0.7:
                    continue
                fragment = bill_info.get("title_fragment", "")
                matched_bill = match_bill_keyword(sb, fragment)
                if not matched_bill:
                    # Tier 2: Haiku fallback
                    matched_bill, bill_usage = match_bill_haiku(
                        ai, story.get("headline", ""), story.get("category", ""), sb
                    )
                    total_tokens_in += bill_usage["input_tokens"]
                    total_tokens_out += bill_usage["output_tokens"]
                if matched_bill:
                    entities_to_insert.append({
                        "story_id": story["id"],
                        "entity_type": "bill",
                        "entity_value": fragment,
                        "bill_id": matched_bill["id"],
                        "confidence": bill_info.get("confidence", 0.7),
                        "raw_mention": matched_bill.get("short_title") or matched_bill.get("title") or fragment,
                    })

            # Process quotes
            for quote_info in extraction.get("quotes", []):
                if quote_info.get("confidence", 0) < 0.7:
                    continue
                speaker = quote_info.get("speaker", "")
                speaker_member = match_member_exact(speaker, members) or match_member_lastname(speaker, members)
                entity = {
                    "story_id": story["id"],
                    "entity_type": "quote",
                    "entity_value": speaker,
                    "confidence": quote_info.get("confidence", 0.7),
                    "raw_mention": (quote_info.get("text") or "")[:500],
                }
                if speaker_member:
                    entity["member_id"] = speaker_member["id"]
                entities_to_insert.append(entity)

            # Batch insert
            if entities_to_insert:
                sb.table("story_entities").upsert(
                    entities_to_insert,
                    on_conflict="story_id,entity_type,entity_value",
                ).execute()
                entities_inserted += len(entities_to_insert)

            stories_processed += 1

        except Exception as e:
            log.error("Error processing story %s: %s", story["id"], e)
            errors += 1
            continue

    # Calculate cost
    cost_usd = (
        (total_tokens_in / 1_000_000) * HAIKU_INPUT_COST
        + (total_tokens_out / 1_000_000) * HAIKU_OUTPUT_COST
    )

    # Update run record
    sb.table("entity_extraction_runs").update({
        "finished_at": datetime.now(tz=timezone.utc).isoformat(),
        "stories_processed": stories_processed,
        "entities_found": entities_inserted,
        "tokens_used": total_tokens_in + total_tokens_out,
        "cost_usd": round(cost_usd, 4),
        "error": None if errors == 0 else f"{errors} stories failed",
    }).eq("id", run_id).execute()

    metrics = {
        "stories_processed": stories_processed,
        "entities_extracted": entities_inserted,
        "tokens_used": total_tokens_in + total_tokens_out,
        "cost_usd": round(cost_usd, 4),
        "errors": errors,
    }
    log.info("Done. %s", json.dumps(metrics))
    # Print JSON metrics on last line for orchestrator
    print(json.dumps(metrics))
    return metrics


def main():
    parser = argparse.ArgumentParser(description="Extract entities from Verity news stories")
    parser.add_argument("--backfill", action="store_true", help="Process ALL stories, not just unprocessed")
    parser.add_argument("--limit", type=int, default=50, help="Max stories per run (default: 50)")
    args = parser.parse_args()
    run(backfill=args.backfill, limit=args.limit)


if __name__ == "__main__":
    main()
