#!/usr/bin/env python3
"""
ingest_vic_parliament.py — Ingest Victorian Parliament members into Supabase.

Data source: parliament.vic.gov.au (HTML scraping)
  Members: https://www.parliament.vic.gov.au/members

Usage:
  python scripts/ingest_vic_parliament.py [--test]
"""

import argparse
import logging
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

VIC_MEMBERS_LA = "https://www.parliament.vic.gov.au/members/legislative-assembly"
VIC_MEMBERS_LC = "https://www.parliament.vic.gov.au/members/legislative-council"
HEADERS = {"User-Agent": "Verity/1.0 (civic data; contact@verity.au)"}


def scrape_members(url: str, chamber: str) -> list[dict]:
    """Scrape member list from a Victorian Parliament chamber page."""
    log.info(f"Fetching {chamber} members from {url}")
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    members = []
    # Look for member cards/links
    for card in soup.select("a.member-card, .member-listing a, .views-row a[href*='/member/']"):
        href = card.get("href", "")
        name = card.get_text(strip=True)
        if not name or len(name) < 3:
            continue

        # Parse name
        parts = name.split(",")
        if len(parts) >= 2:
            last_name = parts[0].strip()
            first_name = parts[1].strip().split()[0] if parts[1].strip() else ""
        else:
            name_parts = name.split()
            first_name = name_parts[0] if name_parts else ""
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        # Extract party and electorate from card text or subtext
        party = ""
        electorate = ""
        subtitle = card.find("span", class_=re.compile("party|subtitle|meta"))
        if subtitle:
            sub_text = subtitle.get_text(strip=True)
            if "—" in sub_text:
                parts = sub_text.split("—")
                party = parts[0].strip()
                electorate = parts[1].strip() if len(parts) > 1 else ""
            else:
                party = sub_text

        # Photo URL
        img = card.find("img")
        photo_url = img["src"] if img and img.get("src") else None
        if photo_url and not photo_url.startswith("http"):
            photo_url = f"https://www.parliament.vic.gov.au{photo_url}"

        source_url = href if href.startswith("http") else f"https://www.parliament.vic.gov.au{href}"

        members.append({
            "name": f"{first_name} {last_name}".strip(),
            "first_name": first_name,
            "last_name": last_name,
            "party": party,
            "electorate": electorate,
            "chamber": chamber,
            "state": "VIC",
            "photo_url": photo_url,
            "website": source_url,
        })

    log.info(f"  Found {len(members)} {chamber} members")
    return members


def upsert_members(sb, members: list[dict], test: bool = False):
    """Upsert members into state_members table."""
    if test:
        for m in members[:5]:
            log.info(f"  [TEST] {m['name']} ({m['party']}) — {m['electorate']}")
        return

    inserted = 0
    updated = 0
    for m in members:
        # Check if exists
        existing = sb.table("state_members").select("id").eq("name", m["name"]).eq("state", "VIC").execute()
        if existing.data:
            sb.table("state_members").update(m).eq("id", existing.data[0]["id"]).execute()
            updated += 1
        else:
            sb.table("state_members").insert(m).execute()
            inserted += 1

    log.info(f"  Inserted {inserted}, updated {updated}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Dry run — don't write to DB")
    args = parser.parse_args()

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    sb = create_client(url, key)

    all_members = []
    for page_url, chamber in [(VIC_MEMBERS_LA, "Legislative Assembly"), (VIC_MEMBERS_LC, "Legislative Council")]:
        try:
            members = scrape_members(page_url, chamber)
            all_members.extend(members)
            time.sleep(2)
        except Exception as e:
            log.error(f"Failed to scrape {chamber}: {e}")

    if all_members:
        upsert_members(sb, all_members, test=args.test)
    else:
        log.warning("No members found — site structure may have changed")

    log.info(f"Done. Total VIC members: {len(all_members)}")


if __name__ == "__main__":
    main()
