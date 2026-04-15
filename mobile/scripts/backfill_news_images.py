#!/usr/bin/env python3
"""
backfill_news_images.py — Backfill image_url for news_articles and news_stories.

Strategy:
  1. Fetch og:image / twitter:image from each news_article URL (limit 100 most recent).
  2. For each news_story still missing image_url, try to find a matching news_article
     by slug/headline similarity and copy its image.

Usage:
    python3 backfill_news_images.py
"""

import os
import re
import logging
import time
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

TIMEOUT = 3
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Verity/1.0; +https://verity.au)"
}


def fetch_og_image(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=TIMEOUT, headers=HEADERS, allow_redirects=True)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "lxml")
        # og:image first
        tag = soup.find("meta", property="og:image")
        if tag and tag.get("content"):
            return tag["content"].strip()
        # twitter:image fallback
        tag = soup.find("meta", attrs={"name": "twitter:image"})
        if tag and tag.get("content"):
            return tag["content"].strip()
        return None
    except Exception:
        return None


def slugify(text: str) -> str:
    """Simple slug for rough matching."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Max articles to process (0 = all)")
    args = parser.parse_args()

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    sb = create_client(url, key)

    # ── Step 1: Backfill news_articles ─────────────────────────────────────
    log.info("Fetching news_articles with null image_url …")
    q = (
        sb.table("news_articles")
        .select("id, title, url, image_url")
        .is_("image_url", "null")
        .not_.is_("url", "null")
        .order("published_at", desc=True)
    )
    if args.limit > 0:
        q = q.limit(args.limit)
    articles = q.execute().data

    log.info("Found %d articles to process", len(articles))
    art_updated = 0
    art_skipped = 0
    # Map slug → image_url for story backfill later
    title_to_image: dict[str, str] = {}

    for i, art in enumerate(articles):
        img = fetch_og_image(art["url"])
        if img:
            sb.table("news_articles").update({"image_url": img}).eq("id", art["id"]).execute()
            title_to_image[slugify(art["title"])] = img
            art_updated += 1
            log.info("[%d/%d] ✓ %s", i + 1, len(articles), art["title"][:60])
        else:
            art_skipped += 1
            log.info("[%d/%d] – no image: %s", i + 1, len(articles), art["title"][:60])
        # Small politeness delay
        time.sleep(0.1)

    log.info("Articles: %d updated, %d skipped", art_updated, art_skipped)

    # ── Step 2: Propagate to news_stories ──────────────────────────────────
    log.info("Fetching news_stories with null image_url …")
    stories = (
        sb.table("news_stories")
        .select("id, headline, slug, image_url")
        .is_("image_url", "null")
        .order("first_seen", desc=True)
        .execute()
    ).data

    log.info("Found %d stories without images", len(stories))
    story_updated = 0

    # Also pull any articles that already had images (from this run or prior)
    filled_arts = (
        sb.table("news_articles")
        .select("title, image_url")
        .not_.is_("image_url", "null")
        .execute()
    ).data
    for art in filled_arts:
        title_to_image[slugify(art["title"])] = art["image_url"]

    for story in stories:
        # Match by slug (already slug-formatted) or headline slug
        story_slug = story.get("slug") or slugify(story["headline"])
        story_key = slugify(story["headline"])
        img = None
        for art_key, art_img in title_to_image.items():
            # Check if enough words overlap (rough similarity)
            words_s = set(story_key.split())
            words_a = set(art_key.split())
            if len(words_s) > 0 and len(words_a) > 0:
                overlap = len(words_s & words_a) / max(len(words_s), len(words_a))
                if overlap >= 0.6:
                    img = art_img
                    break
        if img:
            sb.table("news_stories").update({"image_url": img}).eq("id", story["id"]).execute()
            story_updated += 1
            log.info("Story matched: %s", story["headline"][:60])

    log.info("Stories updated from article match: %d", story_updated)

    # ── Summary ────────────────────────────────────────────────────────────
    final_stories = (
        sb.table("news_stories")
        .select("id", count="exact")
        .not_.is_("image_url", "null")
        .execute()
    )
    total_stories = (
        sb.table("news_stories")
        .select("id", count="exact")
        .execute()
    )
    print()
    print("═══════════ SUMMARY ═══════════")
    print(f"  Articles processed:  {len(articles)}")
    print(f"  Articles updated:    {art_updated}")
    print(f"  Articles skipped:    {art_skipped}")
    print(f"  Stories now with images: {final_stories.count} / {total_stories.count}")
    print("════════════════════════════════")


if __name__ == "__main__":
    main()
