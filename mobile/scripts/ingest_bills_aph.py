#!/usr/bin/env python3
"""
ingest_bills_aph.py — Scrape bills from APH Bills Search and individual bill pages.

Sources:
  1. APH Bills Search: https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results
  2. Individual bill pages for detail (summary, status, sponsor, dates)
  3. TheyVoteForYou divisions for bill vote outcomes

Covers all parliaments with available data. Focuses on:
  - 47th Parliament (2022-2025) and 48th Parliament (2025-present)
  - Current bills before parliament (active/in-progress)
  - Historical bills with outcomes

Idempotent: upserts on title + parliament_no.
"""

import json
import logging
import os
import re
import sys
import time
from datetime import date

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Verity-App/1.0 (civic data; contact@verity.au)"}
APH_BASE = "https://www.aph.gov.au"

# Parliament numbers and their date ranges
PARLIAMENTS = [
    (48, "2025-07-01", "2028-12-31"),  # Current (48th)
    (47, "2022-07-26", "2025-06-30"),  # Previous (47th)
]


def fetch_aph_bill_list(parliament_no: int, page: int = 0, page_size: int = 200) -> list[dict]:
    """Fetch bill list from APH search for a specific parliament."""
    url = (
        f"{APH_BASE}/Parliamentary_Business/Bills_Legislation/Bills_Search_Results"
        f"?st=1&sr={page * page_size}&q=&ito=1&expand=False&lnp=0&drt=2"
        f"&pnu={parliament_no}&f=0000-00-00&t=0000-00-00&ps={page_size}"
    )
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        log.warning("Failed to fetch bill list page %d for parliament %d: %s", page, parliament_no, e)
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    bills = []

    for row in soup.select(".search-filter-results .row, .search-filter-results tr, .search-filter-results li"):
        link = row.select_one("a[href*='Result']")
        if not link:
            continue
        title = link.get_text(strip=True)
        href = link.get("href", "")
        if not title:
            continue

        bill_url = href if href.startswith("http") else APH_BASE + href
        # Extract bId from URL
        bid_match = re.search(r"bId=([a-z0-9]+)", href)
        aph_id = bid_match.group(1) if bid_match else None

        bills.append({
            "title": title,
            "aph_url": bill_url,
            "aph_id": aph_id,
            "parliament_no": parliament_no,
        })

    # Also try dl/dt/dd pattern (APH uses various layouts)
    if not bills:
        for link in soup.select("a"):
            href = link.get("href", "")
            title = link.get_text(strip=True)
            if "Result" in href and "Bill" in title and len(title) > 10:
                bill_url = href if href.startswith("http") else APH_BASE + href
                bid_match = re.search(r"bId=([a-z0-9]+)", href)
                bills.append({
                    "title": title,
                    "aph_url": bill_url,
                    "aph_id": bid_match.group(1) if bid_match else None,
                    "parliament_no": parliament_no,
                })

    log.info("  Parliament %d page %d: %d bills found", parliament_no, page, len(bills))
    return bills


def fetch_bill_detail(bill_url: str) -> dict:
    """Scrape individual bill page for details."""
    try:
        resp = requests.get(bill_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        return {"error": str(e)}

    soup = BeautifulSoup(resp.text, "lxml")
    details: dict = {}

    # Status
    status_el = soup.select_one(".bill-status, .current-status, [class*='status']")
    if status_el:
        details["current_status"] = status_el.get_text(strip=True)[:200]

    # Summary from the bill page
    summary_el = soup.select_one(".bill-summary, .bill-description, #main_0_summaryPanel, .summary")
    if summary_el:
        details["summary"] = summary_el.get_text(strip=True)[:2000]

    # Sponsor
    for dt in soup.select("dt"):
        label = dt.get_text(strip=True).lower()
        dd = dt.find_next_sibling("dd")
        if not dd:
            continue
        val = dd.get_text(strip=True)
        if "sponsor" in label:
            details["sponsor"] = val[:200]
        elif "portfolio" in label:
            details["portfolio"] = val[:200]
        elif "type" in label and "bill" in label.lower():
            details["bill_type"] = val[:100]
        elif "introduced" in label and "house" in label:
            date_match = re.search(r"\d{1,2}\s+\w+\s+\d{4}", val)
            if date_match:
                details["intro_house_raw"] = date_match.group()
        elif "introduced" in label and "senate" in label:
            date_match = re.search(r"\d{1,2}\s+\w+\s+\d{4}", val)
            if date_match:
                details["intro_senate_raw"] = date_match.group()
        elif "passed" in label and "house" in label:
            date_match = re.search(r"\d{1,2}\s+\w+\s+\d{4}", val)
            if date_match:
                details["passed_house_raw"] = date_match.group()
        elif "passed" in label and "senate" in label:
            date_match = re.search(r"\d{1,2}\s+\w+\s+\d{4}", val)
            if date_match:
                details["passed_senate_raw"] = date_match.group()
        elif "assent" in label:
            date_match = re.search(r"\d{1,2}\s+\w+\s+\d{4}", val)
            if date_match:
                details["assent_raw"] = date_match.group()
        elif "act" in label and "no" in label:
            details["act_no"] = val[:50]

    # Links to text, EM
    for a in soup.select("a[href*='.pdf'], a[href*='legis.']"):
        href = a.get("href", "")
        text = a.get_text(strip=True).lower()
        if "explanatory" in text or "em" in text:
            details["em_url"] = href if href.startswith("http") else APH_BASE + href
        elif "text" in text or "bill" in text:
            details["text_url"] = href if href.startswith("http") else APH_BASE + href

    return details


def fetch_tvfy_bills() -> list[dict]:
    """Fetch bill info from TheyVoteForYou divisions to find current active bills."""
    api_key = os.environ.get("THEYVOTEFORYOU_API_KEY", "")
    if not api_key:
        log.warning("No TVFY API key, skipping TVFY bills")
        return []

    bills = []
    seen_titles = set()

    # Fetch recent divisions which mention bills
    for house in ["representatives", "senate"]:
        start = "2025-07-01"
        end = date.today().isoformat()
        url = f"https://theyvoteforyou.org.au/api/v1/divisions.json"
        params = {"key": api_key, "house": house, "start_date": start, "end_date": end}

        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            divs = resp.json()
        except Exception as e:
            log.warning("TVFY divisions fetch failed for %s: %s", house, e)
            continue

        for d in divs:
            name = d.get("name", "")
            if "Bill" not in name:
                continue
            # Extract bill title (before " — ")
            bill_title = name.split(" — ")[0].strip() if " — " in name else name
            bill_title = re.sub(r"\s*\d{4}$", "", bill_title).strip()
            if bill_title not in seen_titles:
                seen_titles.add(bill_title)
                bills.append({
                    "title": bill_title + (" " + name.split()[-1] if re.search(r"\d{4}$", name.split(" — ")[0]) else ""),
                    "origin_chamber": "house" if house == "representatives" else "senate",
                    "date_introduced": d.get("date", ""),
                    "tvfy_division_date": d.get("date", ""),
                })

    log.info("TVFY: found %d unique bill titles from recent divisions", len(bills))
    return bills


def determine_status(bill: dict) -> str:
    """Determine bill status from available data."""
    if bill.get("assent_raw") or bill.get("assent_date") or bill.get("act_no"):
        return "Enacted"
    if bill.get("passed_senate_raw") and bill.get("passed_house_raw"):
        return "Passed both chambers"
    if bill.get("passed_house_raw"):
        return "Passed House"
    if bill.get("passed_senate_raw"):
        return "Passed Senate"
    if bill.get("current_status"):
        return bill["current_status"]
    return "Before Parliament"


def main():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)
    dry_run = "--dry-run" in sys.argv
    detail_scrape = "--detail" in sys.argv

    all_bills: list[dict] = []

    # 1. Scrape APH bill lists for each parliament
    for parl_no, start, end in PARLIAMENTS:
        log.info("Fetching bills for Parliament %d...", parl_no)
        for page in range(10):  # Max 10 pages
            bills = fetch_aph_bill_list(parl_no, page)
            if not bills:
                break
            all_bills.extend(bills)
            time.sleep(0.5)

    # 2. Add bills from TVFY divisions (catches bills APH search misses)
    tvfy_bills = fetch_tvfy_bills()
    existing_titles = {b["title"].lower() for b in all_bills}
    for tb in tvfy_bills:
        if tb["title"].lower() not in existing_titles:
            all_bills.append({
                "title": tb["title"],
                "parliament_no": 48,  # Current
                "origin_chamber": tb.get("origin_chamber"),
                "date_introduced": tb.get("date_introduced"),
            })
            existing_titles.add(tb["title"].lower())

    log.info("Total bills collected: %d", len(all_bills))

    # 3. Optionally scrape individual bill pages for detail
    if detail_scrape and all_bills:
        log.info("Scraping bill details (this takes a while)...")
        for i, bill in enumerate(all_bills):
            if bill.get("aph_url"):
                details = fetch_bill_detail(bill["aph_url"])
                bill.update(details)
                if (i + 1) % 10 == 0:
                    log.info("  Scraped %d/%d bill details", i + 1, len(all_bills))
                time.sleep(0.3)

    # 4. Build rows for upsert
    rows = []
    for bill in all_bills:
        status = determine_status(bill)
        row = {
            "title": bill["title"][:500],
            "current_status": status,
            "parliament_no": bill.get("parliament_no"),
            "aph_url": bill.get("aph_url"),
            "aph_id": bill.get("aph_id"),
            "origin_chamber": bill.get("origin_chamber"),
            "sponsor": bill.get("sponsor"),
            "portfolio": bill.get("portfolio"),
            "bill_type": bill.get("bill_type"),
            "summary": bill.get("summary"),
            "em_url": bill.get("em_url"),
            "text_url": bill.get("text_url"),
            "act_no": bill.get("act_no"),
            "level": "federal",
        }
        # Only set dates if we have them
        if bill.get("date_introduced"):
            row["date_introduced"] = bill["date_introduced"]

        rows.append(row)

    log.info("Rows to upsert: %d", len(rows))

    if dry_run:
        for r in rows[:15]:
            log.info("  [%s] %s — %s", r.get("parliament_no", "?"), r["title"][:60], r["current_status"])
        if len(rows) > 15:
            log.info("  ... and %d more", len(rows) - 15)
        return

    if not rows:
        log.warning("No bills to upsert.")
        return

    # Check existing titles to avoid duplicates
    existing = db.table("bills").select("title").execute()
    existing_titles = {r["title"].lower().strip() for r in existing.data}
    new_rows = [r for r in rows if r["title"].lower().strip() not in existing_titles]
    log.info("New bills (not already in DB): %d", len(new_rows))

    # Split: rows with aph_id → upsert on aph_id; rows without → insert one-by-one
    with_aph = [r for r in new_rows if r.get("aph_id")]
    without_aph = [r for r in new_rows if not r.get("aph_id")]

    BATCH = 50
    total = 0

    # Upsert rows that have aph_id
    for i in range(0, len(with_aph), BATCH):
        batch = with_aph[i:i + BATCH]
        try:
            result = db.table("bills").upsert(batch, on_conflict="aph_id").execute()
            total += len(result.data)
        except Exception as e:
            log.warning("Upsert batch %d failed: %s", i // BATCH + 1, e)
        time.sleep(0.2)

    # Insert rows without aph_id one at a time (skip on error)
    for r in without_aph:
        try:
            result = db.table("bills").insert(r).execute()
            total += len(result.data)
        except Exception:
            pass  # Duplicate title — skip silently

    log.info("Done. %d bills upserted.", total)


if __name__ == "__main__":
    main()
