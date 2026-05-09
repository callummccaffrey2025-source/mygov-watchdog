#!/usr/bin/env python3
"""
scrape_electorate_news.py — LLM-powered electorate-level news scraper using ScrapeGraphAI.

Uses SearchGraph to find local news per electorate for the personalised feed.
Searches for recent political/infrastructure/community news in each electorate.

Writes to: news_articles table (tagged with electorate_id for feed personalization)

Run:
  python scripts/scrape_electorate_news.py [--dry-run] [--limit 10] [--electorate "Bennelong"]
"""
import os
import sys
import json
import logging
from datetime import datetime, timedelta

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

# Google News RSS is free and doesn't block bots
GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q={query}&hl=en-AU&gl=AU&ceid=AU:en"

NEWS_PROMPT = """
Extract all news articles from this RSS/news feed page.
For each article return:
- title: the article headline
- url: the full article URL (the link, not the RSS feed URL)
- source: the news source/publisher name
- date: publication date (ISO format YYYY-MM-DD) or null
- summary: 1-2 sentence description if available

Return as a JSON array. Only include actual news articles with URLs.
"""

# Priority electorates — marginal seats + major metro areas for maximum user coverage
PRIORITY_ELECTORATES = [
    "Bennelong", "Wentworth", "Reid", "Mackellar", "Warringah",  # Sydney
    "Kooyong", "Higgins", "Goldstein", "Aston", "Deakin",  # Melbourne
    "Brisbane", "Ryan", "Griffith", "Lilley", "Moreton",  # Brisbane
    "Curtin", "Swan", "Tangney", "Hasluck", "Pearce",  # Perth
    "Boothby", "Sturt", "Adelaide", "Mayo", "Kingston",  # Adelaide
    "Bass", "Braddon", "Clark", "Franklin", "Lyons",  # Tasmania
    "Bean", "Canberra", "Fenner",  # ACT
    "Solomon", "Lingiari",  # NT
]


def search_electorate_news(electorate: str) -> list[dict]:
    """Search Google News RSS for recent electorate news, then extract with LLM."""
    import urllib.parse

    # Search terms that work well for electorates
    queries = [
        f'"{electorate}" electorate',
        f'"{electorate}" council development',
    ]

    all_articles = []
    for query in queries:
        url = GOOGLE_NEWS_RSS.format(query=urllib.parse.quote(query))
        try:
            scraper = SmartScraperGraph(
                prompt=NEWS_PROMPT, source=url, config=GRAPH_CONFIG
            )
            result = scraper.run()

            articles = []
            if isinstance(result, dict):
                for key in ("content", "articles", "results", "news", "data", "items"):
                    if key in result and isinstance(result[key], list):
                        articles = result[key]
                        break
            elif isinstance(result, list):
                articles = result

            for a in articles:
                if isinstance(a, dict) and a.get("title") and a.get("url"):
                    all_articles.append(a)
        except Exception as e:
            log.error("Search failed for query '%s': %s", query, e)

    # Deduplicate by URL
    seen = set()
    unique = []
    for a in all_articles:
        if a["url"] not in seen:
            seen.add(a["url"])
            unique.append(a)
    return unique[:5]


def article_exists(sb, url: str) -> bool:
    """Check if article URL already exists."""
    try:
        r = sb.table("news_articles").select("id").eq("url", url).limit(1).execute()
        return len(r.data or []) > 0
    except Exception:
        return False


def main():
    dry_run = "--dry-run" in sys.argv
    limit = 10
    target_electorate = None

    for i, arg in enumerate(sys.argv):
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])
        if arg == "--electorate" and i + 1 < len(sys.argv):
            target_electorate = sys.argv[i + 1]

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Get electorates from DB
    r = sb.table("electorates").select("id,name,state").execute()
    electorates_db = {e["name"].lower(): e for e in (r.data or [])}

    # Determine which electorates to process
    if target_electorate:
        electorates_to_search = [target_electorate]
    else:
        electorates_to_search = PRIORITY_ELECTORATES[:limit]

    print(f"\n═══════════════ ELECTORATE NEWS SCRAPER ═══════════════")
    print(f"Electorates in DB: {len(electorates_db)}")
    print(f"Searching: {len(electorates_to_search)} electorates")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    total_articles = 0
    total_new = 0

    for electorate_name in electorates_to_search:
        print(f"\n→ {electorate_name}")

        # Match to DB
        electorate = electorates_db.get(electorate_name.lower())
        if not electorate:
            print(f"  ✗ Not found in DB")
            continue

        articles = search_electorate_news(electorate_name)
        print(f"  Found {len(articles)} articles")
        total_articles += len(articles)

        for article in articles:
            url = article.get("url", "").strip()
            title = article.get("title", "").strip()
            if not url or not title:
                continue

            if not dry_run and article_exists(sb, url):
                continue

            row = {
                "title": title[:500],
                "url": url,
                "source_name": article.get("source", ""),
                "published_at": article.get("date"),
                "description": article.get("summary", "")[:1000],
                "electorate_id": electorate["id"],
                "is_local": True,
            }

            if dry_run:
                if total_new < 10:
                    print(f"    [DRY] {title[:60]} ({article.get('source', 'unknown')})")
                total_new += 1
            else:
                try:
                    sb.table("news_articles").insert(row).execute()
                    total_new += 1
                    print(f"    ✓ {title[:60]}")
                except Exception as e:
                    log.warning("Insert failed: %s", e)

    print(f"\n═══════════════ SUMMARY ═══════════════")
    print(f"  Articles found:    {total_articles}")
    print(f"  New articles:      {total_new}")
    print(f"════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
