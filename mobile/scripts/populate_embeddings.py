#!/usr/bin/env python3
"""
populate_embeddings.py — Batch-populate civic_embeddings via the ask-verity-ingest Edge Function.

Uses small batches (limit=10) to avoid Supabase Edge Function compute limits.
Paginates through all records for each source type.

Run:
  python3 scripts/populate_embeddings.py
  python3 scripts/populate_embeddings.py --source bill      # single source type
  python3 scripts/populate_embeddings.py --dry-run           # count without embedding
"""
import os
import sys
import time
import json
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
FUNCTION_URL = f"{SUPABASE_URL}/functions/v1/ask-verity-ingest"

BATCH_SIZE = 10  # Max per call to avoid WORKER_RESOURCE_LIMIT
DELAY_BETWEEN_BATCHES = 1.0  # seconds

# Source types in priority order (most valuable first)
SOURCE_TYPES = [
    "bill",                 # 482 with summary_plain
    "speech",               # 4,780 hansard entries
    "mp_record",            # 225 active members
    "vote",                 # division summaries
    "party_platform",       # 40 policies
    "registered_interest",  # 1,753 entries
    "donation",             # individual donations
    "government_contract",  # 4,851 contracts
]

# Approximate record counts for progress tracking
ESTIMATED_COUNTS = {
    "bill": 482,
    "speech": 4780,
    "mp_record": 225,
    "vote": 2006,
    "party_platform": 40,
    "registered_interest": 1753,
    "donation": 2307,
    "government_contract": 4851,
}


def ingest_batch(source_type: str, limit: int, offset: int) -> dict:
    """Call the Edge Function for one batch."""
    resp = requests.post(
        FUNCTION_URL,
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
        json={"source_type": source_type, "limit": limit, "offset": offset},
        timeout=120,
    )

    if resp.status_code != 200:
        return {"ok": False, "error": resp.text[:200], "chunks_created": 0, "embedded": 0}

    return resp.json()


def ingest_source(source_type: str, dry_run: bool = False) -> int:
    """Paginate through all records for a source type."""
    total_embedded = 0
    total_chunks = 0
    offset = 0
    est = ESTIMATED_COUNTS.get(source_type, 0)

    while True:
        if dry_run:
            print(f"  [DRY RUN] Would ingest {source_type} offset={offset} limit={BATCH_SIZE}")
            break

        result = ingest_batch(source_type, BATCH_SIZE, offset)

        if not result.get("ok"):
            error = result.get("error", result.get("message", "Unknown error"))
            if "WORKER_RESOURCE_LIMIT" in str(error):
                print(f"  Hit compute limit at offset={offset}, waiting 5s...")
                time.sleep(5)
                continue  # Retry same offset
            print(f"  Error at offset={offset}: {error}")
            break

        chunks = result.get("chunks_created", 0)
        embedded = result.get("embedded", 0)
        total_embedded += embedded
        total_chunks += chunks

        pct = f" ({min(100, round(offset / est * 100))}%)" if est > 0 else ""
        print(f"  offset={offset}: {chunks} chunks, {embedded} embedded{pct}")

        if chunks < BATCH_SIZE:
            break  # Last page

        offset += BATCH_SIZE
        time.sleep(DELAY_BETWEEN_BATCHES)

        # Safety cap
        if offset > 20000:
            print(f"  Safety cap reached at offset {offset}")
            break

    return total_embedded


def main():
    dry_run = "--dry-run" in sys.argv
    single_source = None
    for i, arg in enumerate(sys.argv):
        if arg == "--source" and i + 1 < len(sys.argv):
            single_source = sys.argv[i + 1]

    sources = [single_source] if single_source else SOURCE_TYPES

    print(f"\n{'=' * 60}")
    print(f"POPULATE CIVIC EMBEDDINGS")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Sources: {', '.join(sources)}")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"{'=' * 60}\n")

    grand_total = 0
    for source in sources:
        est = ESTIMATED_COUNTS.get(source, "?")
        print(f"--- {source} (est. {est} records) ---")
        embedded = ingest_source(source, dry_run)
        grand_total += embedded
        print(f"  TOTAL: {embedded} embedded\n")

    print(f"{'=' * 60}")
    print(f"GRAND TOTAL: {grand_total} embeddings created")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
