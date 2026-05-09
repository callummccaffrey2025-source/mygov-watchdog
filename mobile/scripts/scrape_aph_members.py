#!/usr/bin/env python3
"""
scrape_aph_members.py — LLM-powered APH member profile backfill using ScrapeGraphAI.

Fixes the 77 members missing aph_id by scraping APH parliamentarian pages.
Extracts: aph_id (MPID), photo_url, committee_memberships, ministerial_role.

Run:
  python scripts/scrape_aph_members.py [--dry-run]
"""
import os
import sys
import re
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
}

APH_SEARCH_URL = "https://www.aph.gov.au/Senators_and_Members/Parliamentarian?MPID={mpid}"
APH_NAME_SEARCH = "https://www.aph.gov.au/Senators_and_Members/Parliamentarian_Search_Results?expand=1&q={name}&mem=1&par=-1&gen=0&ps=0&st=1"

SEARCH_PROMPT = """
Extract the parliamentarian's profile link from this search results page.
Return:
- name: their full name
- url: absolute URL to their APH profile page (contains /Parliamentarian?MPID=)

Return as a JSON object. Only include the best matching result.
"""

PROFILE_PROMPT = """
Extract the following from this Australian Parliament member profile page:
- aph_id: the MPID from the URL (e.g. "R36", "282169")
- full_name: their full name
- photo_url: absolute URL to their official photo/headshot image
- ministerial_role: current ministerial or shadow ministerial title, or null
- committees: list of committee names they're a member of
- electorate: their electorate name
- party: their party name
- chamber: "House" or "Senate"

Return as a JSON object. Only extract what's actually on the page.
"""


def search_member(first_name: str, last_name: str) -> str | None:
    """Search APH for a member by name, return profile URL."""
    import urllib.parse
    query = f"{first_name} {last_name}"
    url = APH_NAME_SEARCH.format(name=urllib.parse.quote(query))
    try:
        scraper = SmartScraperGraph(
            prompt=SEARCH_PROMPT, source=url, config=GRAPH_CONFIG
        )
        result = scraper.run()
        if isinstance(result, dict):
            # Check direct or wrapped
            for key in [None, "content", "result", "data"]:
                obj = result if key is None else result.get(key, {})
                if isinstance(obj, dict) and obj.get("url"):
                    profile_url = obj["url"]
                    if "Parliamentarian" in profile_url or "MPID" in profile_url:
                        return profile_url
        return None
    except Exception as e:
        log.error("Search failed for %s %s: %s", first_name, last_name, e)
        return None


def extract_profile(url: str) -> dict | None:
    """Extract structured profile data from a single member page."""
    try:
        scraper = SmartScraperGraph(
            prompt=PROFILE_PROMPT, source=url, config=GRAPH_CONFIG
        )
        result = scraper.run()
        if isinstance(result, dict):
            if result.get("full_name") or result.get("aph_id"):
                return result
            for key in ("content", "profile", "member", "data"):
                if key in result and isinstance(result[key], dict):
                    return result[key]
        return None
    except Exception as e:
        log.error("Failed to extract profile from %s: %s", url, e)
        return None


def main():
    dry_run = "--dry-run" in sys.argv

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Get members missing aph_id
    r = sb.table("members").select("id,first_name,last_name,aph_id,is_active").eq("is_active", True).execute()
    all_members = r.data or []
    missing = [m for m in all_members if not m.get("aph_id")]

    print(f"\n═══════════════ APH MEMBER BACKFILL ═══════════════")
    print(f"Total active members: {len(all_members)}")
    print(f"Missing aph_id: {len(missing)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    limit = 54
    for i, arg in enumerate(sys.argv):
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    if not missing:
        print("All members have aph_id — nothing to do.")
        return

    updated = 0
    not_found = 0

    for member in missing[:limit]:
        first = member["first_name"]
        last = member["last_name"]
        print(f"\n→ {first} {last}")

        # Search APH by name
        profile_url = search_member(first, last)
        if not profile_url:
            print(f"  ✗ Not found on APH")
            not_found += 1
            continue

        print(f"  Found: {profile_url}")

        # Extract profile data
        profile = extract_profile(profile_url)
        if not profile:
            print(f"  ✗ Could not extract profile")
            not_found += 1
            continue

        update = {}
        if profile.get("aph_id"):
            update["aph_id"] = str(profile["aph_id"])
        if profile.get("photo_url"):
            update["photo_url"] = profile["photo_url"]
        if profile.get("ministerial_role"):
            update["ministerial_role"] = profile["ministerial_role"]
        if profile.get("committees"):
            update["committee_memberships"] = profile["committees"]

        if not update:
            print(f"  – No new data extracted")
            continue

        if dry_run:
            print(f"  [DRY] Would update: {json.dumps(update, indent=2)[:200]}")
            updated += 1
        else:
            try:
                sb.table("members").update(update).eq("id", member["id"]).execute()
                print(f"  ✓ Updated: {list(update.keys())}")
                updated += 1
            except Exception as e:
                log.warning("Update failed for %s: %s", member["id"], e)

    print(f"\n═══════════════ SUMMARY ═══════════════")
    print(f"  Updated:    {updated}")
    print(f"  Not found:  {not_found}")
    print(f"════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
