#!/usr/bin/env python3
"""
seed_news_sources.py — Upsert bias/factuality/ownership metadata for Australian
news sources into the news_sources table.

Run:  python scripts/seed_news_sources.py
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


# ── Source metadata ────────────────────────────────────────────────────────────
# Fields:
#   slug             — matches existing news_sources.slug (unique key for upsert)
#   leaning          — left / center-left / center / center-right / right
#   bias_score       — -2.0 (far left) to +2.0 (far right), 0 = centre
#   factuality_rating — "Very High" / "High" / "Mixed" / "Low"
#   factuality_numeric — 4=Very High, 3=High, 2=Mixed, 1=Low
#   media_type       — Newspaper / Digital / TV / Radio / Wire / Magazine
#   owner            — parent company / publisher
#   paywall          — True/False

SOURCES = [
    # ── Public Broadcasters — ABC variants ────────────────────────────────────
    {
        "slug": "abc-news",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "TV", "owner": "Australian Broadcasting Corporation", "paywall": False,
    },
    {
        "slug": "abc-news-au",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "TV", "owner": "Australian Broadcasting Corporation", "paywall": False,
    },
    {
        "slug": "australian-broadcasting-corporation",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "TV", "owner": "Australian Broadcasting Corporation", "paywall": False,
    },
    {
        "slug": "abc-australian-broadcasting-corporation",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "TV", "owner": "Australian Broadcasting Corporation", "paywall": False,
    },
    # ── Public Broadcasters — SBS variants ────────────────────────────────────
    {
        "slug": "sbs-news",
        "leaning": "center", "bias_score": 0.0,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "TV", "owner": "Special Broadcasting Service", "paywall": False,
    },
    {
        "slug": "sbs-australia",
        "leaning": "center", "bias_score": 0.0,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "TV", "owner": "Special Broadcasting Service", "paywall": False,
    },
    # ── Wire Services ──────────────────────────────────────────────────────────
    {
        "slug": "reuters",
        "leaning": "center", "bias_score": 0.0,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "Wire", "owner": "Thomson Reuters", "paywall": False,
    },
    {
        "slug": "aap",
        "leaning": "center", "bias_score": 0.0,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "Wire", "owner": "AAP Media", "paywall": False,
    },
    # ── Guardian Australia — variants ─────────────────────────────────────────
    {
        "slug": "the-guardian",
        "leaning": "left", "bias_score": -1.2,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Guardian Media Group", "paywall": False,
    },
    {
        "slug": "guardian-australia",
        "leaning": "left", "bias_score": -1.2,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Guardian Media Group", "paywall": False,
    },
    {
        "slug": "guardian-au",
        "leaning": "left", "bias_score": -1.2,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Guardian Media Group", "paywall": False,
    },
    # ── Crikey / Independent ───────────────────────────────────────────────────
    {
        "slug": "crikey",
        "leaning": "left", "bias_score": -1.0,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Private Media", "paywall": True,
    },
    {
        "slug": "the-saturday-paper",
        "leaning": "left", "bias_score": -1.0,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Schwartz Media", "paywall": True,
    },
    {
        "slug": "michael-west-media",
        "leaning": "left", "bias_score": -1.3,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Michael West Media", "paywall": False,
    },
    {
        "slug": "the-conversation",
        "leaning": "center-left", "bias_score": -0.7,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "Digital", "owner": "The Conversation Media Group", "paywall": False,
    },
    # ── Nine Entertainment — SMH variants ─────────────────────────────────────
    {
        "slug": "sydney-morning-herald",
        "leaning": "center-left", "bias_score": -0.6,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Nine Entertainment", "paywall": True,
    },
    {
        "slug": "smh",
        "leaning": "center-left", "bias_score": -0.6,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Nine Entertainment", "paywall": True,
    },
    {
        "slug": "the-sydney-morning-herald",
        "leaning": "center-left", "bias_score": -0.6,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Nine Entertainment", "paywall": True,
    },
    {
        "slug": "smh-com-au",
        "leaning": "center-left", "bias_score": -0.6,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Nine Entertainment", "paywall": True,
    },
    {
        "slug": "the-age",
        "leaning": "center-left", "bias_score": -0.6,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Nine Entertainment", "paywall": True,
    },
    {
        "slug": "nine-news",
        "leaning": "center", "bias_score": 0.0,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "TV", "owner": "Nine Entertainment", "paywall": False,
    },
    {
        "slug": "brisbane-times",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Nine Entertainment", "paywall": True,
    },
    {
        "slug": "wa-today",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Nine Entertainment", "paywall": True,
    },
    # ── Seven West Media — 7NEWS variants ─────────────────────────────────────
    {
        "slug": "7news",
        "leaning": "center", "bias_score": 0.1,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "TV", "owner": "Seven West Media", "paywall": False,
    },
    {
        "slug": "seven-news",
        "leaning": "center", "bias_score": 0.1,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "TV", "owner": "Seven West Media", "paywall": False,
    },
    {
        "slug": "7news-com-au",
        "leaning": "center", "bias_score": 0.1,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "TV", "owner": "Seven West Media", "paywall": False,
    },
    {
        "slug": "7news-australia",
        "leaning": "center", "bias_score": 0.1,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "TV", "owner": "Seven West Media", "paywall": False,
    },
    {
        "slug": "the-west-australian",
        "leaning": "center-right", "bias_score": 0.6,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Seven West Media", "paywall": True,
    },
    {
        "slug": "perthnow",
        "leaning": "center-right", "bias_score": 0.5,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Seven West Media", "paywall": False,
    },
    # ── Ten / Paramount ────────────────────────────────────────────────────────
    {
        "slug": "10-news",
        "leaning": "center", "bias_score": 0.0,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "TV", "owner": "Paramount Australia", "paywall": False,
    },
    # ── News Corp Australia ────────────────────────────────────────────────────
    {
        "slug": "news-com-au",
        "leaning": "center-right", "bias_score": 0.7,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Digital", "owner": "News Corp Australia", "paywall": False,
    },
    {
        "slug": "the-australian",
        "leaning": "center-right", "bias_score": 0.9,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "News Corp Australia", "paywall": True,
    },
    {
        "slug": "herald-sun",
        "leaning": "center-right", "bias_score": 1.0,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Newspaper", "owner": "News Corp Australia", "paywall": True,
    },
    {
        "slug": "daily-telegraph",
        "leaning": "center-right", "bias_score": 1.0,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Newspaper", "owner": "News Corp Australia", "paywall": True,
    },
    {
        "slug": "the-courier-mail",
        "leaning": "center-right", "bias_score": 0.9,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Newspaper", "owner": "News Corp Australia", "paywall": True,
    },
    {
        "slug": "the-advertiser",
        "leaning": "center-right", "bias_score": 0.8,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Newspaper", "owner": "News Corp Australia", "paywall": True,
    },
    # ── Sky News ───────────────────────────────────────────────────────────────
    {
        "slug": "sky-news-australia",
        "leaning": "right", "bias_score": 1.5,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "TV", "owner": "News Corp Australia", "paywall": False,
    },
    {
        "slug": "sky-news-au",
        "leaning": "right", "bias_score": 1.5,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "TV", "owner": "News Corp Australia", "paywall": False,
    },
    {
        "slug": "daily-telegraph-sydney",
        "leaning": "center-right", "bias_score": 1.0,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Newspaper", "owner": "News Corp Australia", "paywall": True,
    },
    # ── Independent/Other ─────────────────────────────────────────────────────
    {
        "slug": "the-new-daily",
        "leaning": "center-left", "bias_score": -0.6,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Industry Super Holdings", "paywall": False,
    },
    {
        "slug": "canberra-times",
        "leaning": "center", "bias_score": -0.2,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "ACM (Australian Community Media)", "paywall": True,
    },
    {
        "slug": "the-mercury",
        "leaning": "center", "bias_score": 0.2,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "News Corp Australia", "paywall": True,
    },
    {
        "slug": "the-mandarin",
        "leaning": "center", "bias_score": 0.0,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Informa Australia", "paywall": True,
    },
    {
        "slug": "the-mandarin-public-sector-news-government-learning",
        "leaning": "center", "bias_score": 0.0,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "Informa Australia", "paywall": True,
    },
    {
        "slug": "indaily",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "InDaily (SACJ)", "paywall": False,
    },
    {
        "slug": "indaily-south-australia",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "InDaily (SACJ)", "paywall": False,
    },
    {
        "slug": "indailysa-com-au",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Digital", "owner": "InDaily (SACJ)", "paywall": False,
    },
    {
        "slug": "australian-financial-review",
        "leaning": "center-right", "bias_score": 0.7,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Nine Entertainment", "paywall": True,
    },
    {
        "slug": "afr",
        "leaning": "center-right", "bias_score": 0.7,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "Newspaper", "owner": "Nine Entertainment", "paywall": True,
    },
    {
        "slug": "the-spectator-australia",
        "leaning": "right", "bias_score": 1.4,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Magazine", "owner": "Spectator Australia Pty Ltd", "paywall": True,
    },
    # ── Spectator Australia ────────────────────────────────────────────────────
    {
        "slug": "the-spectator-australia",
        "leaning": "right", "bias_score": 1.4,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Magazine", "owner": "Spectator Australia Pty Ltd", "paywall": True,
    },
    {
        "slug": "spectator-au",
        "leaning": "right", "bias_score": 1.4,
        "factuality_rating": "Mixed", "factuality_numeric": 2,
        "media_type": "Magazine", "owner": "Spectator Australia Pty Ltd", "paywall": True,
    },
    # ── International (often in results) ──────────────────────────────────────
    {
        "slug": "bbc-news",
        "leaning": "center", "bias_score": -0.1,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "TV", "owner": "BBC", "paywall": False,
    },
    {
        "slug": "bbc",
        "leaning": "center", "bias_score": -0.1,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "TV", "owner": "BBC", "paywall": False,
    },
    {
        "slug": "al-jazeera-english",
        "leaning": "center-left", "bias_score": -0.5,
        "factuality_rating": "High", "factuality_numeric": 3,
        "media_type": "TV", "owner": "Al Jazeera Media Network", "paywall": False,
    },
    {
        "slug": "bloomberg",
        "leaning": "center", "bias_score": 0.1,
        "factuality_rating": "Very High", "factuality_numeric": 4,
        "media_type": "Digital", "owner": "Bloomberg LP", "paywall": True,
    },
]


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY in .env")

    sb = create_client(url, key)

    updated = 0
    skipped = 0

    for meta in SOURCES:
        slug = meta["slug"]
        # Find the source by slug
        resp = sb.table("news_sources").select("id, slug").eq("slug", slug).limit(1).execute()
        if not resp.data:
            print(f"  SKIP (not found): {slug}")
            skipped += 1
            continue

        source_id = resp.data[0]["id"]
        patch = {k: v for k, v in meta.items() if k != "slug"}
        sb.table("news_sources").update(patch).eq("id", source_id).execute()
        print(f"  OK: {slug} → {meta['leaning']} | {meta['factuality_rating']} | {meta.get('owner', '')}")
        updated += 1

    print(f"\nDone. {updated} updated, {skipped} not found.")


if __name__ == "__main__":
    main()
