#!/usr/bin/env python3
"""
link_primary_sources.py — Primary source linker for Verity news stories.

Connects extracted entities (from story_entities) to Hansard speeches,
division votes, bills, and donations. Results stored in story_primary_sources.

Run:        python scripts/link_primary_sources.py
Limit:      python scripts/link_primary_sources.py --limit 30
"""
import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent.parent / ".env")
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Stop words (shared with extract_entities.py) ───────────────────────────
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

# Categories that trigger donation linking
DONATION_CATEGORIES = {"economy", "politics", "legislation", "election", "cost_of_living"}


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


def score_keyword_overlap(tokens_a: set[str], tokens_b: set[str]) -> int:
    """Count overlapping keywords between two token sets."""
    return len(tokens_a & tokens_b)


def link_hansard(
    sb: Client,
    story_id: str,
    member_id: str,
    headline_tokens: set[str],
    first_seen: str,
) -> list[dict]:
    """Find Hansard speeches matching this member + story topic."""
    cutoff = (
        datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
        - timedelta(days=14)
    ).date().isoformat()

    result = (
        sb.table("hansard_entries")
        .select("id, debate_topic, excerpt, date, source_url")
        .eq("member_id", member_id)
        .gte("date", cutoff)
        .order("date", desc=True)
        .limit(20)
        .execute()
    )

    scored = []
    for entry in (result.data or []):
        entry_text = f"{entry.get('debate_topic', '')} {entry.get('excerpt', '')}"
        entry_tokens = tokenize_keywords(entry_text)
        overlap = score_keyword_overlap(headline_tokens, entry_tokens)
        if overlap >= 2:
            scored.append((overlap, entry))

    scored.sort(key=lambda x: x[0], reverse=True)
    sources = []
    for _, entry in scored[:3]:
        excerpt = (entry.get("excerpt") or "")[:200]
        sources.append({
            "story_id": story_id,
            "source_type": "hansard",
            "member_id": member_id,
            "source_id": entry["id"],
            "excerpt": excerpt,
            "metadata": {
                "debate_topic": entry.get("debate_topic"),
                "date": entry.get("date"),
                "source_url": entry.get("source_url"),
            },
        })
    return sources


def link_division_votes(
    sb: Client,
    story_id: str,
    member_id: str,
    headline_tokens: set[str],
    first_seen: str,
) -> list[dict]:
    """Find division votes matching this member + story topic."""
    cutoff = (
        datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
        - timedelta(days=30)
    ).date().isoformat()

    # Get division votes for this member
    votes_result = (
        sb.table("division_votes")
        .select("id, division_id, vote")
        .eq("member_id", member_id)
        .limit(50)
        .execute()
    )
    if not votes_result.data:
        return []

    division_ids = list({v["division_id"] for v in votes_result.data})[:30]

    # Fetch division details
    divisions_result = (
        sb.table("divisions")
        .select("id, name, date, aye_votes, no_votes")
        .in_("id", division_ids)
        .gte("date", cutoff)
        .order("date", desc=True)
        .execute()
    )

    # Map division_id → vote cast
    vote_map = {v["division_id"]: v["vote"] for v in votes_result.data}

    scored = []
    for div in (divisions_result.data or []):
        div_tokens = tokenize_keywords(div.get("name", ""))
        overlap = score_keyword_overlap(headline_tokens, div_tokens)
        if overlap >= 2:
            scored.append((overlap, div))

    scored.sort(key=lambda x: x[0], reverse=True)
    sources = []
    for _, div in scored[:2]:
        sources.append({
            "story_id": story_id,
            "source_type": "division_vote",
            "member_id": member_id,
            "source_id": str(div["id"]),
            "metadata": {
                "vote_cast": vote_map.get(div["id"]),
                "division_name": div.get("name"),
                "aye_votes": div.get("aye_votes"),
                "no_votes": div.get("no_votes"),
                "date": div.get("date"),
            },
        })
    return sources


def link_bill(
    sb: Client,
    story_id: str,
    bill_id: str,
) -> list[dict]:
    """Direct bill link from story_entities."""
    result = (
        sb.table("bills")
        .select("id, title, short_title, current_status, date_introduced")
        .eq("id", bill_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return []

    bill = result.data[0]
    return [{
        "story_id": story_id,
        "source_type": "bill",
        "bill_id": bill["id"],
        "source_id": str(bill["id"]),
        "metadata": {
            "current_status": bill.get("current_status"),
            "date_introduced": bill.get("date_introduced"),
            "short_title": bill.get("short_title") or bill.get("title"),
        },
    }]


def link_donations(
    sb: Client,
    story_id: str,
    member_id: str,
) -> list[dict]:
    """Link top donations for this member."""
    result = (
        sb.table("individual_donations")
        .select("id, donor_name, amount, financial_year, donor_type")
        .eq("member_id", member_id)
        .order("amount", desc=True)
        .limit(3)
        .execute()
    )

    sources = []
    for don in (result.data or []):
        sources.append({
            "story_id": story_id,
            "source_type": "donation",
            "member_id": member_id,
            "source_id": str(don["id"]),
            "metadata": {
                "donor_name": don.get("donor_name"),
                "amount": don.get("amount"),
                "financial_year": don.get("financial_year"),
                "donor_type": don.get("donor_type"),
            },
        })
    return sources


def run(*, limit: int = 50) -> dict:
    """Main entry point. Returns metrics dict."""
    sb = get_supabase()

    # Find story_ids that have entities but no primary sources yet
    entities_result = (
        sb.table("story_entities")
        .select("story_id, entity_type, member_id, bill_id")
        .or_("member_id.not.is.null,bill_id.not.is.null")
        .execute()
    )
    all_entities = entities_result.data or []

    # Get already-linked story IDs
    linked_result = (
        sb.table("story_primary_sources")
        .select("story_id")
        .execute()
    )
    linked_ids = {r["story_id"] for r in (linked_result.data or [])}

    # Group entities by story_id, skip already-linked
    stories_map: dict[str, list[dict]] = {}
    for entity in all_entities:
        sid = entity["story_id"]
        if sid in linked_ids:
            continue
        stories_map.setdefault(sid, []).append(entity)

    # Apply limit
    story_ids = list(stories_map.keys())[:limit]
    log.info("Found %d stories to link (of %d eligible)", len(story_ids), len(stories_map))

    # Fetch story metadata (first_seen, category) for all stories at once
    if story_ids:
        stories_result = (
            sb.table("news_stories")
            .select("id, headline, first_seen, category")
            .in_("id", story_ids)
            .execute()
        )
        stories_lookup = {s["id"]: s for s in (stories_result.data or [])}
    else:
        stories_lookup = {}

    total_sources = 0
    stories_linked = 0
    errors = 0

    for sid in story_ids:
        story = stories_lookup.get(sid)
        if not story:
            continue

        headline = story.get("headline", "")
        first_seen = story.get("first_seen", datetime.now(tz=timezone.utc).isoformat())
        category = story.get("category", "")
        headline_tokens = tokenize_keywords(headline)
        entities = stories_map[sid]

        log.info("Linking story: %s", headline[:80])

        sources_to_insert = []

        try:
            # Collect unique member_ids and bill_ids from entities
            member_ids = list({e["member_id"] for e in entities if e.get("member_id")})
            bill_ids = list({e["bill_id"] for e in entities if e.get("bill_id")})

            # Hansard + Division votes for each member
            for mid in member_ids:
                sources_to_insert.extend(
                    link_hansard(sb, sid, mid, headline_tokens, first_seen)
                )
                sources_to_insert.extend(
                    link_division_votes(sb, sid, mid, headline_tokens, first_seen)
                )
                # Donations (only for relevant categories)
                if category in DONATION_CATEGORIES:
                    sources_to_insert.extend(
                        link_donations(sb, sid, mid)
                    )

            # Bill linking
            for bid in bill_ids:
                sources_to_insert.extend(
                    link_bill(sb, sid, bid)
                )

            # Batch insert
            if sources_to_insert:
                sb.table("story_primary_sources").upsert(
                    sources_to_insert,
                    on_conflict="story_id,source_type,source_id",
                ).execute()
                total_sources += len(sources_to_insert)

            stories_linked += 1

        except Exception as e:
            log.error("Error linking story %s: %s", sid, e)
            errors += 1
            continue

    # Update entity_extraction_runs with sources_linked if a recent run exists
    try:
        recent_run = (
            sb.table("entity_extraction_runs")
            .select("id")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        if recent_run.data:
            sb.table("entity_extraction_runs").update({
                "sources_linked": total_sources,
            }).eq("id", recent_run.data[0]["id"]).execute()
    except Exception:
        pass  # Non-critical

    metrics = {
        "stories_linked": stories_linked,
        "sources_inserted": total_sources,
        "errors": errors,
    }
    log.info("Done. %s", json.dumps(metrics))
    # Print JSON metrics on last line for orchestrator
    print(json.dumps(metrics))
    return metrics


def main():
    parser = argparse.ArgumentParser(description="Link Verity news entities to primary sources")
    parser.add_argument("--limit", type=int, default=50, help="Max stories per run (default: 50)")
    args = parser.parse_args()
    run(limit=args.limit)


if __name__ == "__main__":
    main()
