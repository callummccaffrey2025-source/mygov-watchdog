#!/usr/bin/env python3
"""
find_vote_speech_contradictions.py — Find contradictions between what MPs say
in parliament and how they vote. No AI needed for the first pass.

Strategy:
  1. For each MP with both Hansard entries and division votes in the last 12 months:
  2. For each Hansard speech, extract topic keywords
  3. For each division vote, extract topic keywords
  4. Find cases where an MP spoke supportively about a topic then voted against
     related legislation (or vice versa)
  5. Score by keyword overlap strength and temporal proximity

This is the "said X, voted Y" engine. The viral unit.

Run:
  python scripts/find_vote_speech_contradictions.py              # Find new contradictions
  python scripts/find_vote_speech_contradictions.py --dry-run    # Preview without writing
  python scripts/find_vote_speech_contradictions.py --member-id UUID  # Check one MP
  python scripts/find_vote_speech_contradictions.py --ai-verify  # Use Claude to verify candidates

Output: inserts into mp_contradictions table.
"""

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent.parent / ".env")
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SUPPORT_WORDS = {"support", "backing", "favour", "favor", "endorse", "champion",
                 "committed", "agree", "welcome", "applaud", "pleased", "important",
                 "vital", "necessary", "must", "strengthen", "protect", "invest"}
OPPOSE_WORDS = {"oppose", "against", "reject", "block", "scrap", "abolish", "stop",
                "unacceptable", "inadequate", "dangerous", "reckless", "fail",
                "harmful", "devastating", "wrong", "disgrace", "condemn"}

TOPIC_KEYWORDS = {
    "housing": {"housing", "rental", "rent", "tenant", "landlord", "property", "homelessness", "affordable"},
    "climate": {"climate", "emissions", "carbon", "renewable", "solar", "wind", "fossil", "coal", "gas", "energy"},
    "health": {"health", "hospital", "medicare", "doctor", "nurse", "mental", "ndis", "disability", "aged care"},
    "economy": {"economy", "budget", "tax", "inflation", "wages", "employment", "jobs", "cost of living"},
    "education": {"education", "school", "university", "student", "teacher", "hecs"},
    "defence": {"defence", "defense", "military", "security", "aukus", "veterans"},
    "immigration": {"immigration", "visa", "refugee", "asylum", "migration", "border"},
}


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL or SUPABASE_KEY")
        sys.exit(1)
    return create_client(url, key)


def extract_keywords(text: str) -> set[str]:
    """Extract meaningful keywords from text."""
    return {w.lower() for w in re.findall(r'[a-z]+', text.lower()) if len(w) >= 4}


def detect_stance(text: str) -> str:
    """Detect whether text expresses support or opposition."""
    lower = text.lower()
    support_count = sum(1 for w in SUPPORT_WORDS if w in lower)
    oppose_count = sum(1 for w in OPPOSE_WORDS if w in lower)
    if support_count > oppose_count and support_count >= 2:
        return "support"
    if oppose_count > support_count and oppose_count >= 2:
        return "oppose"
    return "neutral"


def detect_topic(text: str) -> str | None:
    """Detect the primary topic of text."""
    lower = text.lower()
    scores = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = sum(1 for k in keywords if k in lower)
        if score >= 2:
            scores[topic] = score
    if scores:
        return max(scores, key=scores.get)
    return None


def find_contradictions_for_member(
    sb: Client,
    member_id: str,
    member_name: str,
    dry_run: bool,
) -> list[dict]:
    """Find speech-vs-vote contradictions for a single MP."""
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=365)).date().isoformat()

    # Fetch Hansard speeches
    hansard_result = (
        sb.table("hansard_entries")
        .select("id, date, debate_topic, excerpt, source_url")
        .eq("member_id", member_id)
        .gte("date", cutoff)
        .order("date", desc=True)
        .limit(50)
        .execute()
    )
    speeches = hansard_result.data or []

    if not speeches:
        return []

    # Fetch division votes
    votes_result = (
        sb.table("division_votes")
        .select("id, vote_cast, division_id, divisions(name, date)")
        .eq("member_id", member_id)
        .order("id", desc=True)
        .limit(100)
        .execute()
    )
    votes = votes_result.data or []

    if not votes:
        return []

    # Index speeches by topic
    speech_by_topic: dict[str, list[dict]] = defaultdict(list)
    for s in speeches:
        full_text = f"{s.get('debate_topic', '')} {s.get('excerpt', '')}"
        topic = detect_topic(full_text)
        if topic:
            stance = detect_stance(full_text)
            if stance != "neutral":
                speech_by_topic[topic].append({
                    **s,
                    "stance": stance,
                    "topic": topic,
                    "keywords": extract_keywords(full_text),
                })

    # Index votes by topic
    vote_by_topic: dict[str, list[dict]] = defaultdict(list)
    for v in votes:
        division = v.get("divisions") or {}
        div_name = division.get("name") or ""
        topic = detect_topic(div_name)
        if topic:
            vote_by_topic[topic].append({
                **v,
                "topic": topic,
                "div_name": div_name,
                "keywords": extract_keywords(div_name),
            })

    # Find contradictions: spoke supportively about X, voted against X (or vice versa)
    contradictions = []
    seen_pairs = set()

    for topic, topic_speeches in speech_by_topic.items():
        topic_votes = vote_by_topic.get(topic, [])
        for speech in topic_speeches:
            for vote in topic_votes:
                # Check keyword overlap — lower threshold since Hansard excerpts are short
                overlap = speech["keywords"] & vote["keywords"]
                if len(overlap) < 2:
                    continue

                # Check for contradiction
                is_contradiction = (
                    (speech["stance"] == "support" and vote["vote_cast"] == "no") or
                    (speech["stance"] == "oppose" and vote["vote_cast"] == "aye")
                )
                if not is_contradiction:
                    continue

                pair_key = f"{speech['id']}:{vote['id']}"
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                # Score confidence
                confidence = min(0.95, 0.5 + len(overlap) * 0.05)

                # Temporal proximity bonus: closer dates = higher confidence
                try:
                    speech_date = datetime.fromisoformat(speech["date"])
                    vote_date = datetime.fromisoformat((vote.get("divisions") or {}).get("date", speech["date"]))
                    days_apart = abs((speech_date - vote_date).days)
                    if days_apart < 30:
                        confidence = min(0.98, confidence + 0.1)
                    elif days_apart < 90:
                        confidence = min(0.95, confidence + 0.05)
                except (ValueError, TypeError):
                    pass

                vote_cast = vote["vote_cast"]
                div_name_clean = vote["div_name"][:200]
                stance = speech["stance"]

                explanation = (
                    f"{member_name} spoke in {stance} of {topic}-related policy "
                    f"on {speech.get('date', '?')}, then voted "
                    f"{'against' if vote_cast == 'no' else 'for'} "
                    f"\"{div_name_clean}\" on {(vote.get('divisions') or {}).get('date', '?')}."
                )

                contradictions.append({
                    "member_id": member_id,
                    "claim_text": (speech.get("excerpt") or "")[:500],
                    "claim_source": f"Hansard — {speech.get('debate_topic', 'parliament')}"[:300],
                    "claim_date": speech.get("date"),
                    "contra_type": "vote",
                    "contra_source_id": vote.get("division_id"),
                    "contra_text": f"Voted {vote_cast.upper()} on: {div_name_clean}"[:500],
                    "contra_date": (vote.get("divisions") or {}).get("date"),
                    "confidence": round(confidence, 2),
                    "ai_explanation": explanation[:500],
                    "status": "confirmed" if confidence >= 0.85 else "pending",
                    "hansard_id": speech["id"],
                })

    return contradictions


def verify_with_ai(contradictions: list[dict]) -> list[dict]:
    """Use Claude Haiku to verify and filter contradiction candidates."""
    try:
        import anthropic
    except ImportError:
        log.warning("anthropic not installed — skipping AI verification")
        return contradictions

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        log.warning("No ANTHROPIC_API_KEY — skipping AI verification")
        return contradictions

    client = anthropic.Anthropic()
    verified = []

    for c in contradictions:
        prompt = (
            f"Is this a genuine political contradiction?\n\n"
            f"CLAIM: {c['claim_text'][:300]}\n"
            f"ACTION: {c['contra_text']}\n"
            f"EXPLANATION: {c['ai_explanation']}\n\n"
            f"Reply with JSON: {{\"is_contradiction\": true/false, \"confidence\": 0.0-1.0, \"explanation\": \"...\"}}"
        )

        try:
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)
            result = json.loads(text)

            if result.get("is_contradiction"):
                c["confidence"] = round(result.get("confidence", c["confidence"]), 2)
                c["ai_explanation"] = result.get("explanation", c["ai_explanation"])[:500]
                c["status"] = "confirmed" if c["confidence"] >= 0.85 else "pending"
                verified.append(c)
                log.info("  AI confirmed: %.2f — %s", c["confidence"], c["ai_explanation"][:80])
            else:
                log.info("  AI rejected: %s", result.get("explanation", "")[:80])
        except Exception as e:
            log.warning("  AI verify failed: %s — keeping heuristic result", e)
            verified.append(c)

    return verified


def main():
    parser = argparse.ArgumentParser(description="Find MP speech-vs-vote contradictions")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--member-id", help="Check a single MP")
    parser.add_argument("--ai-verify", action="store_true", help="Use Claude to verify candidates")
    parser.add_argument("--limit", type=int, default=225, help="Max members to check")
    args = parser.parse_args()

    sb = get_supabase()

    if args.member_id:
        info = sb.table("members").select("first_name, last_name").eq("id", args.member_id).single().execute()
        name = f"{info.data['first_name']} {info.data['last_name']}"
        members = [{"id": args.member_id, "first_name": info.data["first_name"], "last_name": info.data["last_name"]}]
    else:
        result = sb.table("members").select("id, first_name, last_name").eq("is_active", True).limit(args.limit).execute()
        members = result.data or []

    log.info("Checking %d members for contradictions...", len(members))

    all_contradictions = []
    members_with_contradictions = 0

    for i, member in enumerate(members):
        name = f"{member['first_name']} {member['last_name']}"
        contradictions = find_contradictions_for_member(sb, member["id"], name, args.dry_run)
        if contradictions:
            members_with_contradictions += 1
            all_contradictions.extend(contradictions)
            log.info("[%d/%d] %s: %d contradiction(s)", i + 1, len(members), name, len(contradictions))

    log.info("Found %d contradictions across %d members", len(all_contradictions), members_with_contradictions)

    if args.ai_verify and all_contradictions:
        log.info("Verifying %d candidates with Claude Haiku...", len(all_contradictions))
        all_contradictions = verify_with_ai(all_contradictions)
        log.info("After AI verification: %d confirmed", len(all_contradictions))

    if args.dry_run:
        log.info("DRY RUN — not writing to database")
        for c in all_contradictions[:10]:
            log.info("  [%.2f] %s", c["confidence"], c["ai_explanation"][:100])
        return

    if not all_contradictions:
        log.info("No contradictions found.")
        return

    # Deduplicate against existing
    existing = sb.table("mp_contradictions").select("member_id, claim_date, contra_date").execute()
    existing_keys = {
        f"{r['member_id']}:{r.get('claim_date')}:{r.get('contra_date')}"
        for r in (existing.data or [])
    }

    new = [
        c for c in all_contradictions
        if f"{c['member_id']}:{c.get('claim_date')}:{c.get('contra_date')}" not in existing_keys
    ]

    if not new:
        log.info("All contradictions already in database.")
        return

    # Insert in batches
    BATCH = 50
    total = 0
    for i in range(0, len(new), BATCH):
        batch = new[i:i + BATCH]
        result = sb.table("mp_contradictions").insert(batch).execute()
        total += len(result.data)

    log.info("Inserted %d new contradictions.", total)


if __name__ == "__main__":
    main()
