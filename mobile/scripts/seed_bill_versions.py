#!/usr/bin/env python3
"""
seed_bill_versions.py — Seed bill_versions with v1 baseline for all bills.

Creates a version 1 snapshot for every bill that has summary data.
This establishes the baseline so that future ingestion runs can detect changes.

Run:
  python3 scripts/seed_bill_versions.py [--dry-run]
"""
import hashlib
import json
import logging
import os
import sys

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

BATCH_SIZE = 50


def compute_hash(bill: dict) -> str:
    payload = json.dumps({
        "status": bill.get("current_status"),
        "title": bill.get("title"),
        "summary": bill.get("summary_plain") or bill.get("summary"),
        "passed_house": bill.get("passed_house"),
        "passed_senate": bill.get("passed_senate"),
        "assent_date": bill.get("assent_date"),
    }, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:32]


def main():
    dry_run = "--dry-run" in sys.argv
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Get all bills
    bills = []
    offset = 0
    while True:
        r = db.table("bills").select(
            "id, title, current_status, summary_plain, summary, expanded_summary, "
            "passed_house, passed_senate, assent_date, aph_url, date_introduced"
        ).range(offset, offset + 999).execute()
        if not r.data:
            break
        bills.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000

    log.info("Found %d total bills", len(bills))

    # Get existing versions to avoid duplicates
    existing = set()
    r = db.table("bill_versions").select("bill_id, content_hash").execute()
    for v in (r.data or []):
        existing.add((v["bill_id"], v["content_hash"]))

    # Build version rows
    rows = []
    skipped = 0
    for bill in bills:
        summary = bill.get("summary_plain") or bill.get("summary")
        if not summary and not bill.get("title"):
            skipped += 1
            continue

        content_hash = compute_hash(bill)
        if (bill["id"], content_hash) in existing:
            skipped += 1
            continue

        # Determine reading stage from status
        status = (bill.get("current_status") or "").lower()
        if "assent" in status or "royal" in status:
            stage = "assent"
        elif bill.get("passed_senate"):
            stage = "passed"
        elif bill.get("passed_house"):
            stage = "third_reading"
        elif status in ("defeated", "withdrawn"):
            stage = status
        else:
            stage = "introduced"

        rows.append({
            "bill_id": bill["id"],
            "version_number": 1,
            "reading_stage": stage,
            "status_snapshot": bill.get("current_status"),
            "title_snapshot": bill.get("title"),
            "summary_snapshot": summary,
            "progress_snapshot": [],
            "content_hash": content_hash,
            "source_url": bill.get("aph_url"),
        })

    log.info("Versions to create: %d (skipped %d existing/empty)", len(rows), skipped)

    if dry_run:
        log.info("[DRY RUN] Would insert %d version records", len(rows))
        return

    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            db.table("bill_versions").insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            # Insert one by one on conflict
            for row in batch:
                try:
                    db.table("bill_versions").insert(row).execute()
                    inserted += 1
                except Exception:
                    pass

    log.info("Inserted %d baseline versions", inserted)


if __name__ == "__main__":
    main()
