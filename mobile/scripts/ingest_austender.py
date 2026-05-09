#!/usr/bin/env python3
"""
ingest_austender.py — Pull federal government contracts from the AusTender OCDS API.

API: https://api.tenders.gov.au/ocds/
Docs: https://app.swaggerhub.com/apis/austender/ocds-api/1.1

Fetches contracts by publish date. Supports:
  --days N       Fetch last N days (default: 90)
  --start YYYY-MM-DD --end YYYY-MM-DD   Custom date range
  --dry-run      Don't write to database

Maps supplier postcodes to electorates via the electorates.postcodes array.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

API_BASE = "https://api.tenders.gov.au/ocds"
HEADERS = {"User-Agent": "Verity-App/1.0 (civic data; contact@verity.au)"}
PAGE_LIMIT = 100  # API returns max 100 per page


def fetch_contracts_page(url: str) -> tuple[list[dict], str | None]:
    """Fetch one page of contracts. Returns (releases, next_url)."""
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    releases = data.get("releases", [])
    next_url = data.get("links", {}).get("next")
    return releases, next_url


def fetch_contracts_for_range(start_date: str, end_date: str, max_pages: int = 50) -> list[dict]:
    """Fetch all contracts published between start_date and end_date."""
    url = f"{API_BASE}/findByDates/contractPublished/{start_date}T00:00:00Z/{end_date}T23:59:59Z"
    all_releases = []
    page = 0

    while url and page < max_pages:
        releases, next_url = fetch_contracts_page(url)
        all_releases.extend(releases)
        page += 1

        if page % 5 == 0:
            log.info("  Fetched %d pages (%d contracts)...", page, len(all_releases))

        if not next_url or not releases:
            break
        url = next_url
        time.sleep(0.3)

    return all_releases


def parse_release(release: dict) -> dict | None:
    """Parse an OCDS release into a row for the government_contracts table."""
    contracts = release.get("contracts", [])
    if not contracts:
        return None

    contract = contracts[0]
    cn_id = contract.get("id", "")
    if not cn_id:
        return None

    # Extract parties
    supplier = None
    agency = None
    for party in release.get("parties", []):
        roles = party.get("roles", [])
        if "supplier" in roles:
            supplier = party
        if "procuringEntity" in roles:
            agency = party

    # Value
    value = contract.get("value", {})
    amount = value.get("amount")
    if amount:
        try:
            amount = float(amount)
        except (ValueError, TypeError):
            amount = None

    # Period
    period = contract.get("period", {})
    start_date = _parse_date(period.get("startDate"))
    end_date = _parse_date(period.get("endDate"))
    publish_date = _parse_date(release.get("date"))

    # Category from items
    items = contract.get("items", [])
    category = None
    if items:
        classification = items[0].get("classification", {})
        category = classification.get("description") or classification.get("id")

    # Procurement method
    tender = release.get("tender", {})
    procurement_method = tender.get("procurementMethod")

    row = {
        "cn_id": cn_id,
        "agency": agency.get("name", "Unknown") if agency else "Unknown",
        "description": (contract.get("description") or contract.get("title") or "")[:500],
        "value": amount,
        "supplier_name": supplier.get("name", "") if supplier else "",
        "supplier_abn": supplier.get("identifier", {}).get("id", "") if supplier else "",
        "supplier_postcode": "",
        "supplier_state": "",
        "procurement_method": procurement_method,
        "category": (category or "")[:200],
        "start_date": start_date,
        "end_date": end_date,
        "publish_date": publish_date,
    }

    # Extract supplier address
    if supplier:
        addr = supplier.get("address", {})
        row["supplier_postcode"] = addr.get("postalCode", "")
        row["supplier_state"] = addr.get("region", "")

    return row


def _parse_date(date_str: str | None) -> str | None:
    if not date_str:
        return None
    # Handle ISO format with or without time
    return date_str[:10] if len(date_str) >= 10 else None


def build_postcode_map(db) -> dict[str, str]:
    """Build a postcode → electorate_id lookup from electorates.postcodes arrays."""
    result = db.table("electorates").select("id, postcodes").not_.is_("postcodes", "null").execute()
    pc_map = {}
    for row in result.data:
        postcodes = row.get("postcodes") or []
        for pc in postcodes:
            pc_str = str(pc).strip()
            if pc_str:
                pc_map[pc_str] = row["id"]
    log.info("Built postcode map: %d postcodes → %d electorates.",
             len(pc_map), len(set(pc_map.values())))
    return pc_map


def main() -> None:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)
    dry_run = "--dry-run" in sys.argv

    # Parse date range
    days = 90
    start_date = None
    end_date = None

    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--days" and i + 1 < len(args):
            days = int(args[i + 1])
        elif arg == "--start" and i + 1 < len(args):
            start_date = args[i + 1]
        elif arg == "--end" and i + 1 < len(args):
            end_date = args[i + 1]

    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    log.info("Fetching contracts from %s to %s...", start_date, end_date)

    # Fetch in weekly chunks to avoid API pagination limits
    all_rows = []
    current = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    while current < end:
        chunk_end = min(current + timedelta(days=7), end)
        chunk_start_str = current.strftime("%Y-%m-%d")
        chunk_end_str = chunk_end.strftime("%Y-%m-%d")

        releases = fetch_contracts_for_range(chunk_start_str, chunk_end_str)
        for r in releases:
            row = parse_release(r)
            if row:
                all_rows.append(row)

        log.info("Week %s to %s: %d contracts (total: %d)",
                 chunk_start_str, chunk_end_str, len(releases), len(all_rows))
        current = chunk_end
        time.sleep(0.5)

    log.info("Total contracts parsed: %d", len(all_rows))

    # Deduplicate by cn_id
    seen = set()
    unique_rows = []
    for row in all_rows:
        if row["cn_id"] not in seen:
            seen.add(row["cn_id"])
            unique_rows.append(row)
    log.info("Unique contracts after dedup: %d", len(unique_rows))

    # Map supplier postcodes to electorates
    pc_map = build_postcode_map(db)
    mapped = 0
    for row in unique_rows:
        pc = row.get("supplier_postcode", "").strip()
        if pc and pc in pc_map:
            row["electorate_id"] = pc_map[pc]
            mapped += 1
        else:
            row["electorate_id"] = None

    log.info("Mapped %d/%d contracts to electorates.", mapped, len(unique_rows))

    if dry_run:
        log.info("DRY RUN — sample contracts:")
        total_value = sum(r["value"] for r in unique_rows if r["value"])
        log.info("  Total value: $%s", f"{total_value:,.0f}")
        for r in unique_rows[:10]:
            log.info("  %s | $%s | %s → %s (%s)",
                     r["cn_id"], f"{r['value']:,.0f}" if r["value"] else "N/A",
                     r["agency"][:30], r["supplier_name"][:30],
                     r["supplier_postcode"] or "no-pc")
        log.info("  ... (%d total)", len(unique_rows))
        return

    if not unique_rows:
        log.warning("No contracts to insert. Exiting.")
        return

    # Upsert in batches (on cn_id conflict, update)
    BATCH = 100
    total = 0
    errors = 0
    for i in range(0, len(unique_rows), BATCH):
        batch = unique_rows[i:i + BATCH]
        try:
            result = (
                db.table("government_contracts")
                .upsert(batch, on_conflict="cn_id")
                .execute()
            )
            total += len(result.data)
        except Exception as exc:
            log.warning("Batch %d failed: %s", i // BATCH + 1, exc)
            errors += 1
        time.sleep(0.2)

    log.info("Done. %d contracts upserted (%d batch errors).", total, errors)


if __name__ == "__main__":
    main()
