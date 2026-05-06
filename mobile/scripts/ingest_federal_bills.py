#!/usr/bin/env python3
"""
ingest_federal_bills.py — Scrape APH bill pages directly (replacing broken OpenData API).

Strategy:
  1. Fetch "Bills before Parliament" listing (paginated, ps=50) to get active set.
  2. For each bill, fetch the detail page and extract metadata.
  3. Upsert into Supabase `bills` table on aph_id (unique constraint).
  4. Log every action to `bill_ingestion_log` table.
  5. Write heartbeat on success to `pipeline_heartbeats`.

Idempotent. Polite (1.5s delay between requests). Identifies itself.

Usage:
  python scripts/ingest_federal_bills.py             # active bills only
  python scripts/ingest_federal_bills.py --all       # also fetch recently assented
  python scripts/ingest_federal_bills.py --dry-run   # parse but don't write to DB
"""

import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# --- Config ---
APH_BASE = "https://www.aph.gov.au"
BILLS_BEFORE_PARLIAMENT_PAGE = (
    "{base}/Parliamentary_Business/Bills_Legislation/Bills_before_Parliament"
    "?page={page}&drt=2&drv=7&drvH=7&pnu=48&pnuH=48"
    "&f=01/01/2022&to=31/12/2026&ps=50&ito=1&q=&bs=1&pbh=1&bhor=1&pmb=1&g=1&st=2"
)
BILLS_ASSENTED_PAGE = (
    "{base}/Parliamentary_Business/Bills_Legislation/Bills_Search_Results"
    "?page={page}&drt=2&drv=7&drvH=7&pnu=48&pnuH=48"
    "&ps=50&ito=1&q=&ra=1&bs=0&pbh=0&bhor=0&pmb=0&g=0&st=2"
)
BILL_DETAIL_URL = (
    "{base}/Parliamentary_Business/Bills_Legislation/"
    "Bills_Search_Results/Result?bId={bill_id}"
)
HEADERS = {
    "User-Agent": "Verity-CivicIntelligence/1.0 (https://verity.run; data@verity.run)"
}
REQUEST_DELAY = 1.5  # seconds between detail page requests

STATUS_MAP = {
    "before reps": "introduced",
    "before senate": "passed_house",
    "before house": "introduced",
    "before the reps": "introduced",
    "before the senate": "passed_house",
    "act": "royal_assent",
    "not proceeding": "defeated",
    "negatived": "defeated",
    "lapsed": "defeated",
    "withdrawn": "withdrawn",
    "passed both houses": "passed_senate",
    "received royal assent": "royal_assent",
    "assented": "royal_assent",
}


def normalise_status(raw: str) -> str:
    if not raw:
        return "introduced"
    lower = raw.lower().strip()
    for key, val in STATUS_MAP.items():
        if key in lower:
            return val
    return "introduced"


def parse_aph_date(raw: str | None) -> str | None:
    """Parse dates like '27 Mar 2023' or '01 Apr 2026'."""
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def fetch_bill_listing_paginated(url_template: str, label: str) -> list[dict]:
    """Fetch all pages of a bill listing. Returns [{bill_id, title}]."""
    all_bills = []
    seen_ids = set()
    page = 1

    while True:
        url = url_template.format(base=APH_BASE, page=page)
        log.info("Fetching %s page %d...", label, page)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
        except Exception as exc:
            log.error("Failed to fetch %s page %d: %s", label, page, exc)
            break

        soup = BeautifulSoup(resp.text, "lxml")

        # Extract total on first page
        if page == 1:
            total_el = soup.find("p", id="main_0_content_0_pTotalResults")
            if total_el:
                m = re.search(r"(\d+)", total_el.get_text())
                if m:
                    log.info("  Total results: %s", m.group(1))

        # Extract bill links
        page_bills = []
        for link in soup.select("ul.search-filter-results h4 a[href*='bId=']"):
            href = link.get("href", "")
            m = re.search(r"bId=([rs]\d+)", href)
            if m and m.group(1) not in seen_ids:
                seen_ids.add(m.group(1))
                page_bills.append({
                    "bill_id": m.group(1),
                    "title": link.get_text(strip=True),
                })

        if not page_bills:
            break

        all_bills.extend(page_bills)
        log.info("  Found %d bills on page %d (total so far: %d)", len(page_bills), page, len(all_bills))

        # Check if there's a next page
        if len(page_bills) < 50:
            break
        page += 1
        time.sleep(1.0)

    log.info("  %s listing complete: %d bills.", label, len(all_bills))
    return all_bills


def fetch_bill_detail(bill_id: str) -> dict | None:
    """Fetch a single bill's detail page and extract all metadata."""
    url = BILL_DETAIL_URL.format(base=APH_BASE, bill_id=bill_id)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception as exc:
        log.warning("  [%s] Detail fetch failed: %s", bill_id, exc)
        return None

    soup = BeautifulSoup(resp.text, "lxml")

    # Title — from h1 on the page (first non-empty h1)
    title = None
    for h1 in soup.find_all("h1"):
        text = h1.get_text(strip=True)
        if text:
            title = text
            break

    # Metadata lives in dl.dl--inline--bills
    header = soup.find("div", id="main_0_billSummary_divHeader")
    dl = soup.find("dl", class_="dl--inline--bills")
    meta_container = dl or header

    if not meta_container and not title:
        log.warning("  [%s] No bill content found on page.", bill_id)
        return None

    # Extract <dt>/<dd> pairs from the metadata section
    meta = {}
    if meta_container:
        dts = meta_container.find_all("dt")
        for dt in dts:
            key = dt.get_text(strip=True)
            dd = dt.find_next_sibling("dd")
            if dd:
                meta[key] = dd.get_text(strip=True)

    # Sponsor (private bills) — from panel or meta dict
    sponsor = meta.get("Sponsor(s)", meta.get("Sponsor", None))
    if not sponsor:
        sponsor_panel = soup.find("div", id="main_0_billSummary_sponsorPanel")
        if sponsor_panel:
            dd = sponsor_panel.find("dd")
            if dd:
                sponsor = dd.get_text(strip=True)
    if sponsor:
        sponsor = sponsor.rstrip(",").strip()

    # Portfolio (government bills) — from panel or meta dict
    portfolio = meta.get("Portfolio", None)
    if not portfolio:
        portfolio_panel = soup.find("div", id="main_0_billSummary_portfolioPanel")
        if portfolio_panel:
            dd = portfolio_panel.find("dd")
            if dd:
                portfolio = dd.get_text(strip=True)

    # Summary — may be absent. Lives in #main_0_summaryPanel or after <h2>Summary</h2>
    summary = None
    summary_panel = soup.find("div", id="main_0_summaryPanel")
    if summary_panel:
        p = summary_panel.find("p")
        if p:
            summary = p.get_text(strip=True)
    if not summary:
        summary_h2 = soup.find("h2", string=re.compile(r"^Summary$", re.I))
        if summary_h2:
            p = summary_h2.find_next_sibling("p")
            if p:
                summary = p.get_text(strip=True)

    # Progress stages — in #main_0_mainDiv or after <h2>Progress</h2>
    progress = []
    progress_div = soup.find("div", id="main_0_mainDiv")
    progress_tables = progress_div.find_all("table") if progress_div else []
    if not progress_tables:
        progress_h2 = soup.find("h2", string=re.compile(r"Progress", re.I))
        if progress_h2:
            progress_tables = []
            sibling = progress_h2.find_next_sibling()
            while sibling and sibling.name == "table":
                progress_tables.append(sibling)
                sibling = sibling.find_next_sibling()

    for table in progress_tables:
        current_chamber = None
        thead = table.find("thead")
        if thead:
            th = thead.find("th")
            if th:
                current_chamber = th.get_text(strip=True)
        tbody = table.find("tbody")
        if tbody:
            for row in tbody.find_all("tr"):
                cells = row.find_all("td")
                if len(cells) >= 2:
                    stage = cells[0].get_text(strip=True)
                    date_str = cells[1].get_text(strip=True)
                    progress.append({
                        "chamber": current_chamber,
                        "stage": stage,
                        "date": parse_aph_date(date_str),
                    })

    # Determine dates from progress
    intro_house_date = None
    intro_senate_date = None
    passed_house_date = None
    passed_senate_date = None
    assent_date = None

    for p in progress:
        stage_lower = (p.get("stage") or "").lower()
        chamber = (p.get("chamber") or "").lower()
        d = p.get("date")
        if not d:
            continue

        if "introduced" in stage_lower or "first time" in stage_lower:
            if "house" in chamber or "representative" in chamber:
                intro_house_date = intro_house_date or d
            elif "senate" in chamber:
                intro_senate_date = intro_senate_date or d
        if "passed" in stage_lower or "third reading" in stage_lower or "agreed" in stage_lower:
            if "house" in chamber or "representative" in chamber:
                passed_house_date = d
            elif "senate" in chamber:
                passed_senate_date = d
        if "assent" in stage_lower:
            assent_date = d

    # date_introduced = earliest introduction
    date_introduced = intro_house_date or intro_senate_date
    if not date_introduced and progress:
        date_introduced = progress[0].get("date")

    # Last activity date
    last_activity = None
    if progress:
        last_activity = progress[-1].get("date")

    # Originating chamber
    orig_chamber_raw = meta.get("Originating house", "")
    origin_chamber = "senate" if "senate" in orig_chamber_raw.lower() else "house"

    # Bill type
    bill_type = meta.get("Type", "").strip() or None

    # Status
    status_raw = meta.get("Status", "")

    # Parliament number
    parl_no_raw = meta.get("Parliament no", "")
    parliament_no = int(parl_no_raw) if parl_no_raw.isdigit() else None

    # APH URL
    aph_url = f"{APH_BASE}/Parliamentary_Business/Bills_Legislation/Bills_Search_Results/Result?bId={bill_id}"

    return {
        "title": title,
        "aph_id": bill_id,
        "bill_type": bill_type,
        "sponsor": sponsor,
        "portfolio": portfolio,
        "summary": summary,
        "status_raw": status_raw,
        "current_status": normalise_status(status_raw),
        "origin_chamber": origin_chamber,
        "date_introduced": date_introduced,
        "last_updated": last_activity or date_introduced,
        "parliament_no": parliament_no,
        "intro_house": intro_house_date,
        "intro_senate": intro_senate_date,
        "passed_house": passed_house_date,
        "passed_senate": passed_senate_date,
        "assent_date": assent_date,
        "aph_url": aph_url,
    }


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    fetch_all = "--all" in sys.argv

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)

    start_time = time.time()

    # Step 1: Get bill listings
    bills_to_fetch = fetch_bill_listing_paginated(BILLS_BEFORE_PARLIAMENT_PAGE, "Bills before Parliament")

    if fetch_all:
        assented = fetch_bill_listing_paginated(BILLS_ASSENTED_PAGE, "Recently assented")
        seen_ids = {b["bill_id"] for b in bills_to_fetch}
        for b in assented:
            if b["bill_id"] not in seen_ids:
                bills_to_fetch.append(b)
                seen_ids.add(b["bill_id"])
        log.info("Total bills to process (active + assented): %d", len(bills_to_fetch))

    if not bills_to_fetch:
        log.error("No bills found in listing. Aborting.")
        sys.exit(1)

    # Step 2: Fetch detail for each bill and upsert
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    log_entries = []
    sample_bills = []

    for i, bill_ref in enumerate(bills_to_fetch):
        bill_id = bill_ref["bill_id"]
        log.info("[%d/%d] %s: %s", i + 1, len(bills_to_fetch), bill_id, bill_ref["title"][:60])

        detail = fetch_bill_detail(bill_id)
        if not detail:
            stats["errors"] += 1
            log_entries.append({
                "bill_id": bill_id,
                "action": "error",
                "reason": "Failed to fetch or parse detail page",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            time.sleep(REQUEST_DELAY)
            continue

        if not detail["title"]:
            stats["skipped"] += 1
            log_entries.append({
                "bill_id": bill_id,
                "action": "skip",
                "reason": "No title extracted from detail page",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            time.sleep(REQUEST_DELAY)
            continue

        # Build upsert row — matches actual bills table schema
        row = {
            "aph_id": detail["aph_id"],
            "title": detail["title"],
            "summary": detail["summary"],
            "current_status": detail["current_status"],
            "origin_chamber": detail["origin_chamber"],
            "date_introduced": detail["date_introduced"],
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "aph_url": detail["aph_url"],
            "bill_type": detail["bill_type"],
            "sponsor": detail["sponsor"],
            "portfolio": detail["portfolio"],
            "parliament_no": detail["parliament_no"],
            "intro_house": detail["intro_house"],
            "intro_senate": detail["intro_senate"],
            "passed_house": detail["passed_house"],
            "passed_senate": detail["passed_senate"],
            "assent_date": detail["assent_date"],
            "is_live": detail["current_status"] in ("introduced", "passed_house"),
        }

        if dry_run:
            log.info("  [DRY RUN] Would upsert: %s (status=%s)", detail["title"][:50], detail["current_status"])
            stats["inserted"] += 1
        else:
            try:
                # Check if bill already exists — first by aph_id, then by title
                existing = (
                    db.table("bills")
                    .select("id,aph_id,current_status,passed_house,passed_senate,assent_date")
                    .eq("aph_id", bill_id)
                    .execute()
                )

                if not existing.data:
                    # Try matching by title (legacy rows without aph_id)
                    existing = (
                        db.table("bills")
                        .select("id,aph_id,current_status,passed_house,passed_senate,assent_date")
                        .eq("title", detail["title"])
                        .execute()
                    )

                if existing.data:
                    old = existing.data[0]
                    old_id = old["id"]
                    # Check if anything changed
                    if (old.get("aph_id") == bill_id
                            and old.get("current_status") == detail["current_status"]
                            and old.get("passed_house") == detail["passed_house"]
                            and old.get("passed_senate") == detail["passed_senate"]
                            and old.get("assent_date") == detail["assent_date"]):
                        stats["skipped"] += 1
                        log_entries.append({
                            "bill_id": bill_id,
                            "action": "skip",
                            "reason": "No change detected",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        })
                        time.sleep(REQUEST_DELAY)
                        continue

                    # Update existing row by id
                    db.table("bills").update(row).eq("id", old_id).execute()
                    action = "update"
                else:
                    # Genuinely new bill — insert
                    db.table("bills").insert(row).execute()
                    action = "insert"
                    if len(sample_bills) < 5:
                        sample_bills.append(detail)

                if action == "insert":
                    stats["inserted"] += 1
                else:
                    stats["updated"] += 1

                log_entries.append({
                    "bill_id": bill_id,
                    "action": action,
                    "reason": f"status={detail['current_status']}, introduced={detail['date_introduced']}",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })

            except Exception as exc:
                stats["errors"] += 1
                log_entries.append({
                    "bill_id": bill_id,
                    "action": "error",
                    "reason": str(exc)[:200],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                log.error("  [%s] Upsert failed: %s", bill_id, exc)

        # Polite delay
        time.sleep(REQUEST_DELAY)

    elapsed = time.time() - start_time

    # Step 3: Write ingestion log
    if not dry_run and log_entries:
        try:
            for i in range(0, len(log_entries), 50):
                batch = log_entries[i:i + 50]
                db.table("bill_ingestion_log").insert(batch).execute()
            log.info("Wrote %d log entries to bill_ingestion_log.", len(log_entries))
        except Exception as exc:
            log.warning("Failed to write ingestion log: %s", exc)

    # Step 4: Write heartbeat
    if not dry_run and stats["errors"] < len(bills_to_fetch) * 0.5:
        try:
            db.table("pipeline_heartbeats").upsert(
                {
                    "pipeline_name": "ingest_federal_bills",
                    "last_success": datetime.now(timezone.utc).isoformat(),
                    "bills_processed": stats["inserted"] + stats["updated"] + stats["skipped"],
                    "bills_inserted": stats["inserted"],
                    "bills_updated": stats["updated"],
                    "duration_seconds": round(elapsed, 1),
                },
                on_conflict="pipeline_name",
            ).execute()
            log.info("Heartbeat written.")
        except Exception as exc:
            log.warning("Failed to write heartbeat: %s", exc)

    # Summary
    log.info("=" * 60)
    log.info("BILL INGESTION COMPLETE")
    log.info("  Duration: %.1fs", elapsed)
    log.info("  Inserted: %d", stats["inserted"])
    log.info("  Updated:  %d", stats["updated"])
    log.info("  Skipped:  %d (no change)", stats["skipped"])
    log.info("  Errors:   %d", stats["errors"])
    log.info("=" * 60)

    if sample_bills:
        log.info("SAMPLE NEWLY INGESTED BILLS:")
        for b in sample_bills[:3]:
            log.info("  [%s] %s", b["aph_id"], b["title"])
            log.info("    Status: %s | Chamber: %s | Introduced: %s",
                     b["current_status"], b["origin_chamber"], b["date_introduced"])
            log.info("    Summary: %s", (b["summary"] or "None")[:120])
            log.info("")

    if stats["errors"] > len(bills_to_fetch) * 0.5:
        log.error("More than 50%% errors — something is wrong.")
        sys.exit(1)


if __name__ == "__main__":
    main()
