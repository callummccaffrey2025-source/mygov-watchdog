#!/usr/bin/env python3
"""
fix_senator_photos.py — Scrape APH senator search page to get MPID + photo URLs
for all 76 senators, then update the members table.

Photo URL pattern: https://www.aph.gov.au/api/parliamentarian/{MPID}/image
Senator search: https://www.aph.gov.au/Senators_and_Members/Parliamentarian_Search_Results?q=&sen=1&par=-1&gen=0&ps=96

Also backfills aph_id where missing.
"""

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

SEARCH_URL = (
    "https://www.aph.gov.au/Senators_and_Members/"
    "Parliamentarian_Search_Results?q=&sen=1&par=-1&gen=0&ps=96"
)
HEADERS = {"User-Agent": "Verity-App/1.0 (civic data; contact@verity.au)"}
APH_BASE = "https://www.aph.gov.au"


def scrape_senator_photos() -> list[dict]:
    """Scrape the APH senator search page to get name, MPID, and photo URL."""
    resp = requests.get(SEARCH_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    senators = []
    for card in soup.select(".search-filter-results-snm .row.border-bottom"):
        name_el = card.select_one("h4.title a")
        if not name_el:
            continue

        full_name = name_el.get_text(strip=True)
        # Strip title prefixes and post-nominals
        clean = re.sub(
            r"^(Senator\s+)?(the\s+)?(Hon\.?\s+)?(Dr\.?\s+)?",
            "", full_name, flags=re.IGNORECASE
        ).strip()
        # Remove post-nominals like CSC, AM, AO, OBE etc.
        clean = re.sub(r"\s+(?:CSC|AM|AO|AC|OBE|MP|QC|SC|KC)$", "", clean).strip()
        parts = clean.split()
        first = parts[0] if parts else ""
        last = " ".join(parts[1:]) if len(parts) > 1 else ""

        # Extract MPID from photo img src: /api/parliamentarian/{MPID}/image
        photo_el = card.select_one("img[src*='/api/parliamentarian/']")
        mpid = None
        photo_url = None
        if photo_el:
            src = photo_el.get("src", "")
            match = re.search(r"/api/parliamentarian/([^/]+)/image", src)
            if match:
                mpid = match.group(1)
                photo_url = f"{APH_BASE}/api/parliamentarian/{mpid}/image"

        # Also try the link href for MPID
        if not mpid and name_el.get("href"):
            href = name_el["href"]
            match = re.search(r"MPID=(\w+)", href)
            if match:
                mpid = match.group(1)
                photo_url = f"{APH_BASE}/api/parliamentarian/{mpid}/image"

        if not photo_url:
            # Fallback: any img src
            img = card.select_one("img[src]")
            if img:
                src = img["src"]
                photo_url = src if src.startswith("http") else APH_BASE + src

        senators.append({
            "first_name": first,
            "last_name": last,
            "full_name": full_name,
            "mpid": mpid,
            "photo_url": photo_url,
        })

    log.info("Scraped %d senators from APH.", len(senators))
    return senators


def match_and_update(db, scraped: list[dict], dry_run: bool) -> None:
    """Match scraped senators to members table and update photo_url + aph_id."""
    # Load all senate members
    result = (
        db.table("members")
        .select("id, first_name, last_name, photo_url, aph_id")
        .eq("chamber", "senate")
        .eq("is_active", True)
        .execute()
    )
    db_senators = {f"{r['first_name'].lower()}|{r['last_name'].lower()}": r for r in result.data}

    updated = 0
    missed = []

    for s in scraped:
        first = s["first_name"].lower()
        last = s["last_name"].lower()

        # Try exact match
        key = f"{first}|{last}"
        member = db_senators.get(key)

        # Try partial match on last name
        if not member:
            for db_key, db_row in db_senators.items():
                db_last = db_key.split("|")[1]
                if db_last == last or last.endswith(db_last) or db_last.endswith(last):
                    db_first = db_key.split("|")[0]
                    if first[:3] == db_first[:3]:
                        member = db_row
                        break

        if not member:
            missed.append(s["full_name"])
            continue

        updates = {}
        if s["photo_url"] and not member.get("photo_url"):
            updates["photo_url"] = s["photo_url"]
        if s["mpid"] and not member.get("aph_id"):
            updates["aph_id"] = s["mpid"]

        if updates:
            if dry_run:
                log.info("  [DRY] %s %s → %s", member["first_name"], member["last_name"], updates)
            else:
                db.table("members").update(updates).eq("id", member["id"]).execute()
            updated += 1

    log.info("Updated %d senators. Missed %d: %s", updated, len(missed), missed[:10])


def main() -> None:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)
    dry_run = "--dry-run" in sys.argv

    scraped = scrape_senator_photos()
    if not scraped:
        log.error("No senators scraped. Exiting.")
        sys.exit(1)

    match_and_update(db, scraped, dry_run)


if __name__ == "__main__":
    main()
