#!/usr/bin/env python3
"""
scrape_party_policies.py — LLM-powered party policy scraper using ScrapeGraphAI.

Scrapes actual party platform pages to supplement/replace seed_party_policies_manual.py.
Sources: official party websites (Labor, Liberal, Greens, Nationals, One Nation).

Writes to: party_policies table (upsert on party_id + category)

Run:
  python scripts/scrape_party_policies.py [--dry-run]
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
}

# Party platform/policy pages
PARTIES = [
    {
        "name": "Australian Labor Party",
        "short": "Labor",
        "urls": [
            "https://www.alp.org.au/policies",
            "https://www.alp.org.au/we-stand-for",
        ],
    },
    {
        "name": "Liberal Party of Australia",
        "short": "Liberal",
        "urls": [
            "https://www.liberal.org.au/our-plan",
            "https://www.liberal.org.au/our-beliefs",
        ],
    },
    {
        "name": "Australian Greens",
        "short": "Greens",
        "urls": [
            "https://greens.org.au/policies",
            "https://greens.org.au/platform",
        ],
    },
    {
        "name": "The Nationals",
        "short": "Nationals",
        "urls": [
            "https://www.nationals.org.au/policies/",
            "https://www.nationals.org.au/our-priorities/",
        ],
    },
    {
        "name": "Pauline Hanson's One Nation",
        "short": "One Nation",
        "urls": [
            "https://www.onenation.org.au/policies",
        ],
    },
]

POLICY_PROMPT = """
Extract all policy positions and platform commitments from this page.
Group them by topic category. For each policy area return:
- category: the policy topic (e.g. "Economy", "Healthcare", "Climate & Environment",
  "Housing", "Education", "Defence", "Immigration", "Infrastructure",
  "Indigenous Affairs", "Technology")
- summary: a factual 2-3 sentence summary of the party's stated position on this topic
- key_commitments: list of specific policy commitments or promises (up to 5)

Return as a JSON array. Only extract what is explicitly stated on the page.
Do NOT editorialize or add interpretation — just summarize their stated positions.
"""


# Map LLM-extracted categories to DB-allowed values
CATEGORY_MAP = {
    "healthcare": "healthcare", "health": "healthcare", "medicare": "healthcare",
    "housing": "housing", "homes": "housing",
    "economy": "economy", "economic": "economy", "finance": "economy", "tax": "economy",
    "climate": "climate", "climate & environment": "climate", "environment": "climate", "energy": "climate",
    "education": "education", "schools": "education", "universities": "education",
    "defence": "defence", "defense": "defence", "national security": "defence", "military": "defence",
    "immigration": "immigration", "migration": "immigration", "refugees": "immigration",
    "cost of living": "cost_of_living", "cost_of_living": "cost_of_living", "living costs": "cost_of_living",
}

ALLOWED_CATEGORIES = {"climate", "cost_of_living", "defence", "economy", "education", "healthcare", "housing", "immigration"}


def normalize_category(raw: str) -> str | None:
    """Map an LLM-extracted category to an allowed DB value."""
    lower = raw.lower().strip()
    if lower in ALLOWED_CATEGORIES:
        return lower
    if lower in CATEGORY_MAP:
        return CATEGORY_MAP[lower]
    # Fuzzy match
    for key, val in CATEGORY_MAP.items():
        if key in lower or lower in key:
            return val
    return None


def extract_policies(url: str) -> list[dict]:
    """Extract policy positions from a party platform page."""
    try:
        scraper = SmartScraperGraph(
            prompt=POLICY_PROMPT, source=url, config=GRAPH_CONFIG
        )
        result = scraper.run()
        if isinstance(result, dict):
            for key in ("content", "policies", "results", "data", "platform"):
                if key in result and isinstance(result[key], list):
                    return [p for p in result[key] if isinstance(p, dict) and p.get("category")]
        if isinstance(result, list):
            return [p for p in result if isinstance(p, dict) and p.get("category")]
        return []
    except Exception as e:
        log.error("Policy extraction failed for %s: %s", url, e)
        return []


def main():
    dry_run = "--dry-run" in sys.argv

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Get party IDs from DB
    r = sb.table("parties").select("id,name,short_name").execute()
    parties_db = {p["name"].lower(): p for p in (r.data or [])}
    # Also index by short name
    for p in (r.data or []):
        if p.get("short_name"):
            parties_db[p["short_name"].lower()] = p

    print(f"\n═══════════════ PARTY POLICY SCRAPER ═══════════════")
    print(f"Parties in DB: {len(r.data or [])}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    total_policies = 0

    for party in PARTIES:
        print(f"\n{'─' * 50}")
        print(f"→ {party['name']}")

        # Find party ID
        party_record = (
            parties_db.get(party["name"].lower())
            or parties_db.get(party["short"].lower())
        )
        if not party_record:
            print(f"  ✗ Party not found in DB, skipping")
            continue

        party_id = party_record["id"]
        all_policies = []

        for url in party["urls"]:
            print(f"  Scraping: {url}")
            policies = extract_policies(url)
            print(f"  Found {len(policies)} policy areas")
            all_policies.extend(policies)

        # Deduplicate by category (keep the richer one)
        by_category = {}
        for p in all_policies:
            cat = p["category"]
            existing = by_category.get(cat)
            if not existing or len(p.get("summary", "")) > len(existing.get("summary", "")):
                by_category[cat] = p

        print(f"  Total unique policy areas: {len(by_category)}")

        for category, policy in by_category.items():
            summary = policy.get("summary", "")
            commitments = policy.get("key_commitments", [])
            if not summary:
                continue

            # Map category to allowed DB value
            db_category = normalize_category(category)
            if not db_category:
                log.info("Skipping unmapped category: %s", category)
                continue

            # Build content: summary + bullet commitments
            content = summary
            if commitments:
                content += "\n\nKey commitments:\n" + "\n".join(f"• {c}" for c in commitments[:5])

            row = {
                "party_id": party_id,
                "category": db_category,
                "summary_plain": content[:2000],
                "source_url": party["urls"][0],
            }

            if dry_run:
                if total_policies < 5:
                    print(f"    [DRY] {category}: {summary[:80]}")
                total_policies += 1
            else:
                try:
                    sb.table("party_policies").upsert(
                        row, on_conflict="party_id,category"
                    ).execute()
                    total_policies += 1
                except Exception as e:
                    log.warning("Upsert failed for %s/%s: %s", party["short"], category, e)

        if len(by_category) > 5 and dry_run:
            print(f"    ... and {len(by_category) - 5} more")

    print(f"\n═══════════════ SUMMARY ═══════════════")
    print(f"  Policies upserted: {total_policies}")
    print(f"════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
