#!/usr/bin/env python3
"""
ingest_nsw_parliament.py — Ingest NSW Parliament member and bill data
into Supabase state_members and state_bills tables.

Data sources:
  Members: parliament.nsw.gov.au/memberlistservice.aspx (CSV, live)
           parliament.nsw.gov.au/members/Pages/all-members.aspx (photos)
  Bills:   parliament.nsw.gov.au/bills/Pages/current-bills.aspx (HTML table)

Usage:
  python ingest_nsw_parliament.py [--test] [--members-only] [--bills-only]
"""

import argparse
import csv
import io
import logging
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

NSW_MEMBER_CSV = "https://www.parliament.nsw.gov.au/_layouts/15/NSWParliament/memberlistservice.aspx?members={house}&format=Excel"
NSW_MEMBERS_PAGE = "https://www.parliament.nsw.gov.au/members/Pages/all-members.aspx"
NSW_BILLS_PAGE = "https://www.parliament.nsw.gov.au/bills/Pages/current-bills.aspx"
NSW_BILL_BASE = "https://www.parliament.nsw.gov.au"

CHAMBER_MAP = {
    "LA": "Legislative Assembly",
    "LC": "Legislative Council",
}


def fetch(session: requests.Session, url: str, **kwargs) -> requests.Response:
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=30, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as e:
            if attempt == 2:
                raise
            log.warning("  Attempt %d failed: %s — retrying…", attempt + 1, e)
            time.sleep(2)


def scrape_photo_map(session: requests.Session) -> dict[str, str]:
    """
    Scrape all-members page to build surname → photo_url mapping.
    Photos are at /member/files/{id}/thumb.jpg
    The hidden columns after the photo td contain: chamber, surname, party, gender
    """
    log.info("Scraping member photos from all-members page…")
    resp = fetch(session, NSW_MEMBERS_PAGE)
    html = resp.text

    # Pattern: photo img with files/{id}, then hidden tds: chamber, surname, party...
    pattern = (
        r'<img[^>]+member/files/(\d+)/[^"]+"\s*[^>]*/>'
        r'\s*</td>\s*<td[^>]*>\s*([^<\s]+)\s*</td>'   # chamber
        r'\s*<td[^>]*>\s*([^<\s]+)\s*</td>'            # surname
    )
    matches = re.findall(pattern, html, re.DOTALL)
    log.info("  Found %d photo entries", len(matches))

    photo_map: dict[str, str] = {}
    for photo_id, _chamber, surname in matches:
        clean = surname.strip()
        if clean:
            photo_url = f"https://www.parliament.nsw.gov.au/member/files/{photo_id}/thumb.jpg"
            photo_map[clean.lower()] = photo_url

    return photo_map


def parse_members_csv(session: requests.Session, house: str, photo_map: dict[str, str]) -> list[dict]:
    """Download and parse the member CSV for LA or LC."""
    log.info("Downloading %s member CSV…", house)
    resp = fetch(session, NSW_MEMBER_CSV.format(house=house))

    rows = []
    reader = csv.DictReader(io.StringIO(resp.text))
    for row in reader:
        surname = (row.get("SURNAME") or "").strip()
        first_name = (row.get("NAME") or "").strip()
        full_name = f"{first_name} {surname}".strip() if first_name else surname

        party = (row.get("PARTY") or "").strip()
        electorate = (row.get("ELECTORATE") or "").strip()
        ministry = (row.get("MINISTRY") or "").strip()
        office_holder = (row.get("OFFICE HOLDER") or "").strip()

        role = ministry or office_holder or None

        email = (row.get("CONTACT ADDRESS EMAIL") or "").strip() or None
        phone = (row.get("CONTACT ADDRESS PHONE") or "").strip() or None
        website = (row.get("CONTACT ADDRESS WEBSITE") or "").strip() or None

        photo_url = photo_map.get(surname.lower())

        rows.append({
            "name": full_name,
            "first_name": first_name or None,
            "last_name": surname or None,
            "party": party or None,
            "electorate": electorate or None,
            "chamber": CHAMBER_MAP.get(house, house),
            "state": "NSW",
            "photo_url": photo_url,
            "role": role,
            "email": email,
            "phone": phone,
            "website": website,
        })

    log.info("  Parsed %d %s members", len(rows), house)
    return rows


def parse_bills(session: requests.Session) -> list[dict]:
    """Scrape the current-bills page for NSW bill data."""
    log.info("Scraping NSW bills from current-bills page…")
    resp = fetch(session, NSW_BILLS_PAGE)
    html = resp.text

    # Find all rows that contain a bill details link
    rows_html = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)
    bills = []

    for row_html in rows_html:
        link_m = re.search(
            r'href="(/bills/Pages/bill-details\.aspx\?pk=(\d+))"[^>]*>([^<]+)</a>',
            row_html
        )
        if not link_m:
            continue

        url_path, pk, title = link_m.group(1), link_m.group(2), link_m.group(3).strip()
        source_url = NSW_BILL_BASE + url_path

        # Extract td cell values
        tds = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
        td_texts = [re.sub(r'<[^>]+>', '', t).strip() for t in tds]

        # Structure: [title_cell, origin_house, current_house, status_text, ...]
        origin_chamber = CHAMBER_MAP.get(td_texts[1].strip(), td_texts[1].strip()) if len(td_texts) > 1 else None
        status_raw = td_texts[3].strip() if len(td_texts) > 3 else ""

        # Clean status: strip date and extra text
        # Format: "2R, Debate adjourned 5 calendar days, 02/08/2023\r\n\r\n Private Member's..."
        status_lines = [l.strip() for l in status_raw.split('\n') if l.strip()]
        status = status_lines[0] if status_lines else None

        # Extract date from status if present (dd/mm/yyyy)
        date_m = re.search(r'(\d{2}/\d{2}/\d{4})', status_raw)
        introduced_date = None
        if date_m:
            d, m, y = date_m.group(1).split('/')
            introduced_date = f"{y}-{m}-{d}"

        # Determine bill type from status text
        summary = None
        if "Private Member" in status_raw:
            summary = "Private Member's Bill"
        elif "Government" in status_raw:
            summary = "Government Bill"

        bills.append({
            "title": title,
            "status": status,
            "introduced_date": introduced_date,
            "chamber": origin_chamber,
            "state": "NSW",
            "summary": summary,
            "source_url": source_url,
            "external_id": pk,
        })

    log.info("  Parsed %d bills", len(bills))
    return bills


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest NSW Parliament data")
    parser.add_argument("--test", action="store_true", help="Only insert first 5 records of each type")
    parser.add_argument("--members-only", action="store_true", help="Only ingest members")
    parser.add_argument("--bills-only", action="store_true", help="Only ingest bills")
    args = parser.parse_args()

    from supabase import create_client
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")
        sys.exit(1)
    db = create_client(url, key)

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; Verity/1.0; research)",
        "Accept": "text/html,application/xhtml+xml,*/*",
    })

    # ── Members ──────────────────────────────────────────────────────────────
    if not args.bills_only:
        photo_map = scrape_photo_map(session)

        la_members = parse_members_csv(session, "LA", photo_map)
        lc_members = parse_members_csv(session, "LC", photo_map)
        all_members = la_members + lc_members

        if args.test:
            all_members = all_members[:5]

        log.info("Truncating NSW state_members…")
        db.table("state_members").delete().eq("state", "NSW").execute()

        log.info("Inserting %d NSW members…", len(all_members))
        BATCH = 100
        inserted_members = 0
        for i in range(0, len(all_members), BATCH):
            batch = all_members[i:i + BATCH]
            try:
                db.table("state_members").insert(batch).execute()
                inserted_members += len(batch)
            except Exception as e:
                log.error("Insert error at batch %d: %s", i, e)

        photos_matched = sum(1 for m in all_members if m.get("photo_url"))
        log.info("Members: %d inserted, %d with photos", inserted_members, photos_matched)

    # ── Bills ─────────────────────────────────────────────────────────────────
    if not args.members_only:
        bills = parse_bills(session)

        if args.test:
            bills = bills[:5]

        log.info("Truncating NSW state_bills…")
        db.table("state_bills").delete().eq("state", "NSW").execute()

        log.info("Inserting %d NSW bills…", len(bills))
        BATCH = 200
        inserted_bills = 0
        for i in range(0, len(bills), BATCH):
            batch = bills[i:i + BATCH]
            try:
                db.table("state_bills").insert(batch).execute()
                inserted_bills += len(batch)
            except Exception as e:
                log.error("Bill insert error at batch %d: %s", i, e)

        log.info("Bills: %d inserted", inserted_bills)

    log.info("Done.")


if __name__ == "__main__":
    main()
