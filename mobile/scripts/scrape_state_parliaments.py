#!/usr/bin/env python3
"""
scrape_state_parliaments.py — LLM-powered state parliament scraper using ScrapeGraphAI.

Expands beyond NSW to VIC, QLD, WA, SA, TAS parliaments.
Extracts members and recent bills, writes to state_members and state_bills tables.

Run:
  python scripts/scrape_state_parliaments.py [--dry-run] [--state VIC]
"""
import os
import sys
import json
import logging

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

try:
    from scrapegraphai.graphs import SmartScraperGraph
except ImportError:
    sys.exit("ERROR: pip install scrapegraphai playwright && playwright install chromium")


GRAPH_CONFIG = {
    "llm": {
        "model": "anthropic/claude-haiku-4-5-20251001",
        "api_key": os.environ.get("ANTHROPIC_API_KEY", ""),
    },
    "verbose": False,
    "headless": True,
    "browser_config": {
        "wait_until": "networkidle",
        "timeout": 60000,
    },
}

# State parliament data sources — prefer open data/APIs over SPA scraping
# Many state parliaments have JS-rendered pages that return empty HTML.
# Wikipedia lists are a reliable fallback with structured data.
STATES = {
    "VIC": {
        "name": "Victoria",
        "members_url": "https://en.wikipedia.org/wiki/Members_of_the_59th_Victorian_Parliament",
        "bills_url": "https://www.legislation.vic.gov.au/bills",
    },
    "QLD": {
        "name": "Queensland",
        "members_url": "https://en.wikipedia.org/wiki/Members_of_the_58th_Queensland_Parliament",
        "bills_url": "https://www.legislation.qld.gov.au/browse/inprogress",
    },
    "WA": {
        "name": "Western Australia",
        "members_url": "https://en.wikipedia.org/wiki/Members_of_the_41st_Parliament_of_Western_Australia",
        "bills_url": "https://www.parliament.wa.gov.au/parliament/bills.nsf/BillProgressPopup?OpenForm",
    },
    "SA": {
        "name": "South Australia",
        "members_url": "https://en.wikipedia.org/wiki/Members_of_the_55th_South_Australian_Parliament",
        "bills_url": "https://www.parliament.sa.gov.au/legislation/bills",
    },
    "TAS": {
        "name": "Tasmania",
        "members_url": "https://en.wikipedia.org/wiki/Members_of_the_50th_Tasmanian_Parliament",
        "bills_url": "https://www.parliament.tas.gov.au/ParliamentSearch?type=Bill",
    },
}

MEMBERS_PROMPT = """
Extract all current members of parliament from this page.
For each member return:
- name: full name
- electorate: their electorate/district/region
- party: their political party
- chamber: "Lower House" or "Upper House" (or "Legislative Assembly" / "Legislative Council")
- photo_url: URL to their photo if available, or null

Return as a JSON array. Only include current sitting members.
"""

BILLS_PROMPT = """
Extract the 10 most recent bills from this page.
For each bill return:
- title: the bill's full title
- status: current status (e.g. "Introduced", "Second Reading", "Passed", "Royal Assent")
- date_introduced: date introduced in ISO format (YYYY-MM-DD), or null
- chamber: which chamber it was introduced in, or null
- url: link to the bill's detail page if available, or null

Return as a JSON array. Only include actual bills, not navigation links.
"""


def extract_members(url: str) -> list[dict]:
    """Extract member list from a state parliament page."""
    try:
        scraper = SmartScraperGraph(
            prompt=MEMBERS_PROMPT, source=url, config=GRAPH_CONFIG
        )
        result = scraper.run()
        if isinstance(result, dict):
            for key in ("content", "members", "results", "data"):
                if key in result and isinstance(result[key], list):
                    return [m for m in result[key] if isinstance(m, dict) and m.get("name")]
        if isinstance(result, list):
            return [m for m in result if isinstance(m, dict) and m.get("name")]
        return []
    except Exception as e:
        log.error("Members extraction failed for %s: %s", url, e)
        return []


def extract_bills(url: str) -> list[dict]:
    """Extract recent bills from a state parliament page."""
    try:
        scraper = SmartScraperGraph(
            prompt=BILLS_PROMPT, source=url, config=GRAPH_CONFIG
        )
        result = scraper.run()
        if isinstance(result, dict):
            for key in ("content", "bills", "results", "data"):
                if key in result and isinstance(result[key], list):
                    return [b for b in result[key] if isinstance(b, dict) and b.get("title")]
        if isinstance(result, list):
            return [b for b in result if isinstance(b, dict) and b.get("title")]
        return []
    except Exception as e:
        log.error("Bills extraction failed for %s: %s", url, e)
        return []


def main():
    dry_run = "--dry-run" in sys.argv
    target_state = None
    for i, arg in enumerate(sys.argv):
        if arg == "--state" and i + 1 < len(sys.argv):
            target_state = sys.argv[i + 1].upper()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    states_to_scrape = {target_state: STATES[target_state]} if target_state and target_state in STATES else STATES

    print(f"\n═══════════════ STATE PARLIAMENT SCRAPER ═══════════════")
    print(f"States: {', '.join(states_to_scrape.keys())}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    total_members = 0
    total_bills = 0

    for state_code, state_info in states_to_scrape.items():
        print(f"\n{'─' * 50}")
        print(f"→ {state_info['name']} ({state_code})")

        # Extract members
        print(f"  Scraping members from {state_info['members_url']}")
        members = extract_members(state_info["members_url"])
        print(f"  Found {len(members)} members")

        for member in members:
            row = {
                "full_name": member["name"],
                "state": state_code,
                "electorate": member.get("electorate"),
                "party": member.get("party"),
                "chamber": member.get("chamber"),
                "photo_url": member.get("photo_url"),
                "is_active": True,
            }

            if dry_run:
                if total_members < 3:  # Only print first few
                    print(f"    [DRY] {row['full_name']} ({row['party']}) - {row['electorate']}")
            else:
                try:
                    sb.table("state_members").upsert(
                        row, on_conflict="full_name,state"
                    ).execute()
                except Exception as e:
                    log.warning("Member upsert failed: %s", e)
            total_members += 1

        if len(members) > 3 and dry_run:
            print(f"    ... and {len(members) - 3} more")

        # Extract bills
        print(f"  Scraping bills from {state_info['bills_url']}")
        bills = extract_bills(state_info["bills_url"])
        print(f"  Found {len(bills)} bills")

        for bill in bills:
            row = {
                "title": bill["title"],
                "state": state_code,
                "status": bill.get("status"),
                "date_introduced": bill.get("date_introduced"),
                "chamber": bill.get("chamber"),
                "url": bill.get("url"),
            }

            if dry_run:
                if total_bills < 3:
                    print(f"    [DRY] {row['title'][:70]}")
            else:
                try:
                    sb.table("state_bills").upsert(
                        row, on_conflict="title,state"
                    ).execute()
                except Exception as e:
                    log.warning("Bill upsert failed: %s", e)
            total_bills += 1

        if len(bills) > 3 and dry_run:
            print(f"    ... and {len(bills) - 3} more")

    print(f"\n═══════════════ SUMMARY ═══════════════")
    print(f"  Members extracted: {total_members}")
    print(f"  Bills extracted:   {total_bills}")
    print(f"════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
