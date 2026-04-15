#!/usr/bin/env python3
"""
ingest_federal_bills.py — Pull current and recent federal bills from APH.

Sources (tried in order):
  1. APH Bills API  https://www.aph.gov.au/api/bills
  2. APH Bills XML  https://www.aph.gov.au/rss/bills

Idempotent: upserts on (title, chamber_introduced, level).
"""

import logging
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date
from typing import Any

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

APH_BILLS_API = "https://www.aph.gov.au/api/bills?take={take}&skip={skip}"
APH_BILLS_RSS = "https://www.aph.gov.au/rss/bills"
APH_BILLS_LIST = (
    "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/"
    "Bills_Lists/Details_Uniform_Title?at=b"
)
HEADERS = {"User-Agent": "Verity-App/1.0 (civic data; contact@verity.au)"}
PAGE_SIZE = 200

STATUS_MAP = {
    "received": "introduced",
    "introduced": "introduced",
    "passed by the house": "passed_house",
    "passed by the senate": "passed_senate",
    "received royal assent": "royal_assent",
    "defeated": "defeated",
    "withdrawn": "withdrawn",
    "lapsed": "defeated",
}


def normalise_status(raw: str) -> str:
    if not raw:
        return "introduced"
    lower = raw.lower().strip()
    for key, val in STATUS_MAP.items():
        if key in lower:
            return val
    return "introduced"


def parse_date(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip().split("T")[0]
    # Handles YYYY-MM-DD or DD/MM/YYYY
    if re.match(r"\d{4}-\d{2}-\d{2}", raw):
        return raw
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return None


def fetch_via_api() -> list[dict]:
    bills = []
    skip = 0
    while True:
        url = APH_BILLS_API.format(take=PAGE_SIZE, skip=skip)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            log.warning("APH bills API failed: %s", exc)
            return []

        items = data if isinstance(data, list) else data.get("bills", data.get("items", []))
        if not items:
            break
        bills.extend(items)
        log.info("  Fetched %d bills (skip=%d)", len(items), skip)
        if len(items) < PAGE_SIZE:
            break
        skip += PAGE_SIZE
        time.sleep(0.5)

    return bills


def fetch_via_rss() -> list[dict]:
    """Fallback: parse the APH bills RSS feed."""
    log.info("Falling back to RSS feed...")
    try:
        resp = requests.get(APH_BILLS_RSS, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        log.error("RSS fetch failed: %s", exc)
        return []

    bills = []
    try:
        root = ET.fromstring(resp.text)
        ns = {"dc": "http://purl.org/dc/elements/1.1/"}
        for item in root.findall(".//item"):
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            desc = item.findtext("description", "")
            pub_date = item.findtext("pubDate", "")
            bills.append({
                "title": title,
                "summary_raw": BeautifulSoup(desc, "lxml").get_text(" ", strip=True),
                "source_url": link,
                "introduced_raw": pub_date,
                "chamber_raw": "house",
                "status_raw": "introduced",
            })
    except ET.ParseError as exc:
        log.error("RSS parse error: %s", exc)

    log.info("RSS returned %d bills.", len(bills))
    return bills


def normalise_api_bill(raw: dict) -> dict:
    chamber_raw = raw.get("introducedInto", raw.get("chamber", "house"))
    chamber = "senate" if "senate" in str(chamber_raw).lower() else "house"

    return {
        "title": raw.get("title", raw.get("longTitle", "")),
        "short_title": raw.get("shortTitle", None),
        "summary_raw": raw.get("summary", raw.get("longSummary", None)),
        "status_raw": raw.get("status", ""),
        "chamber_raw": chamber,
        "introduced_raw": raw.get("introducedDate", raw.get("introduced", None)),
        "last_updated_raw": raw.get("lastUpdated", raw.get("updatedDate", None)),
    }


def main() -> None:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)

    raw_bills = fetch_via_api()
    if raw_bills:
        bills_data = [normalise_api_bill(b) for b in raw_bills]
    else:
        bills_data = fetch_via_rss()

    if not bills_data:
        log.error("No bills fetched.")
        sys.exit(1)

    today = date.today().isoformat()
    rows = []
    for b in bills_data:
        if not b.get("title"):
            continue
        introduced = parse_date(b.get("introduced_raw")) or today
        rows.append({
            "title": b["title"],
            "short_title": b.get("short_title"),
            "summary_raw": b.get("summary_raw"),
            "status": normalise_status(b.get("status_raw", "")),
            "chamber_introduced": b.get("chamber_raw", "house"),
            "level": "federal",
            "introduced": introduced,
            "last_updated": parse_date(b.get("last_updated_raw")) or today,
        })

    BATCH = 50
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        result = (
            db.table("bills")
            .upsert(batch, on_conflict="title,chamber_introduced,level")
            .execute()
        )
        total += len(result.data)
        log.info("Batch %d/%d — %d upserted", i // BATCH + 1, -(-len(rows) // BATCH), len(result.data))
        time.sleep(0.2)

    log.info("Done. %d bills upserted.", total)


if __name__ == "__main__":
    main()
