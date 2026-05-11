#!/usr/bin/env python3
"""
classify_donations.py — Classify donation records by industry using
keyword matching inspired by the OPAX (jaketracey/opax) taxonomy.

Covers both `donations` (party-level) and `individual_donations` (MP-level)
tables in Supabase. Writes the `industry` column directly.

27 industries + 2 pseudo-categories (individual, unidentified).

Usage:
  python classify_donations.py [--dry-run] [--table donations|individual_donations|both]

  --dry-run     Print classifications without writing to Supabase
  --table       Which table to classify (default: both)
"""

import argparse
import os
import sys
from collections import Counter

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── OPAX-derived industry taxonomy (27 industries) ──────────────────────────
# Source: jaketracey/opax classify_donations.py INDUSTRY_KEYWORDS
# Adapted for Australian political donation context.
# First match wins — order matters for ambiguous donors.

INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "gambling": [
        "gambling", "wagering", "crown", "star entertainment", "tabcorp",
        "sportsbet", "gaming", "pokies", "poker", "casino", "bet365",
        "ladbrokes", "clubs nsw", "clubs australia", "igs", "aristocrat",
    ],
    "mining": [
        "mining", "bhp", "rio tinto", "fortescue", "mineral", "glencore",
        "south32", "newcrest", "newmont", "iluka", "lynas", "orica",
        "coal", "iron ore", "lithium", "nickel", "pilbara", "hancock",
        "rinehart", "twiggy", "adani", "whitehaven", "yancoal",
        "peabody", "anglo american", "goldfields", "evolution mining",
        "northern star", "oz minerals", "sandfire",
    ],
    "fossil_fuels": [
        "woodside", "santos", "petroleum", "chevron", "exxon",
        "shell australia", "inpex", "cooper energy", "beach energy",
        "karoon", "senex", "viva energy", "ampol", "caltex",
        "oil search", "lng", "gas pipeline",
    ],
    "energy": [
        "energy", "agl", "origin energy", "electricity", "solar",
        "wind farm", "snowy hydro", "transgrid", "ausgrid", "ergon",
        "energex", "essential energy", "renewable", "battery",
        "engie", "neoen", "infigen", "tilt renewables",
    ],
    "property": [
        "property", "real estate", "developer", "lendlease", "stockland",
        "mirvac", "dexus", "charter hall", "goodman group", "scentre",
        "vicinity", "gpT", "construction", "building", "housing",
        "multiplex", "probuild", "meriton", "harry triguboff",
        "transurban", "nrma", "urban development",
    ],
    "finance": [
        "bank", "financial", "westpac", "commonwealth bank", "anz",
        "national australia bank", "nab", "macquarie", "insurance",
        "suncorp", "iag", "qbe", "super", "superannuation",
        "pwc", "deloitte", "ernst & young", "kpmg", "ey australia",
        "asx", "investment", "fund manager", "asset management",
        "credit union", "bendigo bank", "amp ", "challenger",
    ],
    "lobbying": [
        "lobbying", "government relations", "public affairs",
        "hawker britton", "gra", "barton deakin", "crosby textor",
        "ct group", "newgate", "sec newgate", "fti consulting",
    ],
    "legal": [
        "law firm", "solicitor", "barrister", "lawyer", "legal",
        "minter ellison", "allens", "herbert smith", "king & wood",
        "ashurst", "corrs", "clayton utz", "norton rose",
        "gilbert + tobin", "holding redlich", "baker mckenzie",
    ],
    "hospitality": [
        "hotel", "pub ", "restaurant", "accommodation", "tourism",
        "merivale", "accor", "mantra", "ahl group",
    ],
    "media": [
        "media", "news corp", "nine entertainment", "seven west",
        "foxtel", "broadcast", "publishing", "fairfax", "abc ",
        "sky news", "free tv", "commercial radio", "southern cross",
    ],
    "unions": [
        "union", "awu", "cfmeu", "sda", "hsu", "nurses", "teachers",
        "workers", "actu", "amwu", "usu", "nteu", "cpsu", "asu",
        "etU", "mua", "rtbu", "twu", "meaa", "aeu", "anmf",
        "united voice", "staff association", "trades hall",
        "labor council", "trades and labor",
        "nursing and midwifery", "anmf",
    ],
    "telecom": [
        "telstra", "optus", "vodafone", "tpg", "vocus",
        "nbn", "broadband", "telecommunications",
    ],
    "pharmacy": [
        "pharma", "pfizer", "astrazeneca", "csl", "therapeutic",
        "medicines", "novartis", "roche", "merck", "johnson & johnson",
        "pharmacy guild", "chemist warehouse",
    ],
    "health": [
        "hospital", "health fund", "bupa", "medibank", "nib",
        "ramsay health", "healthscope", "medical", "pathology",
        "sonic healthcare", "healius", "cochlear",
    ],
    "alcohol": [
        "brewery", "breweries", "liquor", "distiller", "wine",
        "penfolds", "treasury wine", "lion ", "coopers",
        "carlton united", "cub ", "diageo", "spirits",
    ],
    "tobacco": [
        "philip morris", "bat australia", "british american tobacco",
        "imperial tobacco", "tobacco",
    ],
    "tech": [
        "google", "meta ", "facebook", "microsoft", "amazon",
        "apple ", "atlassian", "canva", "afterpay", "square",
        "xero", "wisetech", "rea group", "seek", "carsales",
        "payment", "fintech", "software", "data centre",
    ],
    "agriculture": [
        "agriculture", "farm", "cattle", "grain", "dairy",
        "pastoral", "national farmers", "grazier", "wool",
        "agribusiness", "elders", "nutrien", "graincorp",
        "cbh group", "sugar", "cotton", "horticulture",
    ],
    "retail": [
        "coles", "woolworths", "wesfarmers", "harvey norman",
        "jb hi-fi", "bunnings", "kmart", "target", "aldi",
        "costco", "retail", "shopping",
        "pratt holdings", "visy", "transfield",
    ],
    "defence": [
        "bae systems", "thales", "raytheon", "boeing", "lockheed",
        "northrop grumman", "rheinmetall", "austal", "naval group",
        "defence", "military", "armament",
    ],
    "transport": [
        "qantas", "virgin australia", "airline", "shipping",
        "freight", "aurizon", "pacific national", "toll group",
        "linfox", "logistics", "aviation", "airport",
    ],
    "education": [
        "university", "tafe", "school", "education",
        "colleges", "training", "academic",
    ],
    "government": [
        "electoral commission", "department of", "council",
        "shire", "government",
    ],
    "party_internal": [
        "labor holdings", "cormack foundation", "enterprise foundation",
        "eight by five", "free enterprise foundation",
        "john curtin house", "greenfields foundation",
        "progressive centre", "liberal party", "labor party",
        "national party", "greens party",
    ],
    "security": [
        "armaguard", "prosegur", "brinks", "security services",
        "securitas",
    ],
    "waste_management": [
        "cleanaway", "veolia", "jj richards", "suez",
        "waste management", "recycling",
    ],
    "adult_entertainment": [
        "eros association", "adult entertainment",
    ],
}

VALID_INDUSTRIES = set(INDUSTRY_KEYWORDS.keys()) | {"individual", "unidentified", "other"}

# Display-friendly labels
INDUSTRY_LABELS: dict[str, str] = {
    "gambling": "Gambling",
    "mining": "Mining & Resources",
    "fossil_fuels": "Fossil Fuels",
    "energy": "Energy",
    "property": "Property & Construction",
    "finance": "Banking & Finance",
    "lobbying": "Lobbying",
    "legal": "Legal",
    "hospitality": "Hospitality",
    "media": "Media",
    "unions": "Unions",
    "telecom": "Telecommunications",
    "pharmacy": "Pharmaceuticals",
    "health": "Health",
    "alcohol": "Alcohol",
    "tobacco": "Tobacco",
    "tech": "Technology",
    "agriculture": "Agriculture",
    "retail": "Retail",
    "defence": "Defence",
    "transport": "Transport",
    "education": "Education",
    "government": "Government",
    "party_internal": "Party Internal",
    "security": "Security",
    "waste_management": "Waste Management",
    "adult_entertainment": "Adult Entertainment",
    "individual": "Individual",
    "unidentified": "Unidentified",
    "other": "Other",
}


def classify_donor(donor_name: str, donor_type: str | None) -> str | None:
    """Classify a donor name into an industry. Returns None if no match."""
    if not donor_name or len(donor_name.strip()) <= 2:
        return "unidentified"

    name_lower = donor_name.lower().strip()

    # Junk entries
    if name_lower in ("n/a", "na", "nil", "none", "-", ".", ".."):
        return "unidentified"

    # Keyword match (first match wins)
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in name_lower:
                return industry

    # Fallback: if donor_type indicates individual
    if donor_type and donor_type.lower() == "individual":
        return "individual"

    return None


def classify_table(table_name: str, dry_run: bool = False) -> dict[str, int]:
    """Classify all donations in a table. Returns industry counts."""
    print(f"\n{'='*60}")
    print(f"Classifying: {table_name}")
    print(f"{'='*60}")

    # Fetch all rows (paginated)
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            sb.table(table_name)
            .select("id,donor_name,donor_type")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = resp.data or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    print(f"  Total rows: {len(all_rows)}")

    counts: Counter[str] = Counter()
    updates: list[dict] = []
    unmatched: list[str] = []

    for row in all_rows:
        industry = classify_donor(row["donor_name"], row.get("donor_type"))
        if industry:
            counts[industry] += 1
            updates.append({"id": row["id"], "industry": industry})
        else:
            unmatched.append(row["donor_name"])

    # Print results
    print(f"\n  Classified: {len(updates)} / {len(all_rows)} "
          f"({100 * len(updates) / max(len(all_rows), 1):.1f}%)")
    print(f"  Unmatched:  {len(unmatched)}")

    print(f"\n  Industry breakdown:")
    for industry, count in counts.most_common():
        label = INDUSTRY_LABELS.get(industry, industry)
        print(f"    {label:30s} {count:>6d}")

    if unmatched:
        print(f"\n  Sample unmatched donors (up to 20):")
        for name in unmatched[:20]:
            print(f"    - {name}")

    # Write to Supabase
    if not dry_run and updates:
        print(f"\n  Writing {len(updates)} classifications to Supabase...")
        batch_size = 200
        written = 0
        for i in range(0, len(updates), batch_size):
            batch = updates[i : i + batch_size]
            for item in batch:
                sb.table(table_name).update(
                    {"industry": item["industry"]}
                ).eq("id", item["id"]).execute()
            written += len(batch)
            if written % 500 == 0 or written == len(updates):
                print(f"    {written}/{len(updates)} written")
        print(f"  Done.")
    elif dry_run:
        print(f"\n  [DRY RUN] Would write {len(updates)} classifications")

    return dict(counts)


def main():
    parser = argparse.ArgumentParser(description="Classify donations by industry")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument(
        "--table",
        choices=["donations", "individual_donations", "both"],
        default="both",
        help="Which table(s) to classify",
    )
    args = parser.parse_args()

    tables = []
    if args.table in ("donations", "both"):
        tables.append("donations")
    if args.table in ("individual_donations", "both"):
        tables.append("individual_donations")

    total_counts: Counter[str] = Counter()
    for table in tables:
        counts = classify_table(table, dry_run=args.dry_run)
        total_counts.update(counts)

    if len(tables) > 1:
        print(f"\n{'='*60}")
        print(f"COMBINED TOTALS")
        print(f"{'='*60}")
        total = sum(total_counts.values())
        print(f"  Total classified: {total}")
        for industry, count in total_counts.most_common():
            label = INDUSTRY_LABELS.get(industry, industry)
            print(f"    {label:30s} {count:>6d}")


if __name__ == "__main__":
    main()
