#!/usr/bin/env python3
"""
ingest_registered_interests.py — Pull senators' declared financial interests
from the Senate Register of Interests public API.

Source: https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/
        Senators_Interests/Senators_Interests_Register

API base: https://pbs-apim-aqcdgxhvaug7f8em.z01.azurefd.net/api/

Phase 1: Senate (structured JSON API, 76 senators, 14 categories)
Phase 2: House (PDF parsing — TODO)

Maps to the `registered_interests` table:
  id (uuid), member_id (uuid FK), category (text), description (text),
  date_registered (date), source_url (text), created_at (timestamptz)

Idempotent: clears existing Senate interests before re-inserting.
"""

import logging
import os
import sys
import time
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

API_BASE = "https://pbs-apim-aqcdgxhvaug7f8em.z01.azurefd.net/api"
LIST_URL = f"{API_BASE}/queryStatements?currentPage=1&pageSize=100&sortBy=senator&sortDirection=ascending"
DETAIL_URL = f"{API_BASE}/getSenatorStatement?cdapid={{cdap_id}}"
REGISTER_URL = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Senators_Interests/Senators_Interests_Register"

HEADERS = {"User-Agent": "Verity-App/1.0 (civic data; contact@verity.au)"}

# Map Senate API category keys → human-readable names
# Keys match the actual API response from getSenatorStatement
CATEGORY_MAP = {
    "shareHoldings": "Shareholdings",
    "trusts": "Family & Business Trusts",
    "realEstate": "Real Estate",
    "registeredDirectorshipsOfCompanies": "Directorships",
    "partnerships": "Partnerships",
    "liabilities": "Liabilities",
    "investments": "Bonds, Debentures & Investments",
    "savingsOrInvestmentAccounts": "Savings & Investment Accounts",
    "otherAssets": "Other Assets",
    "otherIncome": "Other Income Sources",
    "gifts": "Gifts",
    "sponsoredTravelOrHospitality": "Sponsored Travel & Hospitality",
    "officeHolderDonating": "Office Holder / Financial Contributor",
    "otherInterest": "Other Interests",
}

# Per-category field mapping: which fields to extract for the description
CATEGORY_FIELDS = {
    "shareHoldings": [("nameOfCompany", None)],
    "trusts": [("nameOfTrust", None), ("natureOfInterest", "Interest")],
    "realEstate": [("location", "Location"), ("purposeForWhichOwned", "Purpose")],
    "registeredDirectorshipsOfCompanies": [("nameOfCompany", None), ("activitiesOfCompany", "Activities")],
    "partnerships": [("nameOfPartnership", None), ("natureOfInterest", "Interest"), ("activitiesOfPartnership", "Activities")],
    "liabilities": [("natureOfLiability", None), ("nameOfCreditor", "Creditor")],
    "investments": [("typeOfInvestment", None), ("bodyInWhichInvestmentHeld", "Body")],
    "savingsOrInvestmentAccounts": [("natureOfAccount", None), ("nameOfBankOrInstitution", "Institution")],
    "otherAssets": [("natureOfAsset", None)],
    "otherIncome": [("sourceOfIncome", None)],
    "gifts": [("detailOfGifts", None)],
    "sponsoredTravelOrHospitality": [("details", None)],
    "officeHolderDonating": [("nameOfOrganisation", None)],
    "otherInterest": [("details", None)],
}


def fetch_senator_list() -> list[dict]:
    """Fetch list of all senators with their cdapId."""
    resp = requests.get(LIST_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    senators = data.get("statementOfRegisterableInterests", data.get("data", []))
    log.info("Fetched %d senators from list endpoint.", len(senators))
    return senators


def fetch_senator_detail(cdap_id: str) -> dict:
    """Fetch full interest declaration for one senator."""
    url = DETAIL_URL.format(cdap_id=cdap_id)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_interest_rows(detail: dict, category_key: str) -> list[str]:
    """Extract description strings from a category in the senator detail response.

    The API returns each category as {"interests": [...], "alterations": [...]}.
    """
    rows = []
    category_data = detail.get(category_key)
    if not category_data or not isinstance(category_data, dict):
        return rows

    for item in category_data.get("interests", []):
        desc = _item_to_description(item, category_key)
        if desc:
            rows.append(desc)

    for alt in category_data.get("alterations", []):
        desc = _alteration_to_description(alt)
        if desc:
            rows.append(desc)

    return rows


def _item_to_description(item: dict, category_key: str) -> str:
    """Convert an API interest item to a description using per-category field mapping."""
    if not isinstance(item, dict):
        return ""

    fields = CATEGORY_FIELDS.get(category_key, [])
    parts = []
    for field_name, label in fields:
        val = item.get(field_name)
        if val and isinstance(val, str) and val.strip():
            if label:
                parts.append(f"{label}: {val.strip()}")
            else:
                parts.append(val.strip())

    if not parts:
        # Fallback: join all non-empty string values (skip UUIDs and IDs)
        import re as _re
        uuid_pat = _re.compile(r'^[0-9a-f]{8}-')
        vals = [str(v).strip() for v in item.values()
                if isinstance(v, str) and v.strip() and len(v.strip()) > 2
                and not uuid_pat.match(v.strip())]
        return "; ".join(vals[:3]) if vals else ""

    return " — ".join(parts)


def _alteration_to_description(alt: dict) -> str:
    """Convert an alteration record to a description string."""
    if not isinstance(alt, dict):
        return ""
    alt_type = alt.get("alterationType", "").strip()
    details = alt.get("details", "").strip()
    if not details:
        return ""
    prefix = f"[{alt_type}] " if alt_type else ""
    return f"{prefix}{details}"


def match_senator_to_member(db: Any, senator: dict, member_cache: dict) -> str | None:
    """Match a Senate API senator record to a members table row by name."""
    # API returns name as "Surname, Firstname" or similar
    name = senator.get("name", senator.get("senator", ""))
    if not name:
        return None

    # Normalise: "Surname, Firstname Middlename" → (first, last)
    if "," in name:
        parts = name.split(",", 1)
        last = parts[0].strip()
        first = parts[1].strip().split()[0] if parts[1].strip() else ""
    else:
        words = name.strip().split()
        first = words[0] if words else ""
        last = " ".join(words[1:]) if len(words) > 1 else ""

    cache_key = f"{first.lower()}|{last.lower()}"
    if cache_key in member_cache:
        return member_cache[cache_key]

    # Query members table
    result = (
        db.table("members")
        .select("id")
        .eq("chamber", "senate")
        .eq("is_active", True)
        .ilike("last_name", last)
        .execute()
    )

    if result.data:
        # If multiple matches, try first name
        if len(result.data) == 1:
            member_cache[cache_key] = result.data[0]["id"]
            return result.data[0]["id"]
        # Multiple senators with same last name — match on first name too
        for row in result.data:
            detail = db.table("members").select("id, first_name").eq("id", row["id"]).execute()
            if detail.data and detail.data[0]["first_name"].lower().startswith(first.lower()[:3]):
                member_cache[cache_key] = detail.data[0]["id"]
                return detail.data[0]["id"]
        # Fallback to first match
        member_cache[cache_key] = result.data[0]["id"]
        return result.data[0]["id"]

    # Fallback: try last word of multi-word surname (e.g., "Nampijinpa Price" → "Price")
    if " " in last:
        fallback_last = last.split()[-1]
        result2 = (
            db.table("members")
            .select("id, first_name")
            .eq("chamber", "senate")
            .eq("is_active", True)
            .ilike("last_name", fallback_last)
            .execute()
        )
        for row in result2.data:
            if first.lower() in row["first_name"].lower():
                member_cache[cache_key] = row["id"]
                log.info("Matched %s via fallback surname %r", name, fallback_last)
                return row["id"]

    log.warning("No member match for senator: %s (parsed: %s %s)", name, first, last)
    member_cache[cache_key] = None
    return None


def main() -> None:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)

    dry_run = "--dry-run" in sys.argv

    # Step 1: Fetch senator list
    senators = fetch_senator_list()
    if not senators:
        log.error("No senators returned from API. Exiting.")
        sys.exit(1)

    member_cache: dict = {}
    all_rows: list[dict] = []
    matched = 0
    unmatched = 0

    # Step 2: For each senator, fetch full declaration and extract interests
    for i, senator in enumerate(senators):
        cdap_id = senator.get("cdapId") or senator.get("cdapid") or senator.get("id")
        if not cdap_id:
            log.warning("Senator missing cdapId: %s", senator)
            continue

        name = senator.get("name", senator.get("senator", "unknown"))
        member_id = match_senator_to_member(db, senator, member_cache)

        if not member_id:
            unmatched += 1
            continue
        matched += 1

        # Fetch full detail
        try:
            detail = fetch_senator_detail(str(cdap_id))
        except Exception as exc:
            log.warning("Failed to fetch detail for %s (cdapId=%s): %s", name, cdap_id, exc)
            continue

        # Extract date_registered from lodgment date
        stmt = detail.get("senatorInterestStatement", {})
        date_registered = (
            senator.get("lodgmentDate", "")
            or stmt.get("lodgementDate", "")
            or senator.get("lastDateUpdated", "")
        )
        # Clean date — take just YYYY-MM-DD if it's a datetime string
        if date_registered and "T" in date_registered:
            date_registered = date_registered.split("T")[0]
        if not date_registered:
            date_registered = None

        # Extract interests from each category
        for api_key, category_name in CATEGORY_MAP.items():
            descriptions = extract_interest_rows(detail, api_key)
            for desc in descriptions:
                if not desc.strip():
                    continue
                all_rows.append({
                    "member_id": member_id,
                    "category": category_name,
                    "description": desc.strip()[:2000],  # Safety limit
                    "date_registered": date_registered,
                    "source_url": REGISTER_URL,
                })

        if (i + 1) % 10 == 0:
            log.info("Processed %d/%d senators (%d interests so far)...",
                     i + 1, len(senators), len(all_rows))
        time.sleep(0.3)  # Be polite to the API

    log.info("Extraction complete: %d senators matched, %d unmatched, %d interest rows.",
             matched, unmatched, len(all_rows))

    if dry_run:
        log.info("DRY RUN — not writing to database.")
        # Print sample
        for row in all_rows[:20]:
            log.info("  [%s] %s", row["category"], row["description"][:80])
        log.info("  ... (%d total rows)", len(all_rows))
        return

    if not all_rows:
        log.warning("No interests extracted. Exiting without changes.")
        return

    # Step 3: Clear existing Senate interests (members in senate chamber)
    senate_member_ids = [mid for mid in member_cache.values() if mid]
    if senate_member_ids:
        log.info("Clearing existing interests for %d matched senators...", len(senate_member_ids))
        for mid in senate_member_ids:
            db.table("registered_interests").delete().eq("member_id", mid).execute()

    # Step 4: Insert new rows in batches
    BATCH = 100
    total = 0
    for i in range(0, len(all_rows), BATCH):
        batch = all_rows[i:i + BATCH]
        result = db.table("registered_interests").insert(batch).execute()
        total += len(result.data)
        time.sleep(0.2)

    log.info("Done. %d interest rows inserted for %d senators.", total, matched)


if __name__ == "__main__":
    main()
