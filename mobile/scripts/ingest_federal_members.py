#!/usr/bin/env python3
"""
ingest_federal_members.py — Pull current federal MPs and Senators from APH.

Sources (tried in order):
  1. APH JSON API  https://www.aph.gov.au/api/parliamentarian/search
  2. HTML scrape   https://www.aph.gov.au/Senators_and_Members/Parliamentarian_Search_Results

Maps to the `members` table (not the older `mps` table).
Idempotent: upserts on (first_name, last_name, chamber).
"""

import json
import logging
import os
import re
import sys
import time
from typing import Any

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

APH_API_HOUSE = (
    "https://www.aph.gov.au/api/parliamentarian/search"
    "?query=&take={take}&skip={skip}&house=0"
)
APH_API_SENATE = (
    "https://www.aph.gov.au/api/parliamentarian/search"
    "?query=&take={take}&skip={skip}&house=1"
)
APH_SCRAPE_HOUSE = (
    "https://www.aph.gov.au/Senators_and_Members/"
    "Parliamentarian_Search_Results?q=&mem=1&par=-1&gen=0&ps=96&st=1"
)
APH_SCRAPE_SENATE = (
    "https://www.aph.gov.au/Senators_and_Members/"
    "Parliamentarian_Search_Results?q=&mem=1&par=-1&gen=0&ps=96&st=2"
)
HEADERS = {"User-Agent": "Verity-App/1.0 (civic data; contact@verity.au)"}
PAGE_SIZE = 200


def _fetch_house_type(url_template: str, label: str) -> list[dict]:
    """Paginate one APH API URL template. Returns [] on failure."""
    members = []
    skip = 0
    while True:
        url = url_template.format(take=PAGE_SIZE, skip=skip)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            log.warning("APH API (%s) failed at skip=%d: %s", label, skip, exc)
            return []
        items = data if isinstance(data, list) else data.get("parliamentarians", data.get("items", []))
        if not items:
            break
        members.extend(items)
        if len(items) < PAGE_SIZE:
            break
        skip += PAGE_SIZE
        time.sleep(0.5)
    log.info("API (%s) returned %d members.", label, len(members))
    return members


def fetch_via_api() -> list[dict]:
    """Try the APH JSON API for both House and Senate. Returns combined list or []."""
    house = _fetch_house_type(APH_API_HOUSE, "House")
    senate = _fetch_house_type(APH_API_SENATE, "Senate")
    if not house and not senate:
        return []
    combined = house + senate
    log.info("API returned %d total members (House=%d, Senate=%d).", len(combined), len(house), len(senate))
    return combined


def _parse_members_page(soup: BeautifulSoup) -> list[dict]:
    """Parse member cards from a single APH search results page."""
    members = []
    for card in soup.select(".search-filter-results-snm .row.border-bottom"):
        name_el = card.select_one("h4.title a")
        if not name_el:
            continue
        full_name = name_el.get_text(strip=True)

        # Chamber from title prefix
        chamber = "senate" if full_name.lower().startswith("senator") else "house"

        # Strip honorific to get first/last name
        clean = re.sub(r"^(Senator|Mr|Mrs|Ms|Dr|Prof\.?)\s+", "", full_name, flags=re.IGNORECASE)
        clean = re.sub(r"\s+(MP|Senator)$", "", clean, flags=re.IGNORECASE).strip()
        parts = clean.split()
        first = parts[0] if parts else ""
        last = " ".join(parts[1:]) if len(parts) > 1 else ""

        # Parse dl key/value pairs
        dl = card.select_one("dl")
        party_name = ""
        electorate_name = ""
        email = None
        if dl:
            dts = dl.find_all("dt")
            for dt in dts:
                label = dt.get_text(strip=True).lower()
                dd = dt.find_next_sibling("dd")
                if not dd:
                    continue
                val = dd.get_text(strip=True)
                if label == "party":
                    party_name = val
                elif label == "for":
                    # "Calwell, Victoria" → just the electorate part
                    electorate_name = val.split(",")[0].strip()
            # Email from mailto link
            mail_a = dl.select_one("a.mail[href^='mailto:']")
            if mail_a:
                email = mail_a["href"].replace("mailto:", "").strip()

        photo_el = card.select_one("img[src]")
        photo_url = None
        if photo_el:
            src = photo_el["src"]
            photo_url = src if src.startswith("http") else "https://www.aph.gov.au" + src

        members.append({
            "full_name": full_name,
            "first_name": first,
            "last_name": last,
            "party_name": party_name,
            "electorate_name": electorate_name,
            "chamber": chamber,
            "photo_url": photo_url,
            "email": email,
        })
    return members


def fetch_via_scrape() -> list[dict]:
    """Fallback: scrape the APH members search page (paginated)."""
    log.info("Falling back to HTML scrape...")
    members = []
    page = 1
    while True:
        url = APH_SCRAPE_HOUSE + (f"&page={page}" if page > 1 else "")
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
        except Exception as exc:
            log.error("HTML scrape failed on page %d: %s", page, exc)
            break

        soup = BeautifulSoup(resp.text, "lxml")
        page_members = _parse_members_page(soup)
        if not page_members:
            break
        members.extend(page_members)
        log.info("  Page %d: %d members (total so far: %d)", page, len(page_members), len(members))

        next_link = soup.select_one('.results-pagination a:-soup-contains("Next")')
        if not next_link:
            break
        page += 1
        time.sleep(0.5)

    log.info("Scraped %d members.", len(members))
    return members


def normalise_api_member(raw: dict) -> dict:
    """Normalise a raw APH API member dict to our schema shape."""
    full_name = raw.get("fullName", raw.get("name", ""))
    parts = full_name.split()
    first = parts[0] if parts else raw.get("firstName", "")
    last = " ".join(parts[1:]) if len(parts) > 1 else raw.get("lastName", "")

    chamber_raw = raw.get("house", raw.get("chamber", "")).lower()
    chamber = "senate" if "senate" in chamber_raw else "house"

    return {
        "full_name": full_name,
        "first_name": first,
        "last_name": last,
        "party_name": raw.get("party", raw.get("partyName", "")),
        "electorate_name": raw.get("electorate", raw.get("electorateName", "")),
        "chamber": chamber,
        "photo_url": raw.get("thumbnailUrl", raw.get("photoUrl", None)),
        "email": raw.get("email", None),
        "phone": raw.get("phone", None),
    }


def resolve_party_id(db: Any, party_name: str, cache: dict) -> str | None:
    if not party_name:
        return None
    if party_name in cache:
        return cache[party_name]

    # Fuzzy match: try contains
    result = db.table("parties").select("id, name, short_name").execute()
    for row in result.data:
        for field in (row["name"], row.get("short_name", "")):
            if field and (
                field.lower() in party_name.lower()
                or party_name.lower() in field.lower()
            ):
                cache[party_name] = row["id"]
                return row["id"]

    log.warning("No party match for %r", party_name)
    cache[party_name] = None
    return None


def resolve_electorate_id(db: Any, name: str, cache: dict) -> str | None:
    if not name:
        return None
    if name in cache:
        return cache[name]

    result = (
        db.table("electorates")
        .select("id")
        .ilike("name", name)
        .execute()
    )
    if result.data:
        cache[name] = result.data[0]["id"]
        return result.data[0]["id"]

    log.debug("No electorate match for %r", name)
    cache[name] = None
    return None


def main() -> None:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)

    # Try API first, fall back to scrape
    raw_members = fetch_via_api()
    if raw_members:
        members_raw = [normalise_api_member(m) for m in raw_members]
    else:
        members_raw = fetch_via_scrape()

    if not members_raw:
        log.error("No members fetched. Exiting.")
        sys.exit(1)

    party_cache: dict = {}
    electorate_cache: dict = {}
    rows = []

    for m in members_raw:
        rows.append({
            "first_name": m.get("first_name", ""),
            "last_name": m.get("last_name", ""),
            "party_id": resolve_party_id(db, m.get("party_name", ""), party_cache),
            "electorate_id": resolve_electorate_id(db, m.get("electorate_name", ""), electorate_cache),
            "chamber": m["chamber"],
            "level": "federal",
            "photo_url": m.get("photo_url"),
            "email": m.get("email"),
            "phone": m.get("phone"),
            "is_active": True,
        })

    BATCH = 50
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        result = (
            db.table("members")
            .upsert(batch, on_conflict="first_name,last_name,chamber")
            .execute()
        )
        total += len(result.data)
        log.info("Upserted batch %d/%d (%d rows)", i // BATCH + 1, -(-len(rows) // BATCH), len(result.data))
        time.sleep(0.2)

    log.info("Done. %d members upserted.", total)


if __name__ == "__main__":
    main()
