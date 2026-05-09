#!/usr/bin/env python3
"""
scrape_media_scrapegraph.py — LLM-powered media release scraper using ScrapeGraphAI.

Replaces brittle CSS selector / regex parsing with natural-language extraction.
Keeps all existing infrastructure: polite_get, mp_author_parser, dedup, Supabase insert.

ScrapeGraphAI handles:
  - Finding media release links on listing pages (no regex patterns needed)
  - Extracting title, body, date from individual release pages (no BeautifulSoup)
  - Adapting automatically when government sites change layout

Install:
  pip install scrapegraphai playwright
  playwright install chromium

Run:
  python scripts/scrape_media_scrapegraph.py [--dry-run]
"""
import os
import sys
import json
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

from supabase import create_client

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp_author_parser import build_members_index, resolve_primary_author  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# Lazy import — only fail if actually running
try:
    from scrapegraphai.graphs import SmartScraperGraph
except ImportError:
    print("ERROR: scrapegraphai not installed. Run: pip install scrapegraphai playwright")
    print("       Then: playwright install chromium")
    sys.exit(1)


# ── Config ────────────────────────────────────────────────────────────────────

GRAPH_CONFIG = {
    "llm": {
        "model": "anthropic/claude-haiku-4-5-20251001",
        "api_key": os.environ.get("ANTHROPIC_API_KEY", ""),
    },
    "model_tokens": 200000,
    "verbose": False,
    "headless": True,
    "browser_config": {
        "user_agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36 "
            "VerityBot/1.0 (+https://verity.run/bot)"
        ),
    },
}


# ── Targets ───────────────────────────────────────────────────────────────────
# Same targets as the original scraper — ministerial media release pages.

TARGETS: list[dict] = [
    {
        "name": "Anthony Albanese",
        "url": "https://www.pm.gov.au/media",
    },
    {
        "name": "Jim Chalmers",
        "url": "https://ministers.treasury.gov.au/ministers/jim-chalmers-2022/media-releases",
    },
    {
        "name": "Penny Wong",
        "url": "https://www.foreignminister.gov.au/minister/penny-wong/media-releases",
    },
    {
        "name": "Richard Marles",
        "url": "https://www.minister.defence.gov.au/media-releases",
    },
    {
        "name": "Mark Butler",
        "url": "https://www.health.gov.au/ministers/the-hon-mark-butler-mp/media",
    },
]


# ── Extraction prompts ────────────────────────────────────────────────────────

LISTING_PROMPT = """
Extract the 5 most recent media release links from this page.
For each release, return:
- title: the headline text
- url: the full URL (absolute, not relative)
- date: publication date if visible (ISO format YYYY-MM-DD), or null

Return as a JSON array. Only include actual media releases (press releases,
statements, announcements), not navigation links, category pages, or archives.
"""

RELEASE_PROMPT = """
Extract the following from this media release page:
- title: the headline/title of the release
- body: the first 2-3 sentences summarizing the release (not the full text)
- date: publication date in ISO format (YYYY-MM-DD or full ISO datetime), or null
- author_names: list of minister/MP names mentioned as authors (from byline, attribution, or "Joint media release" headers)

Return as a JSON object. Only extract what is actually on the page — never fabricate content.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_listing(url: str) -> list[dict]:
    """Use ScrapeGraphAI to extract media release links from a listing page."""
    try:
        scraper = SmartScraperGraph(
            prompt=LISTING_PROMPT,
            source=url,
            config=GRAPH_CONFIG,
        )
        result = scraper.run()
        # Result may be a dict with a key, or a list directly
        if isinstance(result, dict):
            # Try common wrapper keys
            for key in ("content", "releases", "media_releases", "results", "links", "items"):
                if key in result and isinstance(result[key], list):
                    items = result[key]
                    # Filter out "NA" placeholder items
                    return [i for i in items if isinstance(i, dict) and i.get("url") and i["url"] != "NA"]
            # If dict has the fields directly, wrap it
            if "title" in result and "url" in result and result["url"] != "NA":
                return [result]
            # Return values if they're all lists
            for v in result.values():
                if isinstance(v, list):
                    items = v
                    return [i for i in items if isinstance(i, dict) and i.get("url") and i["url"] != "NA"]
        if isinstance(result, list):
            return [i for i in result if isinstance(i, dict) and i.get("url") and i["url"] != "NA"]
        log.warning("Unexpected listing result type: %s", type(result))
        return []
    except Exception as e:
        log.error("ScrapeGraphAI listing extraction failed for %s: %s", url, e)
        return []


def extract_release(url: str) -> dict | None:
    """Use ScrapeGraphAI to extract structured data from a single release page."""
    try:
        scraper = SmartScraperGraph(
            prompt=RELEASE_PROMPT,
            source=url,
            config=GRAPH_CONFIG,
        )
        result = scraper.run()
        if isinstance(result, dict):
            # Handle nested response — LLM may wrap in a key
            if result.get("title"):
                return result
            # Try unwrapping common wrapper keys
            for key in ("content", "release", "media_release", "result", "data"):
                if key in result and isinstance(result[key], dict) and result[key].get("title"):
                    return result[key]
            # If there's any key with a string value that looks like a title, extract it
            log.warning("No title in release extraction for %s — raw: %s", url, str(result)[:200])
        else:
            log.warning("Unexpected release result type for %s: %s — raw: %s", url, type(result), str(result)[:200])
        return None
    except Exception as e:
        log.error("ScrapeGraphAI release extraction failed for %s: %s", url, e)
        return None


def post_already_exists_by_url(sb, link: str) -> bool:
    """Dedup by link."""
    try:
        r = (
            sb.table("official_posts")
            .select("id")
            .contains("media_urls", [link])
            .limit(1)
            .execute()
        )
        return len(r.data or []) > 0
    except Exception:
        return False


def queue_for_review(sb, proposed: dict, reason: str) -> None:
    """Write an unattributable release to ingestion_review_queue."""
    try:
        sb.table("ingestion_review_queue").insert(
            {
                "source_table": "official_posts",
                "proposed_data": proposed,
                "reason": reason,
            }
        ).execute()
    except Exception as e:
        log.warning("Failed to queue for review: %s", e)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    dry_run = "--dry-run" in sys.argv

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY in .env")

    sb = create_client(url, key)
    members_index = build_members_index(sb)
    if not members_index:
        raise SystemExit("No members loaded — byline resolution will fail; aborting")

    inserted = 0
    skipped = 0
    failed = 0
    unattributed = 0
    by_mp: dict[str, int] = {}

    print()
    print("═══════════════ SCRAPEGRAPH MEDIA RELEASE SCRAPER ═══════════════")
    print(f"Members in index: {len(members_index)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"LLM: {GRAPH_CONFIG['llm']['model']}")
    print()

    for target in TARGETS:
        target_name = target["name"]
        listing_url = target["url"]
        print(f"→ {target_name}: {listing_url}")

        # Step 1: Extract listing with LLM
        releases = extract_listing(listing_url)
        if not releases:
            print("  ✗ No releases extracted from listing page")
            failed += 1
            continue

        print(f"  Found {len(releases)} releases via ScrapeGraphAI")

        for item in releases[:5]:  # Cap at 5 per target
            link = item.get("url", "").strip()
            if not link:
                continue

            if post_already_exists_by_url(sb, link):
                skipped += 1
                continue

            # Step 2: Extract full release content
            release = extract_release(link)
            if not release:
                print(f"  – {link}: extraction failed, skipping")
                continue

            title = release.get("title", "").strip()
            body = release.get("body", "").strip()
            if not title or len(title) < 10:
                continue
            if not body or len(body) < 40:
                # Use listing title as fallback body
                body = item.get("title", title)

            # Trim body
            if len(body) > 500:
                body = body[:497] + "…"

            content = f"{title}\n\n{body}"

            # Step 3: Resolve author via byline parser
            # Augment content with LLM-extracted author names for better matching
            author_names = release.get("author_names") or []
            augmented_content = content
            if author_names:
                # Format names as "The Hon [Name] MP" to match byline parser patterns
                bylines = " ".join(f"The Hon {name} MP" for name in author_names if name)
                augmented_content = f"{bylines}\n\n{content}"
            author_member, matched_name = resolve_primary_author(augmented_content, members_index)
            if not author_member:
                unattributed += 1
                if not dry_run:
                    queue_for_review(
                        sb,
                        proposed={
                            "source_page_owner": target_name,
                            "media_urls": [link],
                            "content_preview": content[:500],
                        },
                        reason="No byline resolved to a known member — manual attribution needed",
                    )
                print(f"  ⚠ {link}: no byline match, queued for review")
                continue

            row = {
                "author_id": author_member["id"],
                "author_type": "member",
                "content": content,
                "post_type": "announcement",
                "media_urls": [link],
                "is_pinned": False,
                "likes_count": 0,
                "dislikes_count": 0,
                "comments_count": 0,
                "attribution_verified": True,
            }

            # Use extracted date
            date_str = release.get("date") or item.get("date")
            if date_str:
                row["created_at"] = date_str

            if dry_run:
                attributed_name = f"{author_member.get('first_name','')} {author_member.get('last_name','')}".strip()
                print(f"  [DRY] ✓ {title[:70]}  → {attributed_name}")
                inserted += 1
            else:
                try:
                    sb.table("official_posts").insert(row).execute()
                    inserted += 1
                    attributed_name = f"{author_member.get('first_name','')} {author_member.get('last_name','')}".strip()
                    by_mp[attributed_name] = by_mp.get(attributed_name, 0) + 1
                    mismatch_flag = "" if attributed_name.lower() == target_name.lower() else f"  (page: {target_name})"
                    print(f"  ✓ {title[:70]}  → {matched_name}{mismatch_flag}")
                except Exception as e:
                    failed += 1
                    log.warning("Insert failed for %s: %s", link, e)

    print()
    print("═══════════════ SUMMARY ═══════════════")
    print(f"  Inserted:                        {inserted}")
    print(f"  Skipped (already exists):        {skipped}")
    print(f"  Queued for review (no byline):   {unattributed}")
    print(f"  Failed:                          {failed}")
    if by_mp:
        print()
        print("  Posts by MP:")
        for name, count in by_mp.items():
            print(f"    {name}: {count}")
    print("════════════════════════════════════════")


if __name__ == "__main__":
    main()
