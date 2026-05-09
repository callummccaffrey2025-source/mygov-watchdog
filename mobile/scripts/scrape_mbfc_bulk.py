#!/usr/bin/env python3
"""
scrape_mbfc_bulk.py — Bulk MBFC bias scraper using ScrapeGraphAI.

Instead of searching one source at a time, scrapes MBFC's master source lists
(left, left-center, center, right-center, right) to get hundreds of source
ratings in one pass.

Run:
  python scripts/scrape_mbfc_bulk.py [--dry-run]
"""
import os
import sys
import re
import json
import logging

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

try:
    from scrapegraphai.graphs import SmartScraperGraph
except ImportError:
    sys.exit("ERROR: pip install scrapegraphai playwright && playwright install chromium")


GRAPH_CONFIG = {
    "llm": {
        "model": "anthropic/claude-haiku-4-5-20251001",
        "api_key": os.environ.get("ANTHROPIC_API_KEY", ""),
    },
    "verbose": False,
    "headless": True,
}

# MBFC has master lists organized by bias category
MBFC_LISTS = [
    {"url": "https://mediabiasfactcheck.com/left/", "bias": "left", "score": -0.7},
    {"url": "https://mediabiasfactcheck.com/leftcenter/", "bias": "left-center", "score": -0.35},
    {"url": "https://mediabiasfactcheck.com/center/", "bias": "center", "score": 0.0},
    {"url": "https://mediabiasfactcheck.com/right-center/", "bias": "right-center", "score": 0.35},
    {"url": "https://mediabiasfactcheck.com/right/", "bias": "right", "score": 0.7},
]

LIST_PROMPT = """
Extract all media source names listed on this page.
This is a list of news sources rated by Media Bias Fact Check.
For each source, return just the name.
Return as a JSON array of strings (source names only).
Extract as many as you can find on the page.
"""


def extract_source_list(url: str) -> list[str]:
    """Extract source names from an MBFC category page."""
    try:
        scraper = SmartScraperGraph(
            prompt=LIST_PROMPT, source=url, config=GRAPH_CONFIG
        )
        result = scraper.run()
        if isinstance(result, dict):
            for key in ("content", "sources", "results", "data", "names"):
                val = result.get(key)
                if isinstance(val, list):
                    return [s for s in val if isinstance(s, str) and len(s) > 2]
        if isinstance(result, list):
            return [s for s in result if isinstance(s, str) and len(s) > 2]
        return []
    except Exception as e:
        log.error("Failed to extract from %s: %s", url, e)
        return []


def normalize_name(name: str) -> str:
    """Normalize source name for matching."""
    return re.sub(r"[^a-z0-9\s]", "", name.lower()).strip()


def main():
    dry_run = "--dry-run" in sys.argv

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Get all sources from DB
    r = sb.table("news_sources").select("id,name,bias_score").execute()
    all_sources = r.data or []

    # Build normalized name lookup (only sources missing bias)
    missing_sources = {}
    for s in all_sources:
        if s.get("bias_score") is None:
            missing_sources[normalize_name(s["name"])] = s

    print(f"\n═══════════════ BULK MBFC BIAS SCRAPER ═══════════════")
    print(f"Total sources in DB: {len(all_sources)}")
    print(f"Missing bias data: {len(missing_sources)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    updated = 0
    total_mbfc = 0

    for category in MBFC_LISTS:
        print(f"\n→ {category['bias'].upper()} (score: {category['score']})")
        print(f"  Scraping: {category['url']}")

        sources = extract_source_list(category["url"])
        print(f"  Found {len(sources)} sources on MBFC")
        total_mbfc += len(sources)

        for mbfc_name in sources:
            normalized = normalize_name(mbfc_name)
            match = missing_sources.get(normalized)
            if not match:
                # Try partial matching — check if DB name is contained in MBFC name or vice versa
                for db_norm, db_source in missing_sources.items():
                    if db_norm in normalized or normalized in db_norm:
                        match = db_source
                        break

            if not match:
                continue

            update = {"bias_score": category["score"]}

            if dry_run:
                print(f"    [DRY] {match['name']} → bias={category['score']}")
                updated += 1
            else:
                try:
                    sb.table("news_sources").update(update).eq("id", match["id"]).execute()
                    updated += 1
                    # Remove from missing so we don't double-match
                    norm_key = normalize_name(match["name"])
                    missing_sources.pop(norm_key, None)
                except Exception as e:
                    log.warning("Update failed for %s: %s", match["name"], e)

    print(f"\n═══════════════ SUMMARY ═══════════════")
    print(f"  MBFC sources scraped: {total_mbfc}")
    print(f"  DB sources matched:   {updated}")
    print(f"  Still missing:        {len(missing_sources) - updated}")
    print(f"════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
