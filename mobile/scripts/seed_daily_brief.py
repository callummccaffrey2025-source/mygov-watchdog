#!/usr/bin/env python3
"""
seed_daily_brief.py — Seed a daily brief for today (or a specific date).

Creates one record in daily_briefs for today with realistic Australian political content.
Idempotent: if a record already exists for today, it deletes and re-inserts.

Designed to be run daily (manually or via cron). In future, replace static stories
with Claude API calls to generate fresh content from live parliament data.

Usage:
    python3 seed_daily_brief.py            # seeds today
    python3 seed_daily_brief.py 2026-03-28 # seeds specific date
"""

import json
import logging
import os
import sys
from datetime import date
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ─── Top Stories ──────────────────────────────────────────────────────────────
# Realistic 2025–2026 Australian political content.
# bill_id values map to real bills in the DB.

STORIES = [
    {
        "headline": "AUKUS submarine deal clears key parliamentary hurdle",
        "summary": "The National Defence (AUKUS Implementation) Bill 2025 passed its second reading in the House, with bipartisan support for the nuclear-powered submarine program.",
        "category": "Defence",
        "source_url": None,
        "bill_id": "a450d2dd-80a0-4f65-8ba1-fb557a24fe2d",
    },
    {
        "headline": "Mental health parity laws to close Medicare gap",
        "summary": "The Health Insurance Amendment (Mental Health Parity) Bill 2025 aims to equalise Medicare rebates for psychological and physical health services.",
        "category": "Health",
        "source_url": None,
        "bill_id": "e9e5c48d-13f3-4df0-9ff3-3ee2fc54e429",
    },
    {
        "headline": "Emissions accountability bill sparks Senate debate",
        "summary": "The Climate Change (Net Zero Accountability) Amendment Bill 2025 is before the Senate, with crossbenchers pushing for stronger 2035 interim targets.",
        "category": "Climate",
        "source_url": None,
        "bill_id": "f9b2f28a-30c0-41f5-9447-34ad16839cc9",
    },
    {
        "headline": "RBA holds cash rate as inflation edges toward target",
        "summary": "The Reserve Bank left the cash rate unchanged at its March meeting, citing progress on inflation but flagging risks from global energy prices.",
        "category": "Economy",
        "source_url": None,
        "bill_id": None,
    },
    {
        "headline": "Housing Australia Future Fund releases first round of grants",
        "summary": "State and territory governments received the first tranche of HAFF funding, unlocking construction of 5,200 affordable homes across major cities.",
        "category": "Housing",
        "source_url": None,
        "bill_id": None,
    },
]

# ─── National Updates (personalisation fallback) ───────────────────────────

NATIONAL_UPDATES = [
    {"text": "Parliament sitting this week — Question Time daily from 2pm AEST.", "category": "parliament"},
    {"text": "New childcare subsidy changes take effect from 1 April 2026.", "category": "cost_of_living"},
    {"text": "Defence spending to reach 2.4% of GDP by 2028 under new budget forward estimates.", "category": "defence"},
    {"text": "Medicare bulk-billing rates continue to rise following the 2025 GP incentive package.", "category": "healthcare"},
    {"text": "First home buyer scheme expanded to 50,000 places for FY2026–27.", "category": "housing"},
]

# ─── Bills to watch (real bill IDs from DB) ────────────────────────────────

BILLS_TO_WATCH = [
    "a450d2dd-80a0-4f65-8ba1-fb557a24fe2d",  # AUKUS Implementation
    "e9e5c48d-13f3-4df0-9ff3-3ee2fc54e429",  # Mental Health Parity
    "f9b2f28a-30c0-41f5-9447-34ad16839cc9",  # Net Zero Accountability
]


def main() -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_KEY")
        sys.exit(1)

    target_date = sys.argv[1] if len(sys.argv) > 1 else date.today().isoformat()

    db = create_client(url, key)

    # Delete existing record for this date (idempotent)
    db.table("daily_briefs").delete().eq("date", target_date).execute()

    row = {
        "date": target_date,
        "stories": STORIES,
        "bills_to_watch": BILLS_TO_WATCH,
        "national_updates": NATIONAL_UPDATES,
    }

    db.table("daily_briefs").insert(row).execute()
    log.info("Seeded daily brief for %s with %d stories, %d bills to watch.",
             target_date, len(STORIES), len(BILLS_TO_WATCH))


if __name__ == "__main__":
    main()
