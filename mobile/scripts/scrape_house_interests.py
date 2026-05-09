#!/usr/bin/env python3
"""
scrape_house_interests.py — LLM-powered House of Reps registered interests scraper.

Senate interests are already ingested via API (1,753 rows).
House members only publish PDFs on APH. This script uses ScrapeGraphAI to:
  1. Find the PDF links for House member interest declarations
  2. Extract structured interest data from the PDFs

Writes to: registered_interests table (same schema as Senate data)

Run:
  python scripts/scrape_house_interests.py [--dry-run] [--limit 10]
"""
import os
import sys
import json
import logging
import tempfile
import urllib.request

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

# APH Register of Interests page for House members
REGISTER_URL = "https://www.aph.gov.au/Parliamentary_Business/Committees/House_of_Representatives_Committees/Register"

LISTING_PROMPT = """
Extract all links to individual member interest declarations/registers from this page.
For each member return:
- name: the member's full name
- pdf_url: absolute URL to their declaration PDF or page

Return as a JSON array. Only include links to actual member declarations.
"""

# For PDF content extraction, we use the document scraper approach
PDF_PROMPT = """
Extract all registered interests/declarations from this document.
Group them by category. For each interest item return:
- category: the category name (e.g. "Shareholdings", "Real Estate", "Directorships",
  "Partnerships", "Trusts", "Investments", "Gifts", "Travel", "Other")
- description: a concise description of the declared interest

Return as a JSON array of objects with "category" and "description" fields.
Only extract what is explicitly declared — never fabricate entries.
"""


def find_member_pdfs() -> list[dict]:
    """Find PDF links for House member interest declarations."""
    try:
        scraper = SmartScraperGraph(
            prompt=LISTING_PROMPT, source=REGISTER_URL, config=GRAPH_CONFIG
        )
        result = scraper.run()
        if isinstance(result, dict):
            for key in ("content", "members", "results", "data", "declarations"):
                if key in result and isinstance(result[key], list):
                    return [m for m in result[key] if isinstance(m, dict) and m.get("pdf_url")]
        if isinstance(result, list):
            return [m for m in result if isinstance(m, dict) and m.get("pdf_url")]
        return []
    except Exception as e:
        log.error("Failed to find member PDFs: %s", e)
        return []


def extract_interests_from_pdf(pdf_url: str) -> list[dict]:
    """Download PDF and extract interests using ScrapeGraphAI."""
    try:
        # Download PDF to temp file
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        urllib.request.urlretrieve(pdf_url, tmp.name)
        tmp.close()

        scraper = SmartScraperGraph(
            prompt=PDF_PROMPT,
            source=tmp.name,
            config=GRAPH_CONFIG,
        )
        result = scraper.run()

        os.unlink(tmp.name)

        if isinstance(result, dict):
            for key in ("content", "interests", "results", "data", "declarations"):
                if key in result and isinstance(result[key], list):
                    return result[key]
        if isinstance(result, list):
            return result
        return []
    except Exception as e:
        log.error("PDF extraction failed for %s: %s", pdf_url, e)
        try:
            os.unlink(tmp.name)
        except Exception:
            pass
        return []


def main():
    dry_run = "--dry-run" in sys.argv
    limit = 999
    for i, arg in enumerate(sys.argv):
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Get House members for matching
    r = sb.table("members").select("id,first_name,last_name,chamber").eq("is_active", True).execute()
    house_members = [m for m in (r.data or []) if m.get("chamber") in ("House", "house", "representatives")]

    # Build name lookup
    name_to_member = {}
    for m in house_members:
        full = f"{m['first_name']} {m['last_name']}".lower().strip()
        name_to_member[full] = m
        # Also just last name for fuzzy matching
        name_to_member[m['last_name'].lower()] = m

    print(f"\n═══════════════ HOUSE REGISTERED INTERESTS SCRAPER ═══════════════")
    print(f"House members in DB: {len(house_members)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Limit: {limit}")

    # Step 1: Find PDFs
    print(f"\nFinding member declaration PDFs from APH...")
    member_pdfs = find_member_pdfs()
    print(f"Found {len(member_pdfs)} member declarations")

    inserted = 0
    processed = 0

    for entry in member_pdfs[:limit]:
        name = entry.get("name", "")
        pdf_url = entry.get("pdf_url", "")
        if not name or not pdf_url:
            continue

        # Match to DB member
        name_lower = name.lower().strip()
        member = name_to_member.get(name_lower)
        if not member:
            # Try last name only
            parts = name.split()
            if parts:
                member = name_to_member.get(parts[-1].lower())
        if not member:
            log.info("No DB match for: %s", name)
            continue

        processed += 1
        member_name = f"{member['first_name']} {member['last_name']}"
        print(f"\n→ {member_name}: {pdf_url}")

        # Step 2: Extract from PDF
        interests = extract_interests_from_pdf(pdf_url)
        if not interests:
            print(f"  ✗ No interests extracted")
            continue

        print(f"  Found {len(interests)} interest declarations")

        for interest in interests:
            category = interest.get("category", "Other")
            description = interest.get("description", "")
            if not description or len(description) < 5:
                continue

            row = {
                "member_id": member["id"],
                "category": category,
                "description": description[:1000],
                "source_url": pdf_url,
            }

            if dry_run:
                if inserted < 5:
                    print(f"    [DRY] {category}: {description[:60]}")
                inserted += 1
            else:
                try:
                    sb.table("registered_interests").insert(row).execute()
                    inserted += 1
                except Exception as e:
                    log.warning("Insert failed: %s", e)

        if len(interests) > 5 and dry_run:
            print(f"    ... and {len(interests) - 5} more")

    print(f"\n═══════════════ SUMMARY ═══════════════")
    print(f"  Members processed:    {processed}")
    print(f"  Interests inserted:   {inserted}")
    print(f"════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
