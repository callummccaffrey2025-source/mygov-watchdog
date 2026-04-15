#!/usr/bin/env python3
"""
categorise_bills.py — Keyword-based bill categorisation.

Assigns categories to bills in the database using title keyword matching.
A bill can have multiple categories. Runs idempotently (overwrites existing categories).
"""

import logging
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# Each entry: (category_key, list_of_keywords)
# Keywords are matched case-insensitively against the bill title.
RULES: list[tuple[str, list[str]]] = [
    ("housing", [
        "housing", "home", "homes", "property", "rent", "rental", "tenancy",
        "landlord", "mortgage", "dwelling", "affordable housing", "social housing",
    ]),
    ("healthcare", [
        "health", "medical", "hospital", "mental", "medicare", "pharmaceutical",
        "medicine", "aged care", "aged-care", "disability", "ndis", "nursing",
        "ambulance", "cancer", "dental", "suicide", "drug", "alcohol",
    ]),
    ("climate", [
        "climate", "emission", "emissions", "energy", "renewable", "environment",
        "carbon", "pollution", "clean energy", "solar", "wind", "net zero",
        "greenhouse", "biodiversity", "nature", "conservation", "deforestation",
        "reef", "water quality", "sustainability",
    ]),
    ("defence", [
        "defence", "defense", "military", "veteran", "veterans", "aukus",
        "security", "navy", "army", "air force", "submarine", "intelligence",
        "national security", "terrorism", "border force", "customs",
    ]),
    ("education", [
        "education", "school", "schools", "university", "universities", "student",
        "students", "hecs", "fee-help", "teacher", "teachers", "tafe",
        "apprentice", "apprenticeship", "curriculum", "early childhood",
        "childcare", "preschool",
    ]),
    ("economy", [
        "tax", "taxation", "economy", "economic", "financial", "finance",
        "budget", "superannuation", "super ", "inflation", "fiscal",
        "trade", "tariff", "competition", "productivity", "investment",
        "banking", "bank ", "banks ", "corporate", "business", "industry",
        "manufacturing", "infrastructure",
    ]),
    ("immigration", [
        "immigration", "immigrant", "visa", "citizenship", "refugee", "refugees",
        "migration", "migrant", "migrants", "asylum", "detention", "border",
        "humanitarian", "temporary protection",
    ]),
    ("cost_of_living", [
        "cost of living", "welfare", "pension", "pensions", "childcare",
        "child care", "family payment", "centrelink", "social security",
        "poverty", "inequality", "wage", "wages", "minimum wage", "fair work",
        "consumer", "groceries", "food", "utilities",
    ]),
]


def categorise(title: str) -> list[str]:
    title_lower = title.lower()
    cats: list[str] = []
    for cat_key, keywords in RULES:
        for kw in keywords:
            if kw in title_lower:
                cats.append(cat_key)
                break
    return cats


def main() -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_KEY")
        sys.exit(1)

    db = create_client(url, key)

    log.info("Fetching all bills...")
    resp = db.table("bills").select("id,title").execute()
    bills = resp.data or []
    log.info("Found %d bills", len(bills))

    updated = 0
    skipped = 0
    for bill in bills:
        cats = categorise(bill["title"] or "")
        if not cats:
            skipped += 1
            continue
        db.table("bills").update({"categories": cats}).eq("id", bill["id"]).execute()
        updated += 1

    log.info("Updated %d bills with categories (%d had no keyword match)", updated, skipped)


if __name__ == "__main__":
    main()
