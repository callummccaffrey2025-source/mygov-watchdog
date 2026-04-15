#!/usr/bin/env python3
"""
map_postcodes.py — Map Australian postcodes to federal electorates.

Downloads the ABS ASGS Correspondence file (POA → CED) and updates
the `electorates.postcodes` column in Supabase.

Source:
  ABS ASGS Edition 3 correspondence files:
  https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/
  jul2021-jun2026/access-and-downloads/correspondence-files

Fallback: AEC polling places CSV (includes postcode field).

Idempotent: re-running overwrites postcodes arrays.
"""

import csv
import io
import logging
import os
import re
import sys
import time
import zipfile
from collections import defaultdict

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Verity-App/1.0 (civic data; contact@verity.au)"}

# ABS correspondence file: Postal Area (POA) → Commonwealth Electoral Division (CED)
ABS_CORR_URL = (
    "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/"
    "jul2021-jun2026/access-and-downloads/correspondence-files/"
    "CG_POA_2021_CED_2021.csv"
)

# Fallback: AEC polling places (has postcode + division name)
AEC_POLLING_URL = (
    "https://www.aec.gov.au/Elections/Federal_Elections/2022/files/polling-places.csv"
)

# Community-maintained CSV as second fallback
COMMUNITY_URL = (
    "https://raw.githubusercontent.com/matthewproctor/"
    "australianpostcodes/master/australian_postcodes.csv"
)


def fetch_abs_correspondence() -> dict[str, list[str]]:
    """
    Returns {electorate_name: [postcode, ...]} from the ABS POA→CED file.
    """
    log.info("Downloading ABS POA→CED correspondence...")
    try:
        resp = requests.get(ABS_CORR_URL, headers=HEADERS, timeout=60)
        resp.raise_for_status()
    except Exception as exc:
        log.warning("ABS download failed: %s", exc)
        return {}

    electorate_postcodes: dict[str, list[str]] = defaultdict(list)
    reader = csv.DictReader(io.StringIO(resp.text))
    for row in reader:
        postcode = (row.get("POA_CODE_2021") or row.get("POA_CODE") or "").strip().lstrip("POA")
        electorate = (row.get("CED_NAME_2021") or row.get("CED_NAME") or "").strip()
        ratio = float(row.get("RATIO", row.get("ratio", "1")) or 1)
        if postcode and electorate and ratio > 0.1:
            electorate_postcodes[electorate].append(postcode)

    log.info("ABS: %d electorates mapped.", len(electorate_postcodes))
    return electorate_postcodes


def fetch_aec_polling_places() -> dict[str, list[str]]:
    """
    Fallback: AEC polling places CSV maps polling place → division + postcode.
    """
    log.info("Downloading AEC polling places (fallback)...")
    try:
        resp = requests.get(AEC_POLLING_URL, headers=HEADERS, timeout=60)
        resp.raise_for_status()
        text = resp.text
    except Exception as exc:
        log.warning("AEC download failed: %s", exc)
        return {}

    electorate_postcodes: dict[str, list[str]] = defaultdict(list)
    # Skip preamble rows until we find the header
    lines = text.splitlines()
    header_idx = next((i for i, l in enumerate(lines) if "DivisionNm" in l or "Division" in l), 0)
    reader = csv.DictReader(lines[header_idx:])

    for row in reader:
        division = (row.get("DivisionNm") or row.get("Division") or "").strip()
        postcode = (row.get("Postcode") or row.get("PostCode") or "").strip()
        if division and postcode and re.match(r"^\d{4}$", postcode):
            electorate_postcodes[division].append(postcode)

    # Deduplicate postcodes per electorate
    return {k: sorted(set(v)) for k, v in electorate_postcodes.items()}


def fetch_community_postcodes() -> dict[str, list[str]]:
    """Second fallback: community CSV from matthewproctor/australianpostcodes."""
    log.info("Downloading community postcodes CSV (second fallback)...")
    try:
        resp = requests.get(COMMUNITY_URL, headers=HEADERS, timeout=60)
        resp.raise_for_status()
    except Exception as exc:
        log.warning("Community CSV download failed: %s", exc)
        return {}

    electorate_postcodes: dict[str, list[str]] = defaultdict(list)
    reader = csv.DictReader(io.StringIO(resp.text))
    for row in reader:
        postcode = str(row.get("postcode") or "").strip()
        division = str(row.get("sa4") or row.get("electorate") or "").strip()
        if postcode and division:
            electorate_postcodes[division].append(postcode)

    return {k: sorted(set(v)) for k, v in electorate_postcodes.items()}


def main() -> None:
    db_url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(db_url, key)

    # Try sources in order
    mapping = fetch_abs_correspondence()
    if not mapping:
        mapping = fetch_aec_polling_places()
    if not mapping:
        mapping = fetch_community_postcodes()
    if not mapping:
        log.error("All postcode sources failed.")
        sys.exit(1)

    # Load existing electorates
    result = db.table("electorates").select("id, name").execute()
    electorates = {row["name"].strip(): row["id"] for row in result.data}
    log.info("Found %d electorates in DB.", len(electorates))

    updated = 0
    skipped = 0
    for electorate_name, postcodes in mapping.items():
        if not postcodes:
            continue
        # Try exact match, then case-insensitive
        eid = electorates.get(electorate_name)
        if not eid:
            lower = electorate_name.lower()
            for name, eid_candidate in electorates.items():
                if name.lower() == lower:
                    eid = eid_candidate
                    break

        if not eid:
            log.debug("No DB match for electorate %r", electorate_name)
            skipped += 1
            continue

        db.table("electorates").update({"postcodes": sorted(set(postcodes))}).eq("id", eid).execute()
        updated += 1
        time.sleep(0.05)

    log.info("Done. %d electorates updated, %d skipped (no DB match).", updated, skipped)


if __name__ == "__main__":
    main()
