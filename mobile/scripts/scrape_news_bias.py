#!/usr/bin/env python3
"""
scrape_news_bias.py — LLM-powered news source bias scraper using ScrapeGraphAI.

Scrapes Media Bias/Fact Check (MBFC) to fill gaps in the news_sources table.
Currently 77% of sources have bias metadata — this targets the remaining 23%.

Writes to: news_sources table (updates bias_score, factuality, owner)

Run:
  python scripts/scrape_news_bias.py [--dry-run] [--limit 20]
"""
import os
import sys
import json
import logging
import re

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

BIAS_PROMPT = """
Extract the media bias rating information from this page.
Return:
- source_name: the name of the news source being rated
- bias_rating: the overall bias rating (e.g. "Left", "Left-Center", "Center", "Right-Center", "Right", "Far Left", "Far Right")
- factuality: the factual reporting rating (e.g. "Very High", "High", "Mostly Factual", "Mixed", "Low", "Very Low")
- owner: who owns this media outlet
- country: country of origin
- media_type: type (e.g. "Newspaper", "TV", "Online", "Radio")

Return as a JSON object. Only extract what is explicitly stated on the page.
"""

# Map MBFC ratings to numeric bias_score (-1.0 to 1.0)
BIAS_MAP = {
    "far left": -1.0,
    "left": -0.7,
    "left-center": -0.35,
    "center": 0.0,
    "least biased": 0.0,
    "right-center": 0.35,
    "right": 0.7,
    "far right": 1.0,
}

# Map MBFC factuality to integer (1-5 scale matching existing DB data)
FACTUALITY_MAP = {
    "very high": 5,
    "high": 4,
    "mostly factual": 3,
    "mixed": 2,
    "low": 1,
    "very low": 0,
}


def name_to_slug(name: str) -> str:
    """Convert source name to MBFC URL slug."""
    slug = name.lower().strip()
    # Remove common prefixes/suffixes
    slug = re.sub(r"^(the|a)\s+", "", slug)
    slug = re.sub(r"\s+(online|australia|au|uk|us)$", "", slug)
    # Replace non-alpha with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


def search_mbfc(source_name: str) -> str | None:
    """Construct likely MBFC URL and verify it loads."""
    slug = name_to_slug(source_name)
    # MBFC uses predictable URL patterns
    candidates = [
        f"https://mediabiasfactcheck.com/{slug}/",
        f"https://mediabiasfactcheck.com/{slug}-bias-rating/",
    ]
    for url in candidates:
        try:
            import requests
            resp = requests.head(url, timeout=10, allow_redirects=True,
                              headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                return resp.url  # Follow redirects
        except Exception:
            continue
    return None


def extract_bias(url: str) -> dict | None:
    """Extract bias rating from an MBFC page."""
    try:
        scraper = SmartScraperGraph(
            prompt=BIAS_PROMPT, source=url, config=GRAPH_CONFIG
        )
        result = scraper.run()
        if isinstance(result, dict):
            if result.get("bias_rating"):
                return result
            for key in ("content", "data", "result", "rating"):
                val = result.get(key)
                if isinstance(val, dict) and val.get("bias_rating"):
                    return val
                # Sometimes content is a string representation
            # If none of the above, check if any nested value looks right
        return None
    except Exception as e:
        log.error("Bias extraction failed for %s: %s", url, e)
        return None


def main():
    dry_run = "--dry-run" in sys.argv
    limit = 20
    for i, arg in enumerate(sys.argv):
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Get sources missing bias data
    r = sb.table("news_sources").select("id,name,website_url,bias_score,factuality_numeric,owner").execute()
    all_sources = r.data or []
    missing = [s for s in all_sources if s.get("bias_score") is None]

    print(f"\n═══════════════ NEWS SOURCE BIAS SCRAPER ═══════════════")
    print(f"Total sources: {len(all_sources)}")
    print(f"Missing bias data: {len(missing)}")
    print(f"Will process: {min(limit, len(missing))}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    updated = 0
    not_found = 0

    for source in missing[:limit]:
        source_name = source.get("name") or source.get("website_url", "")
        if not source_name:
            continue

        print(f"\n→ {source_name}")

        # Search for MBFC page
        mbfc_url = search_mbfc(source_name)
        if not mbfc_url:
            print(f"  ✗ No MBFC page found")
            not_found += 1
            continue

        print(f"  Found: {mbfc_url}")

        # Extract bias data
        bias_data = extract_bias(mbfc_url)
        if not bias_data:
            print(f"  ✗ Could not extract bias data")
            not_found += 1
            continue

        # Map to numeric scores — strip parenthetical numbers like "(2.2)"
        bias_rating_raw = (bias_data.get("bias_rating") or "").lower().strip()
        bias_rating = re.sub(r"\s*\([\d.]+\)\s*", "", bias_rating_raw).strip()
        factuality_raw = (bias_data.get("factuality") or "").lower().strip()
        factuality = re.sub(r"\s*\([\d.]+\)\s*", "", factuality_raw).strip()
        owner = bias_data.get("owner")

        update = {}
        if bias_rating in BIAS_MAP:
            update["bias_score"] = BIAS_MAP[bias_rating]
        if factuality in FACTUALITY_MAP:
            update["factuality_numeric"] = FACTUALITY_MAP[factuality]
            update["factuality_rating"] = bias_data.get("factuality", "").strip()
        if owner:
            update["owner"] = owner[:200]

        if not update:
            print(f"  – No mappable data (rating: {bias_rating}, factuality: {factuality})")
            not_found += 1
            continue

        if dry_run:
            print(f"  [DRY] bias={update.get('bias_score')}, factuality={update.get('factuality')}, owner={update.get('owner', 'N/A')[:40]}")
            updated += 1
        else:
            try:
                sb.table("news_sources").update(update).eq("id", source["id"]).execute()
                print(f"  ✓ Updated: bias={update.get('bias_score')}, factuality={update.get('factuality')}")
                updated += 1
            except Exception as e:
                log.warning("Update failed for %s: %s", source_name, e)

    print(f"\n═══════════════ SUMMARY ═══════════════")
    print(f"  Updated:   {updated}")
    print(f"  Not found: {not_found}")
    print(f"════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
