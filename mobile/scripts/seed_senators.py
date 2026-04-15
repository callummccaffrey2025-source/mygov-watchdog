#!/usr/bin/env python3
"""
seed_senators.py — Hardcode all 76 current Australian Senators into the members table.

Data sourced from Wikipedia "Members of the Australian Senate, 2025–2028".
APH website ignores the st=2 chamber filter so scraping is not possible.

Upserts on (first_name, last_name, chamber). Idempotent.
"""
import logging
import os
import sys
import time

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# state abbreviation → full name matching the electorates table rows
STATE_ELECTORATE: dict[str, str] = {
    "NSW": "New South Wales",
    "VIC": "Victoria",
    "QLD": "Queensland",
    "WA":  "Western Australia",
    "SA":  "South Australia",
    "TAS": "Tasmania",
    "ACT": "Australian Capital Territory",
    "NT":  "Northern Territory",
}

# (first_name, last_name, party_name, state)
# party_name is matched fuzzy against the parties table at runtime
SENATORS: list[tuple[str, str, str, str]] = [
    # ── ALP (29) ──────────────────────────────────────────────────────────
    ("Tim",          "Ayres",              "Australian Labor Party", "NSW"),
    ("Deborah",      "O'Neill",            "Australian Labor Party", "NSW"),
    ("Tony",         "Sheldon",            "Australian Labor Party", "NSW"),
    ("Jenny",        "McAllister",         "Australian Labor Party", "NSW"),
    ("Raff",         "Ciccone",            "Australian Labor Party", "VIC"),
    ("Lisa",         "Darmanin",           "Australian Labor Party", "VIC"),
    ("Jana",         "Stewart",            "Australian Labor Party", "VIC"),
    ("Jess",         "Walsh",              "Australian Labor Party", "VIC"),
    ("Michelle",     "Ananda-Rajah",       "Australian Labor Party", "VIC"),
    ("Anthony",      "Chisholm",           "Australian Labor Party", "QLD"),
    ("Nita",         "Green",              "Australian Labor Party", "QLD"),
    ("Corinne",      "Mulholland",         "Australian Labor Party", "QLD"),
    ("Murray",       "Watt",               "Australian Labor Party", "QLD"),
    ("Don",          "Farrell",            "Australian Labor Party", "SA"),
    ("Karen",        "Grogan",             "Australian Labor Party", "SA"),
    ("Marielle",     "Smith",              "Australian Labor Party", "SA"),
    ("Charlotte",    "Walker",             "Australian Labor Party", "SA"),
    ("Penny",        "Wong",               "Australian Labor Party", "SA"),
    ("Dorinda",      "Cox",                "Australian Labor Party", "WA"),
    ("Varun",        "Ghosh",              "Australian Labor Party", "WA"),
    ("Sue",          "Lines",              "Australian Labor Party", "WA"),
    ("Glenn",        "Sterle",             "Australian Labor Party", "WA"),
    ("Ellie",        "Whiteaker",          "Australian Labor Party", "WA"),
    ("Carol",        "Brown",              "Australian Labor Party", "TAS"),
    ("Josh",         "Dolega",             "Australian Labor Party", "TAS"),
    ("Richard",      "Dowling",            "Australian Labor Party", "TAS"),
    ("Helen",        "Polley",             "Australian Labor Party", "TAS"),
    ("Katy",         "Gallagher",          "Australian Labor Party", "ACT"),
    ("Malarndirri",  "McCarthy",           "Australian Labor Party", "NT"),

    # ── Liberal (21) ──────────────────────────────────────────────────────
    ("Andrew",       "Bragg",              "Liberal Party",          "NSW"),
    ("Jessica",      "Collins",            "Liberal Party",          "NSW"),
    ("Maria",        "Kovacic",            "Liberal Party",          "NSW"),
    ("Dave",         "Sharma",             "Liberal Party",          "NSW"),
    ("Sarah",        "Henderson",          "Liberal Party",          "VIC"),
    ("Jane",         "Hume",               "Liberal Party",          "VIC"),
    ("James",        "Paterson",           "Liberal Party",          "VIC"),
    ("Paul",         "Scarr",              "Liberal Party",          "QLD"),
    ("Alex",         "Antic",              "Liberal Party",          "SA"),
    ("Kerrynne",     "Liddle",             "Liberal Party",          "SA"),
    ("Andrew",       "McLachlan",          "Liberal Party",          "SA"),
    ("Anne",         "Ruston",             "Liberal Party",          "SA"),
    ("Leah",         "Blyth",              "Liberal Party",          "SA"),
    ("Slade",        "Brockman",           "Liberal Party",          "WA"),
    ("Michaelia",    "Cash",               "Liberal Party",          "WA"),
    ("Matt",         "O'Sullivan",         "Liberal Party",          "WA"),
    ("Dean",         "Smith",              "Liberal Party",          "WA"),
    ("Wendy",        "Askew",              "Liberal Party",          "TAS"),
    ("Claire",       "Chandler",           "Liberal Party",          "TAS"),
    ("Richard",      "Colbeck",            "Liberal Party",          "TAS"),
    ("Jonathon",     "Duniam",             "Liberal Party",          "TAS"),

    # ── Greens (10) ───────────────────────────────────────────────────────
    ("Mehreen",      "Faruqi",             "Australian Greens",      "NSW"),
    ("David",        "Shoebridge",         "Australian Greens",      "NSW"),
    ("Steph",        "Hodgins-May",        "Australian Greens",      "VIC"),
    ("Penny",        "Allman-Payne",       "Australian Greens",      "QLD"),
    ("Larissa",      "Waters",             "Australian Greens",      "QLD"),
    ("Sarah",        "Hanson-Young",       "Australian Greens",      "SA"),
    ("Barbara",      "Pocock",             "Australian Greens",      "SA"),
    ("Jordon",       "Steele-John",        "Australian Greens",      "WA"),
    ("Nick",         "McKim",              "Australian Greens",      "TAS"),
    ("Peter",        "Whish-Wilson",       "Australian Greens",      "TAS"),

    # ── Nationals / LNP (5) ───────────────────────────────────────────────
    ("Ross",         "Cadell",             "The Nationals",          "NSW"),
    ("Bridget",      "McKenzie",           "The Nationals",          "VIC"),
    ("Matthew",      "Canavan",            "The Nationals",          "QLD"),
    ("James",        "McGrath",            "The Nationals",          "QLD"),
    ("Susan",        "McDonald",           "The Nationals",          "QLD"),

    # ── One Nation (4) ────────────────────────────────────────────────────
    ("Sean",         "Bell",               "One Nation",             "NSW"),
    ("Pauline",      "Hanson",             "One Nation",             "QLD"),
    ("Malcolm",      "Roberts",            "One Nation",             "QLD"),
    ("Tyron",        "Whitten",            "One Nation",             "WA"),

    # ── Crossbench (7) ────────────────────────────────────────────────────
    ("Ralph",        "Babet",              "United Australia Party", "VIC"),
    ("Lidia",        "Thorpe",             "Independent",            "VIC"),
    ("Jacqui",       "Lambie",             "Jacqui Lambie Network",  "TAS"),
    ("Tammy",        "Tyrrell",            "Independent",            "TAS"),
    ("David",        "Pocock",             "Independent",            "ACT"),
    ("Fatima",       "Payman",             "Australia's Voice",      "WA"),
    ("Jacinta Nampijinpa", "Price",        "Country Liberal Party",  "NT"),
]


def resolve_party_id(db, party_name: str, cache: dict) -> str | None:
    if not party_name or party_name == "Independent":
        return None
    if party_name in cache:
        return cache[party_name]

    result = db.table("parties").select("id, name, short_name").execute()
    for row in result.data:
        for field in (row.get("name", ""), row.get("short_name", "") or ""):
            if field and (
                field.lower() in party_name.lower()
                or party_name.lower() in field.lower()
            ):
                cache[party_name] = row["id"]
                log.debug("  Party %r → %s (%s)", party_name, row["name"], row["id"])
                return row["id"]

    log.warning("  No party match for %r", party_name)
    cache[party_name] = None
    return None


def resolve_electorate_id(db, state: str, cache: dict) -> str | None:
    electorate_name = STATE_ELECTORATE.get(state)
    if not electorate_name:
        return None
    if electorate_name in cache:
        return cache[electorate_name]

    result = (
        db.table("electorates")
        .select("id")
        .ilike("name", electorate_name)
        .execute()
    )
    if result.data:
        cache[electorate_name] = result.data[0]["id"]
        return result.data[0]["id"]

    log.warning("  No electorate row for state %r (%r)", state, electorate_name)
    cache[electorate_name] = None
    return None


def main() -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_KEY")
        sys.exit(1)

    db = create_client(url, key)

    party_cache: dict = {}
    electorate_cache: dict = {}
    rows = []

    for first, last, party_name, state in SENATORS:
        rows.append({
            "first_name":    first,
            "last_name":     last,
            "chamber":       "senate",
            "level":         "federal",
            "is_active":     True,
            "party_id":      resolve_party_id(db, party_name, party_cache),
            "electorate_id": resolve_electorate_id(db, state, electorate_cache),
        })

    BATCH = 50
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        result = (
            db.table("members")
            .upsert(batch, on_conflict="first_name,last_name,chamber")
            .execute()
        )
        total += len(result.data)
        log.info("Batch %d/%d — %d upserted", i // BATCH + 1, -(-len(rows) // BATCH), len(result.data))
        time.sleep(0.2)

    log.info("Done. %d senators upserted.", total)

    # Report new total
    count_result = (
        db.table("members")
        .select("id", count="exact", head=True)
        .eq("is_active", True)
        .execute()
    )
    log.info("Total active members in DB: %d", count_result.count or 0)


if __name__ == "__main__":
    main()
