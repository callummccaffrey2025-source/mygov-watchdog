#!/usr/bin/env python3
"""
recluster_existing_stories.py — Merge duplicate stories retroactively.

Uses the SAME improved lexical matching as ingest_news.py (topic + politicians +
bigrams + token overlap) to find story pairs that should be merged.

Safety:
- NEVER deletes data outside of merge flow
- Every merge is recorded in stories_merged
- Merges smaller/newer story into larger/older canonical story
- Junction rows (news_story_articles) are reassigned, never dropped

Usage:
  python recluster_existing_stories.py                    # dry run — show what would merge
  python recluster_existing_stories.py --apply            # actually merge
  python recluster_existing_stories.py --days 30          # lookback window
"""

import os
import sys
import logging
import argparse
import re
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client

# Import the shared helpers from ingest_news
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_news import (
    tokenise, extract_cluster_topic, canonical_politicians,
    bigrams, STOP_WORDS,
)

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


def score_pair(a: dict, b: dict) -> int:
    """Compute match score between two existing stories using ingest_news logic."""
    a_hay = (a["headline"] or "").lower()
    b_hay = (b["headline"] or "").lower()

    a_topic = extract_cluster_topic(a_hay)
    b_topic = extract_cluster_topic(b_hay)
    a_pols = canonical_politicians(a_hay)
    b_pols = canonical_politicians(b_hay)
    a_toks = tokenise(a["headline"] or "")
    b_toks = tokenise(b["headline"] or "")
    a_bi = bigrams(a_toks, a["headline"] or "")
    b_bi = bigrams(b_toks, b["headline"] or "")

    token_overlap = len(a_toks & b_toks)
    bigram_overlap = len(a_bi & b_bi)
    pol_overlap = len(a_pols & b_pols)

    score = 0

    # Topic-first
    if a_topic and b_topic and a_topic == b_topic and token_overlap >= 1:
        score = 8

    # Politicians
    if pol_overlap:
        score = max(score, pol_overlap * 5)
        if token_overlap >= 1:
            score = max(score, 8)

    # Bigrams
    if bigram_overlap >= 1:
        score = max(score, 3 + bigram_overlap * 2)

    # Token fallback
    if score == 0 and token_overlap >= 2:
        score = 3

    return score


def merge_story(sb, source_story_id: str, target_story_id: str, score: int) -> bool:
    """Reassign source articles to target, recompute counts, delete source."""
    try:
        sb.table("stories_merged").insert({
            "source_story_id": source_story_id,
            "target_story_id": target_story_id,
            "similarity": float(score),
            "method": "lexical_recluster",
        }).execute()

        src_articles = sb.table("news_story_articles").select("article_id").eq("story_id", source_story_id).execute()
        article_ids = [r["article_id"] for r in (src_articles.data or [])]

        if article_ids:
            existing = sb.table("news_story_articles").select("article_id").eq("story_id", target_story_id).in_("article_id", article_ids).execute()
            existing_ids = {r["article_id"] for r in (existing.data or [])}
            new_ids = [aid for aid in article_ids if aid not in existing_ids]

            for aid in new_ids:
                sb.table("news_story_articles").insert({
                    "story_id": target_story_id,
                    "article_id": aid,
                }).execute()

        sb.table("news_story_articles").delete().eq("story_id", source_story_id).execute()

        # Recompute counts
        all_joined = sb.table("news_story_articles").select("article_id, news_articles(source_id, news_sources(leaning))").eq("story_id", target_story_id).execute()
        left = center = right = 0
        total = 0
        for row in (all_joined.data or []):
            total += 1
            leaning = (((row.get("news_articles") or {}).get("news_sources") or {}).get("leaning") or "center")
            if "left" in leaning:
                left += 1
            elif "right" in leaning:
                right += 1
            else:
                center += 1

        sb.table("news_stories").update({
            "article_count": total,
            "left_count": left,
            "center_count": center,
            "right_count": right,
        }).eq("id", target_story_id).execute()

        sb.table("news_stories").delete().eq("id", source_story_id).execute()
        return True
    except Exception as e:
        log.error("Merge failed: %s", e)
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually perform merges")
    parser.add_argument("--days", type=int, default=30, help="Lookback window")
    parser.add_argument("--min-score", type=int, default=3, help="Min match score to merge")
    args = parser.parse_args()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()

    resp = sb.table("news_stories").select(
        "id, headline, category, first_seen, article_count"
    ).gte("first_seen", cutoff).order("first_seen", desc=True).execute()

    stories = resp.data or []
    log.info("Loaded %d stories from last %d days", len(stories), args.days)

    if len(stories) < 2:
        log.info("Nothing to compare")
        return

    # Build merge map: source → target
    # Process in reverse (newest first) so newer stories merge INTO older canonical ones
    merges: list[tuple[dict, dict, int]] = []  # (source, target, score)
    merged_source_ids: set[str] = set()

    for i, a in enumerate(stories):
        if a["id"] in merged_source_ids:
            continue
        for j, b in enumerate(stories):
            if i == j or b["id"] in merged_source_ids:
                continue
            # Only compare stories within 7 days of each other
            try:
                a_dt = datetime.fromisoformat(a["first_seen"].replace("Z", "+00:00"))
                b_dt = datetime.fromisoformat(b["first_seen"].replace("Z", "+00:00"))
                if abs((a_dt - b_dt).total_seconds()) > 7 * 86400:
                    continue
            except Exception:
                continue

            score = score_pair(a, b)
            if score >= args.min_score:
                # Keep the older story as canonical
                try:
                    a_dt = datetime.fromisoformat(a["first_seen"].replace("Z", "+00:00"))
                    b_dt = datetime.fromisoformat(b["first_seen"].replace("Z", "+00:00"))
                    # If one has significantly more articles, use that as canonical
                    if b["article_count"] > a["article_count"]:
                        src, tgt = a, b
                    elif a["article_count"] > b["article_count"]:
                        src, tgt = b, a
                    elif a_dt < b_dt:
                        src, tgt = b, a  # Keep older
                    else:
                        src, tgt = a, b
                except Exception:
                    src, tgt = a, b

                if src["id"] == a["id"]:
                    merged_source_ids.add(a["id"])
                    merges.append((a, b, score))
                    break
                else:
                    merged_source_ids.add(b["id"])
                    merges.append((b, a, score))

    log.info("Merge candidates: %d", len(merges))
    for src, tgt, score in merges[:25]:
        log.info("  [%d] %s → %s", score, src["headline"][:50], tgt["headline"][:50])

    if not args.apply:
        log.info("\nDry run — pass --apply to perform merges.")
        return

    applied = 0
    for src, tgt, score in merges:
        if merge_story(sb, src["id"], tgt["id"], score):
            applied += 1

    log.info("Applied %d merges out of %d candidates", applied, len(merges))


if __name__ == "__main__":
    main()
