#!/usr/bin/env python3
"""
normalise_bill_status.py — Map raw APH bill status strings to clean enum values.

Mapping applied in order (first match wins, case-insensitive):
  royal assent / assented     → royal_assent
  passed by both              → passed
  passed senate               → passed_senate
  passed house                → passed_house
  before senate               → before_senate
  senate (catch-all)          → before_senate
  before house                → before_house
  house of rep                → before_house
  first reading               → introduced
  second reading              → before_house
  third reading               → before_house
  defeated                    → defeated
  withdrawn / lapsed          → withdrawn
  "In search index"           → SKIP (leave as-is)

Updates current_status in place. Logs count per output value.
"""
import logging
import os
import sys
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# Ordered mapping: (substring_to_match, normalised_value)
# Evaluated case-insensitively; first match wins.
RULES: list[tuple[str, str]] = [
    ("royal assent",    "royal_assent"),
    ("assented",        "royal_assent"),
    ("passed by both",  "passed"),
    ("passed senate",   "passed_senate"),
    ("passed house",    "passed_house"),
    ("before senate",   "before_senate"),
    ("senate",          "before_senate"),
    ("before house",    "before_house"),
    ("house of rep",    "before_house"),
    ("first reading",   "introduced"),
    ("second reading",  "before_house"),
    ("third reading",   "before_house"),
    ("defeated",        "defeated"),
    ("withdrawn",       "withdrawn"),
    ("lapsed",          "withdrawn"),
]

SKIP_VALUES = {"in search index"}


def normalise(raw: str | None) -> str | None:
    if not raw:
        return None
    low = raw.lower().strip()
    if low in SKIP_VALUES:
        return None  # signal: skip
    for substring, clean in RULES:
        if substring in low:
            return clean
    return None  # no match → skip


def main() -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_KEY"); sys.exit(1)

    db = create_client(url, key)

    log.info("Fetching all bills...")
    resp = db.table("bills").select("id,current_status").execute()
    bills = resp.data or []
    log.info("Found %d bills", len(bills))

    counts: dict[str, int] = defaultdict(int)
    skipped = 0
    updated = 0

    for bill in bills:
        raw = bill.get("current_status")
        clean = normalise(raw)
        if clean is None:
            skipped += 1
            continue
        if clean == raw:
            # Already normalised
            counts[clean] += 1
            continue
        db.table("bills").update({"current_status": clean}).eq("id", bill["id"]).execute()
        counts[clean] += 1
        updated += 1

    log.info("Updated %d bills (skipped %d with no match / already clean)", updated, skipped)
    log.info("Status distribution after normalisation:")
    for status, count in sorted(counts.items(), key=lambda x: -x[1]):
        log.info("  %-20s %d", status, count)


if __name__ == "__main__":
    main()
