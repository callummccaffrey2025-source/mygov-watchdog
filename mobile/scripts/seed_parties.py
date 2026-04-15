#!/usr/bin/env python3
"""
seed_parties.py — Seed all major Australian political parties.
Idempotent: safe to run multiple times (upserts on name).
"""

import logging
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

PARTIES = [
    {
        "name": "Australian Labor Party",
        "abbreviation": "ALP",
        "short_name": "Labor",
        "colour": "#E4002B",
        "level": "both",
    },
    {
        "name": "Liberal Party",
        "abbreviation": "LPB",
        "short_name": "Liberal",
        "colour": "#00529B",
        "level": "both",
    },
    {
        "name": "National Party",
        "abbreviation": "NPT",
        "short_name": "Nationals",
        "colour": "#006644",
        "level": "both",
    },
    {
        "name": "Australian Greens",
        "abbreviation": "AGS",
        "short_name": "Greens",
        "colour": "#009C3D",
        "level": "both",
    },
    {
        "name": "Pauline Hanson's One Nation Party",
        "abbreviation": "PHO",
        "short_name": "One Nation",
        "colour": "#FF6300",
        "level": "both",
    },
    {
        "name": "Australian Democrats",
        "abbreviation": "AD",
        "short_name": "Democrats",
        "colour": "#FF8000",
        "level": "federal",
    },
    {
        "name": "Liberal National Party",
        "abbreviation": "LNP",
        "short_name": "LNP",
        "colour": "#003087",
        "level": "state",
    },
    {
        "name": "Katter's Australian Party",
        "abbreviation": "KAP",
        "short_name": "KAP",
        "colour": "#CC0000",
        "level": "both",
    },
    {
        "name": "Independent",
        "abbreviation": "IND",
        "short_name": "Independent",
        "colour": "#00B2A9",
        "level": "both",
    },
]


def main() -> None:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)

    log.info("Seeding %d parties...", len(PARTIES))
    result = (
        db.table("parties")
        .upsert(PARTIES, on_conflict="name")
        .execute()
    )
    log.info("Done. Upserted %d rows.", len(result.data))


if __name__ == "__main__":
    main()
