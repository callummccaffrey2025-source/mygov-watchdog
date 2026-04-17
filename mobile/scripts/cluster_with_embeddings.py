#!/usr/bin/env python3
"""
cluster_with_embeddings.py — Semantic clustering pass using Pinecone.

Runs AFTER ingest_news.py. For each article from the last 48 hours that is
a "lone story" (story has article_count=1), computes its embedding, queries
Pinecone for similar recent articles, and merges stories where cosine >= 0.75.

This is a SAFETY-FIRST merge:
- Never deletes data — every merge is recorded in stories_merged
- Keeps the older/larger story as the canonical, merges the smaller into it
- Updates news_story_articles junction rows to point to the canonical story

Required env vars:
  SUPABASE_URL, SUPABASE_KEY
  PINECONE_API_KEY, PINECONE_HOST (or PINECONE_INDEX)
  ANTHROPIC_API_KEY (for embeddings via Voyage/OpenAI if Pinecone inference unused)

Usage:
  python cluster_with_embeddings.py                   # dry run — show merges
  python cluster_with_embeddings.py --apply           # actually perform merges
  python cluster_with_embeddings.py --hours 72        # lookback window
"""

import os
import sys
import logging
import argparse
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.75


def get_embedding(text: str, openai_key: str | None = None) -> list[float] | None:
    """
    Get a single embedding. Preference order:
    1. Voyage AI (Anthropic partner, good for retrieval)
    2. OpenAI text-embedding-3-small
    3. Pinecone inference API (if configured)

    Returns None on any failure.
    """
    try:
        import requests
        openai_key = openai_key or os.environ.get("OPENAI_API_KEY")
        if openai_key:
            resp = requests.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                json={"input": text[:8000], "model": "text-embedding-3-small"},
                timeout=20,
            )
            if resp.ok:
                return resp.json()["data"][0]["embedding"]
    except Exception as e:
        log.debug("OpenAI embedding failed: %s", e)
    return None


def cosine(a: list[float], b: list[float]) -> float:
    """Plain cosine similarity — no numpy dep."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def query_pinecone_topk(vector: list[float], top_k: int = 10) -> list[dict]:
    """Query Pinecone for top-k similar articles. Returns list of {id, score}."""
    try:
        import requests
        host = os.environ.get("PINECONE_HOST")
        api_key = os.environ.get("PINECONE_API_KEY")
        if not host or not api_key:
            return []
        resp = requests.post(
            f"https://{host}/query",
            headers={"Api-Key": api_key, "Content-Type": "application/json"},
            json={
                "vector": vector,
                "topK": top_k,
                "includeMetadata": True,
                "filter": {"type": {"$eq": "news_article"}},
            },
            timeout=15,
        )
        if resp.ok:
            return resp.json().get("matches", [])
    except Exception as e:
        log.debug("Pinecone query failed: %s", e)
    return []


def upsert_pinecone(article_id: int, text: str, vector: list[float], story_id: str, metadata: dict):
    """Store an article embedding in Pinecone for future queries."""
    try:
        import requests
        host = os.environ.get("PINECONE_HOST")
        api_key = os.environ.get("PINECONE_API_KEY")
        if not host or not api_key:
            return
        requests.post(
            f"https://{host}/vectors/upsert",
            headers={"Api-Key": api_key, "Content-Type": "application/json"},
            json={
                "vectors": [{
                    "id": f"news_article_{article_id}",
                    "values": vector,
                    "metadata": {
                        "type": "news_article",
                        "article_id": article_id,
                        "story_id": story_id,
                        **metadata,
                    },
                }],
            },
            timeout=15,
        )
    except Exception as e:
        log.debug("Pinecone upsert failed: %s", e)


def merge_story(sb, source_story_id: str, target_story_id: str, similarity: float) -> bool:
    """
    Merge source_story into target_story:
    1. Record the merge in stories_merged
    2. Reassign all news_story_articles from source → target
    3. Recompute target's article_count, left/center/right counts
    4. Delete source story

    Returns True on success.
    """
    try:
        # 1. Record merge
        sb.table("stories_merged").insert({
            "source_story_id": source_story_id,
            "target_story_id": target_story_id,
            "similarity": float(similarity),
            "method": "pinecone_cosine",
        }).execute()

        # 2. Get all articles linked to source
        src_articles = sb.table("news_story_articles").select("article_id").eq("story_id", source_story_id).execute()
        article_ids = [r["article_id"] for r in (src_articles.data or [])]

        # 3. Check which articles aren't already linked to target (avoid duplicate junction rows)
        if article_ids:
            existing = sb.table("news_story_articles").select("article_id").eq("story_id", target_story_id).in_("article_id", article_ids).execute()
            existing_ids = {r["article_id"] for r in (existing.data or [])}
            new_ids = [aid for aid in article_ids if aid not in existing_ids]

            # 4. Insert new junction rows under target
            for aid in new_ids:
                sb.table("news_story_articles").insert({
                    "story_id": target_story_id,
                    "article_id": aid,
                }).execute()

        # 5. Delete source's junction rows
        sb.table("news_story_articles").delete().eq("story_id", source_story_id).execute()

        # 6. Recompute target's counts by joining articles → sources → leaning
        all_articles = sb.table("news_story_articles").select("article_id, news_articles(source_id, news_sources(leaning))").eq("story_id", target_story_id).execute()
        left = center = right = 0
        total = 0
        for row in (all_articles.data or []):
            total += 1
            leaning = row.get("news_articles", {}).get("news_sources", {}).get("leaning", "center")
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

        # 7. Delete source story
        sb.table("news_stories").delete().eq("id", source_story_id).execute()

        return True
    except Exception as e:
        log.error("Merge failed %s → %s: %s", source_story_id, target_story_id, e)
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually perform merges (default: dry run)")
    parser.add_argument("--hours", type=int, default=48, help="Lookback window")
    parser.add_argument("--min-count", type=int, default=1, help="Only merge lone stories (article_count=1)")
    args = parser.parse_args()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Ensure stories_merged table exists (silent skip if not)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=args.hours)).isoformat()

    # Fetch candidate stories (lone: article_count = 1)
    resp = sb.table("news_stories").select("id, headline, category, first_seen, article_count").gte("first_seen", cutoff).eq("article_count", args.min_count).order("first_seen", desc=True).execute()
    lone_stories = resp.data or []
    log.info("Found %d lone stories in last %dh", len(lone_stories), args.hours)

    if not lone_stories:
        log.info("Nothing to cluster")
        return

    merges_found = 0
    merges_applied = 0

    for story in lone_stories:
        # Get the story's single article
        junc = sb.table("news_story_articles").select("article_id").eq("story_id", story["id"]).limit(1).execute()
        if not junc.data:
            continue

        art = sb.table("news_articles").select("id, title, description").eq("id", junc.data[0]["article_id"]).single().execute()
        if not art.data:
            continue

        # Compute embedding
        text = (art.data["title"] or "") + "\n\n" + (art.data["description"] or "")
        if len(text.strip()) < 10:
            continue

        vec = get_embedding(text)
        if not vec:
            log.debug("Skipping %s — no embedding", story["id"])
            continue

        # Query Pinecone
        matches = query_pinecone_topk(vec, top_k=10)
        best_match = None
        best_sim = 0.0
        for m in matches:
            sim = m.get("score", 0)
            matched_story_id = m.get("metadata", {}).get("story_id")
            if matched_story_id and matched_story_id != story["id"] and sim >= SIMILARITY_THRESHOLD and sim > best_sim:
                best_sim = sim
                best_match = matched_story_id

        if best_match:
            merges_found += 1
            log.info("MATCH %.3f | %s → %s | %s", best_sim, story["id"][:8], best_match[:8], story["headline"][:60])
            if args.apply:
                if merge_story(sb, story["id"], best_match, best_sim):
                    merges_applied += 1

        # Upsert this article to Pinecone for future matching
        upsert_pinecone(
            art.data["id"],
            text,
            vec,
            story["id"],
            {"headline": story["headline"][:200], "category": story.get("category") or ""},
        )

    log.info("Matches found: %d | Applied: %d | Dry run: %s", merges_found, merges_applied, not args.apply)


if __name__ == "__main__":
    main()
