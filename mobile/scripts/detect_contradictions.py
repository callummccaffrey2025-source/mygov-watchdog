#!/usr/bin/env python3
"""
detect_contradictions.py — Contradiction detection pipeline for Verity.

Finds contradictions between MP statements in news and their parliamentary
record (Hansard speeches + division votes). Results stored in mp_contradictions.

Run:        python scripts/detect_contradictions.py
Backfill:   python scripts/detect_contradictions.py --backfill
Limit:      python scripts/detect_contradictions.py --limit 10
"""
import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent.parent / ".env")
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# Haiku pricing per million tokens
HAIKU_INPUT_COST = 0.25   # $/MTok
HAIKU_OUTPUT_COST = 1.25  # $/MTok

CONTRADICTION_SYSTEM_PROMPT = """You detect contradictions between a politician's recent statement and their parliamentary record. A contradiction is when they stated X and voted/said not-X.

Only return contradictions with confidence >= 0.7.
Do NOT flag changes explained by new information or evolving policy.
Do NOT flag minor wording differences that share the same policy intent.

Return JSON only:
{"contradictions": [{"hansard_id": string, "explanation": string, "confidence": float}]}

Return {"contradictions": []} if no contradictions found."""


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL or SUPABASE_KEY in .env")
        raise SystemExit(1)
    return create_client(url, key)


def fetch_recent_quotes(sb: Client, *, backfill: bool, limit: int) -> list[dict]:
    """Fetch quote entities with member_id from story_entities."""
    query = (
        sb.table("story_entities")
        .select("id, story_id, entity_name, member_id, confidence, metadata, created_at")
        .eq("entity_type", "quote")
        .not_.is_("member_id", "null")
        .order("created_at", desc=True)
        .limit(limit)
    )

    if not backfill:
        yesterday = (datetime.now(tz=timezone.utc) - timedelta(days=1)).isoformat()
        query = query.gte("created_at", yesterday)

    result = query.execute()
    return result.data or []


def fetch_hansard_for_member(sb: Client, member_id: str) -> list[dict]:
    """Fetch recent Hansard entries for a member (past 12 months, limit 20)."""
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=365)).date().isoformat()
    result = (
        sb.table("hansard_entries")
        .select("id, date, debate_topic, excerpt, source_url")
        .eq("member_id", member_id)
        .gte("date", cutoff)
        .order("date", desc=True)
        .limit(20)
        .execute()
    )
    return result.data or []


def fetch_votes_for_member(sb: Client, member_id: str) -> list[dict]:
    """Fetch recent division votes for a member (past 12 months, limit 30)."""
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=365)).date().isoformat()
    result = (
        sb.table("division_votes")
        .select("id, division_id, vote_cast, divisions(name, date, motion)")
        .eq("member_id", member_id)
        .order("id", desc=True)
        .limit(30)
        .execute()
    )
    return result.data or []


def fetch_story_headline(sb: Client, story_id: int) -> str:
    """Get headline for a story."""
    result = (
        sb.table("news_stories")
        .select("headline")
        .eq("id", story_id)
        .maybeSingle()
        .execute()
    )
    return (result.data or {}).get("headline", "")


def fetch_member_info(sb: Client, member_id: str) -> dict | None:
    """Get member name and party for context."""
    result = (
        sb.table("members")
        .select("id, first_name, last_name, party:parties(name, short_name)")
        .eq("id", member_id)
        .maybeSingle()
        .execute()
    )
    return result.data


def check_vote_contradiction(quote_text: str, votes: list[dict]) -> list[dict]:
    """
    Simple heuristic: if a quote mentions supporting/opposing a policy and
    the MP voted the opposite way, return those vote records.
    """
    support_words = {"support", "backing", "favour", "favor", "endorse", "champion", "committed"}
    oppose_words = {"oppose", "against", "reject", "block", "scrap", "abolish", "stop"}

    quote_lower = quote_text.lower()
    quote_supports = any(w in quote_lower for w in support_words)
    quote_opposes = any(w in quote_lower for w in oppose_words)

    if not quote_supports and not quote_opposes:
        return []

    contradicting_votes = []
    for vote in votes:
        division = vote.get("divisions") or {}
        division_name = (division.get("name") or "").lower()
        motion = (division.get("motion") or "").lower()
        vote_cast = vote.get("vote_cast", "")

        # Check if any keywords from the quote appear in the division
        quote_keywords = {w for w in re.findall(r"[a-z]+", quote_lower) if len(w) >= 5}
        division_keywords = {w for w in re.findall(r"[a-z]+", f"{division_name} {motion}") if len(w) >= 5}
        overlap = quote_keywords & division_keywords

        if len(overlap) < 2:
            continue

        # Check for contradiction: supports X but voted no, or opposes X but voted aye
        if (quote_supports and vote_cast == "no") or (quote_opposes and vote_cast == "aye"):
            contradicting_votes.append(vote)

    return contradicting_votes


def detect_for_quote(
    client: anthropic.Anthropic,
    sb: Client,
    quote: dict,
    hansard_entries: list[dict],
    votes: list[dict],
    member_info: dict | None,
    story_headline: str,
) -> tuple[list[dict], dict]:
    """
    Run contradiction detection for a single quote.
    Returns (contradictions_to_insert, usage_dict).
    """
    quote_text = (quote.get("metadata") or {}).get("text", "")
    if not quote_text or len(quote_text) < 20:
        return [], {"input_tokens": 0, "output_tokens": 0}

    member_name = ""
    party_name = ""
    if member_info:
        member_name = f"{member_info.get('first_name', '')} {member_info.get('last_name', '')}"
        party = member_info.get("party") or {}
        party_name = party.get("short_name") or party.get("name") or ""

    # Build Hansard context
    hansard_context = []
    for h in hansard_entries[:15]:
        topic = h.get("debate_topic") or "Unknown topic"
        excerpt = (h.get("excerpt") or "")[:300]
        hansard_context.append(
            f"[{h['id']}] {h.get('date', 'unknown date')} — {topic}\n  \"{excerpt}\""
        )

    # Build votes context
    vote_context = []
    for v in votes[:15]:
        division = v.get("divisions") or {}
        div_name = division.get("name") or "Unknown division"
        vote_context.append(
            f"Vote: {v.get('vote_cast', '?').upper()} on \"{div_name}\" ({division.get('date', '?')})"
        )

    user_text = (
        f"MP: {member_name} ({party_name})\n"
        f"News headline: {story_headline}\n\n"
        f"Recent public statement:\n\"{quote_text}\"\n\n"
        f"Parliamentary record (Hansard speeches, most recent first):\n"
        + ("\n".join(hansard_context) if hansard_context else "No Hansard entries found.")
        + "\n\nVoting record:\n"
        + ("\n".join(vote_context) if vote_context else "No recent votes found.")
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=CONTRADICTION_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_text}],
        )
    except Exception as e:
        log.error("Haiku API error: %s", e)
        return [], {"input_tokens": 0, "output_tokens": 0}

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
    except json.JSONDecodeError:
        log.warning("Failed to parse JSON from Haiku for quote %s", quote["id"])
        return [], usage

    contradictions_out = []
    ai_contradictions = parsed.get("contradictions", [])

    # Also check vote contradictions for confidence boosting
    vote_contradictions = check_vote_contradiction(quote_text, votes)
    vote_hansard_ids = set()  # Track which have vote evidence

    for c in ai_contradictions:
        confidence = c.get("confidence", 0.0)
        hansard_id = c.get("hansard_id")

        if confidence < 0.7:
            continue

        # Find the matching Hansard entry for contra_text
        contra_text = ""
        contra_date = None
        for h in hansard_entries:
            if h["id"] == hansard_id:
                contra_text = (h.get("excerpt") or "")[:500]
                contra_date = h.get("date")
                break

        # Boost confidence if vote evidence also found
        has_vote_evidence = len(vote_contradictions) > 0
        if has_vote_evidence:
            confidence = min(1.0, confidence + 0.15)
            vote_hansard_ids.add(hansard_id)

        # Determine status
        dual_evidence = has_vote_evidence and hansard_id is not None
        status = "confirmed" if confidence >= 0.95 and dual_evidence else "pending"

        contradictions_out.append({
            "member_id": quote["member_id"],
            "story_id": quote["story_id"],
            "entity_id": quote["id"],
            "claim_text": quote_text[:500],
            "claim_source": story_headline[:300],
            "claim_date": quote.get("created_at"),
            "contra_text": contra_text,
            "contra_type": "hansard" if not has_vote_evidence else "hansard+vote",
            "contra_date": contra_date,
            "hansard_id": hansard_id,
            "confidence": round(confidence, 2),
            "ai_explanation": c.get("explanation", "")[:500],
            "status": status,
        })

    return contradictions_out, usage


def run(*, backfill: bool = False, limit: int = 50) -> dict:
    """Main entry point. Returns metrics dict."""
    sb = get_supabase()
    ai = anthropic.Anthropic()

    # Create tracking row
    run_row = sb.table("entity_extraction_runs").insert({
        "started_at": datetime.now(tz=timezone.utc).isoformat(),
        "status": "running",
    }).execute()
    run_id = run_row.data[0]["id"]

    quotes = fetch_recent_quotes(sb, backfill=backfill, limit=limit)
    log.info("Found %d quotes to check for contradictions", len(quotes))

    total_tokens_in = 0
    total_tokens_out = 0
    contradictions_found = 0
    quotes_processed = 0
    errors = 0

    # Cache member data to avoid repeated lookups
    member_cache: dict[str, tuple[list[dict], list[dict], dict | None]] = {}

    for i, quote in enumerate(quotes):
        member_id = quote["member_id"]
        log.info(
            "Checking quote %d/%d: %s — \"%s\"",
            i + 1, len(quotes), quote.get("entity_name", "?"),
            ((quote.get("metadata") or {}).get("text") or "")[:60],
        )

        try:
            # Fetch/cache member data
            if member_id not in member_cache:
                hansard = fetch_hansard_for_member(sb, member_id)
                votes = fetch_votes_for_member(sb, member_id)
                info = fetch_member_info(sb, member_id)
                member_cache[member_id] = (hansard, votes, info)
            else:
                hansard, votes, info = member_cache[member_id]

            headline = fetch_story_headline(sb, quote["story_id"])

            contradictions, usage = detect_for_quote(
                ai, sb, quote, hansard, votes, info, headline,
            )
            total_tokens_in += usage["input_tokens"]
            total_tokens_out += usage["output_tokens"]

            if contradictions:
                for c in contradictions:
                    sb.table("mp_contradictions").insert(c).execute()
                contradictions_found += len(contradictions)
                log.info("  Found %d contradiction(s)", len(contradictions))

            quotes_processed += 1

        except Exception as e:
            log.error("Error processing quote %s: %s", quote["id"], e)
            errors += 1
            continue

    # Calculate cost
    cost_usd = (
        (total_tokens_in / 1_000_000) * HAIKU_INPUT_COST
        + (total_tokens_out / 1_000_000) * HAIKU_OUTPUT_COST
    )

    # Update run record
    sb.table("entity_extraction_runs").update({
        "completed_at": datetime.now(tz=timezone.utc).isoformat(),
        "status": "succeeded" if errors == 0 else "partial",
        "stories_processed": quotes_processed,
        "entities_extracted": contradictions_found,
        "tokens_used": total_tokens_in + total_tokens_out,
        "cost_usd": round(cost_usd, 4),
        "errors": errors,
    }).eq("id", run_id).execute()

    metrics = {
        "quotes_processed": quotes_processed,
        "contradictions_found": contradictions_found,
        "tokens_used": total_tokens_in + total_tokens_out,
        "cost_usd": round(cost_usd, 4),
        "errors": errors,
    }
    log.info("Done. %s", json.dumps(metrics))
    # Print JSON metrics on last line for orchestrator
    print(json.dumps(metrics))
    return metrics


def main():
    parser = argparse.ArgumentParser(description="Detect contradictions between MP statements and parliamentary record")
    parser.add_argument("--backfill", action="store_true", help="Process ALL quotes, not just last 24h")
    parser.add_argument("--limit", type=int, default=50, help="Max quotes per run (default: 50)")
    args = parser.parse_args()
    run(backfill=args.backfill, limit=args.limit)


if __name__ == "__main__":
    main()
