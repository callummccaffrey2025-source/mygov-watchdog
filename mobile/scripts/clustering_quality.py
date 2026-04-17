#!/usr/bin/env python3
"""
clustering_quality.py — Daily audit of clustering quality.

Reports:
- Total stories in last 7/30 days
- Average articles per story
- % of stories with 3+ outlets (multi-coverage threshold)
- % of stories with 5+ outlets (UI threshold for TRENDING badge)
- Top 10 largest clusters by article count
- Owner concentration (% from top 3 owners)

Usage:
  python clustering_quality.py
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)


def report(sb, window_hours: int, label: str):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()

    resp = sb.table("news_stories").select("id, headline, article_count, left_count, center_count, right_count").gte("first_seen", cutoff).execute()
    stories = resp.data or []

    if not stories:
        log.info("\n=== %s ===\nNo stories in window.", label)
        return

    total = len(stories)
    total_articles = sum(s["article_count"] for s in stories)
    avg = total_articles / total if total else 0
    ge3 = sum(1 for s in stories if s["article_count"] >= 3)
    ge5 = sum(1 for s in stories if s["article_count"] >= 5)

    # Blindspot stats
    blindspot_left = sum(1 for s in stories if s["left_count"] == 0 and s["right_count"] > 0)
    blindspot_right = sum(1 for s in stories if s["right_count"] == 0 and s["left_count"] > 0)

    log.info("\n=== %s ===", label)
    log.info("  Stories:                   %d", total)
    log.info("  Articles total:            %d", total_articles)
    log.info("  Avg articles/story:        %.2f", avg)
    log.info("  Stories with ≥3 outlets:   %d (%.1f%%)", ge3, 100 * ge3 / total)
    log.info("  Stories with ≥5 outlets:   %d (%.1f%%)", ge5, 100 * ge5 / total)
    log.info("  Left blindspots:           %d (%.1f%%)", blindspot_left, 100 * blindspot_left / total)
    log.info("  Right blindspots:          %d (%.1f%%)", blindspot_right, 100 * blindspot_right / total)

    # Top 10 clusters
    top = sorted(stories, key=lambda s: -s["article_count"])[:10]
    log.info("\n  Top 10 largest clusters:")
    for i, s in enumerate(top, 1):
        log.info("  %2d. [%d] %s", i, s["article_count"], s["headline"][:70])


def main():
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    log.info("╔══════════════════════════════════════════════════════════╗")
    log.info("║  Verity News Clustering Quality Report                    ║")
    log.info("║  %s  ║", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"))
    log.info("╚══════════════════════════════════════════════════════════╝")

    report(sb, 7 * 24, "Last 7 days")
    report(sb, 30 * 24, "Last 30 days")

    # Merge audit
    try:
        merges = sb.table("stories_merged").select("id", count="exact").execute()
        log.info("\n  Total stories merged (all time): %d", merges.count or 0)
    except Exception:
        log.info("\n  (stories_merged table not present — run migration)")


if __name__ == "__main__":
    main()
