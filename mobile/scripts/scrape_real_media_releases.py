#!/usr/bin/env python3
"""
scrape_real_media_releases.py — Scrape real, verifiable media releases from
official Australian government websites and insert them into official_posts.

Strategy:
  - For each MP target with a known media-release URL, fetch the page
  - Parse the title + first paragraph + canonical link
  - Insert with post_type='announcement', media_urls=[link], is_pinned=false
  - Skip silently if the URL is unreachable or returns no parseable content

NEVER fabricate content. Only insert posts where the source URL was successfully
fetched and contains a parseable title.

Run:  python scripts/scrape_real_media_releases.py
"""
import os
import sys
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urljoin

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

import requests
from bs4 import BeautifulSoup
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

TIMEOUT = 20
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; VerityScraper/1.0; +https://verity.au)"
}


# ── Target list ────────────────────────────────────────────────────────────────
# Each target maps an MP's full name to a media-release URL.
# Only adding sources that follow a discoverable, parseable pattern.
TARGETS: list[dict] = [
    {
        "name": "Anthony Albanese",
        "url": "https://www.pm.gov.au/media",
        "kind": "wordpress_pm",
    },
    {
        "name": "Jim Chalmers",
        "url": "https://ministers.treasury.gov.au/ministers/jim-chalmers-2022/media-releases",
        "kind": "treasury",
    },
    {
        "name": "Penny Wong",
        "url": "https://www.foreignminister.gov.au/minister/penny-wong/media-releases",
        "kind": "dfat",
    },
    {
        "name": "Richard Marles",
        "url": "https://www.minister.defence.gov.au/media-releases",
        "kind": "defence",
    },
    {
        "name": "Mark Butler",
        "url": "https://www.health.gov.au/ministers/the-hon-mark-butler-mp/media",
        "kind": "health",
    },
]


def fetch(url: str) -> BeautifulSoup | None:
    """Fetch a URL and return parsed HTML, or None on failure."""
    try:
        resp = requests.get(url, timeout=TIMEOUT, headers=HEADERS, allow_redirects=True)
        if resp.status_code != 200:
            log.warning("HTTP %d on %s", resp.status_code, url)
            return None
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        log.warning("Fetch failed for %s: %s", url, e)
        return None


def find_release_links(soup: BeautifulSoup, base_url: str, max_links: int = 10) -> list[str]:
    """
    Find media-release article links on a listing page.
    Heuristics: links containing /media/, /media-releases/, /news/, /press-release/
    """
    if not soup:
        return []
    links = set()
    # Match deeper paths only — exclude bare /media or /media-releases listings
    patterns = [
        re.compile(r"/media/[a-z0-9][a-z0-9\-]{6,}", re.I),
        re.compile(r"/media-releases?/[a-z0-9][a-z0-9\-]{6,}", re.I),
        re.compile(r"/press-release[s]?/[a-z0-9][a-z0-9\-]{6,}", re.I),
        re.compile(r"/news/[a-z0-9][a-z0-9\-]{6,}", re.I),
    ]
    # Anti-patterns: don't follow listing pages, search, archives
    anti = re.compile(r"(\?|#|/page/|/archive|/search|/feed|/category/|readspeaker)", re.I)
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#") or anti.search(href):
            continue
        full = urljoin(base_url, href)
        if any(p.search(full) for p in patterns):
            links.add(full)
        if len(links) >= max_links * 3:
            break
    return list(links)[:max_links]


def parse_release(soup: BeautifulSoup) -> dict | None:
    """Extract title + first paragraph from a media release page."""
    if not soup:
        return None

    # Title: prefer og:title, then <h1>, then <title>
    title = None
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
    if not title:
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)
    if not title or len(title) < 10:
        return None

    # Body: first meaningful paragraph
    body = None
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        body = og_desc["content"].strip()
    if not body or len(body) < 40:
        # Find the first <p> with substantial text inside <article> or <main>
        container = soup.find("article") or soup.find("main") or soup
        for p in container.find_all("p"):
            text = p.get_text(strip=True)
            if len(text) > 60:
                body = text
                break
    if not body or len(body) < 40:
        return None

    # Trim body to ~500 chars
    if len(body) > 500:
        body = body[:497] + "…"

    # Date: try <time>, og:article:published_time, datetime attribute
    date_iso = None
    time_tag = soup.find("time")
    if time_tag and time_tag.get("datetime"):
        date_iso = time_tag["datetime"]
    if not date_iso:
        meta_date = soup.find("meta", property="article:published_time")
        if meta_date and meta_date.get("content"):
            date_iso = meta_date["content"]

    return {"title": title, "body": body, "date": date_iso}


def find_member(sb, full_name: str) -> dict | None:
    """Find a member by full name. Returns the row or None."""
    parts = full_name.strip().split()
    if len(parts) < 2:
        return None
    first, last = parts[0], parts[-1]
    r = (
        sb.table("members")
        .select("id, first_name, last_name")
        .eq("first_name", first)
        .eq("last_name", last)
        .limit(1)
        .execute()
    )
    if r.data:
        return r.data[0]
    return None


def post_already_exists(sb, author_id: str, link: str) -> bool:
    """Avoid duplicates by matching media_urls[0] = link."""
    # Use textual contains since media_urls is array
    r = (
        sb.table("official_posts")
        .select("id")
        .eq("author_id", author_id)
        .contains("media_urls", [link])
        .limit(1)
        .execute()
    )
    return len(r.data or []) > 0


def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY in .env")

    sb = create_client(url, key)

    inserted = 0
    skipped = 0
    failed = 0
    by_mp: dict[str, int] = {}

    print()
    print("═══════════════ SCRAPING REAL MEDIA RELEASES ═══════════════")

    for target in TARGETS:
        name = target["name"]
        listing_url = target["url"]
        print(f"\n→ {name}: {listing_url}")

        member = find_member(sb, name)
        if not member:
            print(f"  ✗ Member '{name}' not found in DB, skipping")
            failed += 1
            continue

        author_id = member["id"]
        listing = fetch(listing_url)
        if not listing:
            print(f"  ✗ Could not fetch listing page")
            failed += 1
            continue

        links = find_release_links(listing, listing_url, max_links=5)
        if not links:
            print(f"  ✗ No media-release links found on listing page")
            failed += 1
            continue

        print(f"  Found {len(links)} candidate links")

        for link in links:
            if post_already_exists(sb, author_id, link):
                skipped += 1
                continue

            release_soup = fetch(link)
            release = parse_release(release_soup)
            if not release:
                print(f"  – {link}: not parseable, skipping")
                continue

            content = f"{release['title']}\n\n{release['body']}"
            row = {
                "author_id": author_id,
                "author_type": "member",
                "content": content,
                "post_type": "announcement",
                "media_urls": [link],
                "is_pinned": False,
                "likes_count": 0,
                "dislikes_count": 0,
                "comments_count": 0,
            }
            # Use the page's published date if we found one
            if release.get("date"):
                row["created_at"] = release["date"]

            try:
                sb.table("official_posts").insert(row).execute()
                inserted += 1
                by_mp[name] = by_mp.get(name, 0) + 1
                print(f"  ✓ {release['title'][:80]}")
            except Exception as e:
                failed += 1
                log.warning("Insert failed for %s: %s", link, e)

    print()
    print("═══════════════ SUMMARY ═══════════════")
    print(f"  Inserted:  {inserted}")
    print(f"  Skipped (already exists): {skipped}")
    print(f"  Failed:    {failed}")
    print()
    if by_mp:
        print("  Posts by MP:")
        for name, count in by_mp.items():
            print(f"    {name}: {count}")
    print("════════════════════════════════════════")


if __name__ == "__main__":
    main()
