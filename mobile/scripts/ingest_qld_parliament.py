#!/usr/bin/env python3
"""
ingest_qld_parliament.py — Ingest Queensland Parliament members into Supabase.

Data source: parliament.qld.gov.au
  Members: https://www.parliament.qld.gov.au/Members/Current-Members/List-of-Current-Members

Usage:
  python scripts/ingest_qld_parliament.py [--test]
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

QLD_MEMBERS_URL = "https://www.parliament.qld.gov.au/Members/Current-Members/List-of-Current-Members"
HEADERS = {"User-Agent": "Verity/1.0 (civic data; contact@verity.au)"}


def scrape_members() -> list[dict]:
    """Scrape member list from Queensland Parliament website."""
    log.info(f"Fetching QLD members from {QLD_MEMBERS_URL}")
    resp = requests.get(QLD_MEMBERS_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    members = []

    # QLD parliament lists members in a table or card layout
    for row in soup.select("table tbody tr, .member-list-item, .views-row"):
        cells = row.find_all("td")
        if len(cells) >= 3:
            name = cells[0].get_text(strip=True)
            electorate = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            party = cells[2].get_text(strip=True) if len(cells) > 2 else ""
        else:
            # Try card layout
            name_el = row.find("a") or row.find("h3") or row.find("strong")
            if not name_el:
                continue
            name = name_el.get_text(strip=True)
            electorate = ""
            party = ""
            meta = row.find("span", class_=re.compile("electorate|district"))
            if meta:
                electorate = meta.get_text(strip=True)
            party_el = row.find("span", class_=re.compile("party"))
            if party_el:
                party = party_el.get_text(strip=True)

        if not name or len(name) < 3:
            continue

        # Parse name
        parts = name.replace(",", " ").split()
        # Remove titles
        titles = {"Hon", "Hon.", "Dr", "Mr", "Mrs", "Ms", "Prof"}
        parts = [p for p in parts if p not in titles]
        first_name = parts[0] if parts else ""
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

        # Photo URL
        img = row.find("img")
        photo_url = img["src"] if img and img.get("src") else None
        if photo_url and not photo_url.startswith("http"):
            photo_url = f"https://www.parliament.qld.gov.au{photo_url}"

        # Profile link
        link = row.find("a", href=True)
        website = None
        if link:
            href = link["href"]
            website = href if href.startswith("http") else f"https://www.parliament.qld.gov.au{href}"

        members.append({
            "name": f"{first_name} {last_name}".strip(),
            "first_name": first_name,
            "last_name": last_name,
            "party": party,
            "electorate": electorate,
            "chamber": "Legislative Assembly",
            "state": "QLD",
            "photo_url": photo_url,
            "website": website,
        })

    log.info(f"  Found {len(members)} QLD members")
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
        existing = sb.table("state_members").select("id").eq("name", m["name"]).eq("state", "QLD").execute()
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

    try:
        members = scrape_members()
        if members:
            upsert_members(sb, members, test=args.test)
        else:
            log.warning("No members found — site structure may have changed")
    except Exception as e:
        log.error(f"Failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
