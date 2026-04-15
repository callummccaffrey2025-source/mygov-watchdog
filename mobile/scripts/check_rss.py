#!/usr/bin/env python3
"""
check_rss.py — Test alternate RSS URLs for sources that had 0 articles.
Prints entry counts and first 3 titles for each candidate, then updates
news_sources with the best working URL.

Run: python check_rss.py
"""
import os
import sys
import feedparser
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_KEY in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# Candidates: {slug: [list of URLs to try in order]}
CANDIDATES = {
    "abc-news": [
        "https://www.abc.net.au/news/feed/51120/rss.xml",
        "https://www.abc.net.au/news/feed/45910/rss.xml",
        "https://www.abc.net.au/news/politics/feed/2942476/rss.xml",
        "https://www.abc.net.au/news/feed/2942460/rss.xml",
    ],
    "sky-news-au": [
        "https://feeds.skynews.com/feeds/rss/australia.xml",
        "https://www.skynews.com.au/content/dam/skynews/feed/sky-news-australia.xml",
        "https://www.skynews.com.au/rss",
        "https://feeds.skynews.com.au/feeds/top-stories.xml",
    ],
    "reuters": None,  # Removed — dropped public RSS in 2024
    "nine-news": [
        "https://www.9news.com.au/rss",
        "https://www.9news.com.au/national/rss.xml",
        "https://www.9news.com.au/rss.xml",
        "https://nine-news-feed.nine.com.au/rss.xml",
    ],
    "seven-news": [
        "https://7news.com.au/rss",
        "https://7news.com.au/news/rss",
        "https://7news.com.au/news/national/rss",
    ],
    "the-new-daily": [
        "https://thenewdaily.com.au/feed/",
        "https://thenewdaily.com.au/news/feed/",
        "https://thenewdaily.com.au/news/politics/feed/",
    ],
    "canberra-times": [
        "https://www.canberratimes.com.au/rss.xml",
        "https://www.canberratimes.com.au/national/act/rss.xml",
        "https://www.canberratimes.com.au/national/rss.xml",
    ],
}


def test_url(url: str) -> tuple[int, list[str]]:
    """Returns (entry_count, first_3_titles)."""
    try:
        feed = feedparser.parse(url)
        entries = feed.entries or []
        titles = [e.get("title", "(no title)") for e in entries[:3]]
        return len(entries), titles
    except Exception as e:
        return 0, [f"ERROR: {e}"]


def main():
    print("=" * 60)
    print("RSS URL DIAGNOSTICS")
    print("=" * 60)

    updates = {}  # slug → best working URL

    for slug, candidates in CANDIDATES.items():
        print(f"\n── {slug} ──")

        # Fetch current URL from DB
        resp = sb.table("news_sources").select("id,name,rss_url").eq("slug", slug).execute()
        row = resp.data[0] if resp.data else None
        if not row:
            print("  NOT IN DB — skipping")
            continue

        source_id = row["id"]
        current_url = row["rss_url"]
        print(f"  Current URL: {current_url}")

        # Reuters special case — null it out
        if candidates is None:
            print("  → Marking as inactive (no public RSS)")
            sb.table("news_sources").update({"rss_url": None}).eq("id", source_id).execute()
            continue

        best_url = None
        best_count = 0

        for url in candidates:
            count, titles = test_url(url)
            status = f"{count} entries"
            print(f"  {url}")
            print(f"    → {status}")
            if titles:
                for t in titles[:2]:
                    print(f"       • {t[:80]}")
            if count > best_count:
                best_count = count
                best_url = url

        if best_url and best_url != current_url:
            if best_count > 0:
                print(f"  ✓ Updating to: {best_url} ({best_count} entries)")
                sb.table("news_sources").update({"rss_url": best_url}).eq("id", source_id).execute()
                updates[slug] = best_url
            else:
                print(f"  ✗ No working URL found for {slug}")
        elif best_url == current_url:
            if best_count > 0:
                print(f"  ✓ Current URL already works ({best_count} entries)")
            else:
                print(f"  ✗ Current URL returns 0 entries, no better alternative found")
        else:
            print(f"  ✗ No candidates returned entries")

    print("\n" + "=" * 60)
    print(f"Updated {len(updates)} source(s): {list(updates.keys())}")
    print("=" * 60)


if __name__ == "__main__":
    main()
