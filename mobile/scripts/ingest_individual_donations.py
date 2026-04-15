#!/usr/bin/env python3
"""
ingest_individual_donations.py — Load individual MP/candidate donation data
from AEC Transparency Register bulk CSV downloads into Supabase.

Two data sources:
  1. AllAnnualData.zip   → "Detailed Receipts.csv"
     MP/Senator annual return receipts. 8 independents/teals have filed these.
     Columns: Financial Year, Return Type, Recipient Name, Received From,
              Receipt Type, Value

  2. AllElectionsData.zip → "Senate Groups and Candidate Donations.csv"
     Election campaign donations to individual candidates (2004–2025).
     Columns: Event, Return Type, Name, Donor Name, Date Of Gift, Gift Value
     Note: Name is in "LASTNAME, Firstname" format.

Usage:
  python ingest_individual_donations.py [--zip-dir /tmp] [--download]
                                        [--annual-only] [--election-only]

  --zip-dir DIR      Directory containing the ZIP files (default: /tmp)
  --download         Download ZIP files from AEC before processing
  --annual-only      Only process AllAnnualData.zip
  --election-only    Only process AllElectionsData.zip

Requirements:
  pip install requests python-dotenv supabase
"""

import argparse
import csv
import io
import logging
import os
import re
import sys
import zipfile
from datetime import datetime
from difflib import SequenceMatcher
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

AEC_DOWNLOAD_BASE    = "https://transparency.aec.gov.au/Download"
ANNUAL_ZIP_URL       = f"{AEC_DOWNLOAD_BASE}/AllAnnualData"
ELECTION_ZIP_URL     = f"{AEC_DOWNLOAD_BASE}/AllElectionsData"
ANNUAL_ZIP_NAME      = "AllAnnualData.zip"
ELECTION_ZIP_NAME    = "AllElectionsData.zip"

# Parliamentary honorifics and titles to strip for name matching
_TITLE_RE = re.compile(
    r"\b(hon|dr|mr|ms|mrs|senator|mp|oam|am|ao|obe|kbe|ac|asc|apm|qc|sc|mbe|"
    r"phd|prof|rev|the)\b",
    re.IGNORECASE,
)


def normalise_name(name: str) -> str:
    """Lowercase, strip punctuation and titles for fuzzy comparison."""
    name = re.sub(r"[^a-z0-9 ]", "", name.lower())
    name = _TITLE_RE.sub("", name)
    return re.sub(r"\s+", " ", name).strip()


# Known AEC legal names → common parliamentary names (for MPs who use different names)
_NAME_ALIASES: dict[str, str] = {
    "katherine ella chaney": "kate chaney",
    "robert carl katter":    "bob katter",
    "robert carl b katter":  "bob katter",
    "kylea jane tink":       "kylea tink",
}


def match_member(recipient_name: str, members: list[dict]) -> Optional[str]:
    """
    Return member_id for the best fuzzy match, or None if below threshold 0.72.
    Tries both "Firstname Lastname" and "Lastname Firstname" orderings,
    and applies known legal→common name aliases before matching.
    """
    norm_target = normalise_name(recipient_name)
    if not norm_target:
        return None
    # Apply alias if known
    norm_target = _NAME_ALIASES.get(norm_target, norm_target)

    best_id = None
    best_score = 0.0

    for m in members:
        full     = normalise_name(f"{m['first_name']} {m['last_name']}")
        reversed_ = normalise_name(f"{m['last_name']} {m['first_name']}")
        for variant in [full, reversed_]:
            score = SequenceMatcher(None, norm_target, variant).ratio()
            if score > best_score:
                best_score = score
                best_id = m["id"]

    return best_id if best_score >= 0.72 else None


def reverse_lastname_firstname(name: str) -> str:
    """Convert 'LASTNAME, Firstname' → 'Firstname LASTNAME'."""
    if "," in name:
        parts = name.split(",", 1)
        return f"{parts[1].strip()} {parts[0].strip()}"
    return name


def date_to_financial_year(date_str: str) -> str:
    """
    Convert a date string (various formats) to an Australian financial year
    string like '2022-23'. FY runs July 1 – June 30.
    """
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            d = datetime.strptime(date_str.strip(), fmt)
            if d.month >= 7:
                return f"{d.year}-{str(d.year + 1)[-2:]}"
            else:
                return f"{d.year - 1}-{str(d.year)[-2:]}"
        except ValueError:
            continue
    # Fallback: try to extract a 4-digit year
    m = re.search(r"\b(20\d{2})\b", date_str)
    if m:
        y = int(m.group(1))
        return f"{y}-{str(y + 1)[-2:]}"
    return ""


def download_zips(zip_dir: str) -> None:
    """Download both AEC bulk ZIP files into zip_dir."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; Verity/1.0; civic data ingestion)",
    })
    for url, filename in [
        (ANNUAL_ZIP_URL,   ANNUAL_ZIP_NAME),
        (ELECTION_ZIP_URL, ELECTION_ZIP_NAME),
    ]:
        dest = os.path.join(zip_dir, filename)
        log.info("Downloading %s → %s …", url, dest)
        resp = session.get(url, timeout=120, stream=True)
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                f.write(chunk)
        size_kb = os.path.getsize(dest) // 1024
        log.info("  Saved %s (%d KB)", filename, size_kb)


def read_csv_from_zip(zip_path: str, csv_filename: str) -> list[dict]:
    """Open a ZIP and return the rows of the named CSV as a list of dicts."""
    with zipfile.ZipFile(zip_path) as zf:
        # Find the CSV (case-insensitive partial match)
        match = next(
            (n for n in zf.namelist() if csv_filename.lower() in n.lower()),
            None,
        )
        if not match:
            raise FileNotFoundError(
                f"{csv_filename!r} not found in {zip_path}. "
                f"Available: {zf.namelist()}"
            )
        log.info("  Reading %s from %s …", match, os.path.basename(zip_path))
        with zf.open(match) as f:
            content = f.read().decode("utf-8-sig")  # strip BOM if present
        reader = csv.DictReader(io.StringIO(content))
        return list(reader)


def process_annual(zip_path: str, members: list[dict]) -> list[dict]:
    """
    Parse AllAnnualData.zip → Detailed Receipts.csv.
    Returns rows ready for individual_donations insert.
    """
    rows = read_csv_from_zip(zip_path, "Detailed Receipts.csv")
    log.info("  Total rows in Detailed Receipts.csv: %d", len(rows))

    results = []
    skipped = 0

    for row in rows:
        return_type = row.get("Return Type", "")
        # Only MP/Senator individual returns
        if "Member of HOR" not in return_type and "Senator" not in return_type:
            skipped += 1
            continue

        recipient_name = (row.get("Recipient Name") or "").strip()
        donor_name     = (row.get("Received From") or "").strip()
        financial_year = (row.get("Financial Year") or "").strip()
        receipt_type   = (row.get("Receipt Type") or "").strip()
        value_str      = (row.get("Value") or "0").replace(",", "").replace("$", "").strip()

        try:
            amount = float(value_str)
        except ValueError:
            amount = 0.0

        if not donor_name or not recipient_name or amount <= 0:
            continue

        member_id = match_member(recipient_name, members)

        results.append({
            "member_id":      member_id,
            "donor_name":     donor_name,
            "donor_type":     "individual",  # annual returns don't break down type
            "amount":         amount,
            "financial_year": financial_year,
            "receipt_type":   receipt_type or "Declared Receipt",
            "recipient_name": recipient_name,
            "aec_return_id":  None,
        })

    log.info("  Annual: %d MP/Senator rows (skipped %d non-MP)", len(results), skipped)
    return results


def process_elections(zip_path: str, members: list[dict]) -> list[dict]:
    """
    Parse AllElectionsData.zip → Senate Groups and Candidate Donations.csv.
    Returns rows ready for individual_donations insert.
    """
    rows = read_csv_from_zip(zip_path, "Senate Groups and Candidate Donations")
    log.info("  Total rows in election donations CSV: %d", len(rows))

    results = []
    skipped = 0

    for row in rows:
        return_type = (row.get("Return Type (Candidate/Senate Group)") or "").strip()
        # Only individual candidates, not Senate Groups
        if return_type.lower() != "candidate":
            skipped += 1
            continue

        raw_name    = (row.get("Name") or "").strip()
        donor_name  = (row.get("Donor Name") or "").strip()
        date_str    = (row.get("Date Of Gift") or "").strip()
        value_str   = (row.get("Gift Value") or "0").replace(",", "").replace("$", "").strip()
        event       = (row.get("Event") or "").strip()

        try:
            amount = float(value_str)
        except ValueError:
            amount = 0.0

        if not donor_name or not raw_name or amount <= 0:
            continue

        # Convert "LASTNAME, Firstname" → "Firstname LASTNAME" for matching
        display_name = reverse_lastname_firstname(raw_name)
        financial_year = date_to_financial_year(date_str) if date_str else ""
        member_id = match_member(display_name, members)

        results.append({
            "member_id":      member_id,
            "donor_name":     donor_name,
            "donor_type":     "individual",
            "amount":         amount,
            "financial_year": financial_year,
            "receipt_type":   f"Election: {event}" if event else "Election Campaign",
            "recipient_name": display_name,
            "aec_return_id":  None,
        })

    log.info("  Elections: %d candidate rows (skipped %d senate groups)", len(results), skipped)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest AEC individual donation data from bulk CSV downloads"
    )
    parser.add_argument("--zip-dir", default="/tmp",
                        help="Directory containing the AEC ZIP files (default: /tmp)")
    parser.add_argument("--download", action="store_true",
                        help="Download ZIP files from AEC before processing")
    parser.add_argument("--annual-only", action="store_true",
                        help="Only process AllAnnualData.zip")
    parser.add_argument("--election-only", action="store_true",
                        help="Only process AllElectionsData.zip")
    args = parser.parse_args()

    # Supabase setup
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_KEY in environment")
        sys.exit(1)
    db = create_client(url, key)

    # Load members for fuzzy matching
    log.info("Loading members from Supabase…")
    members = db.table("members").select("id,first_name,last_name").execute().data or []
    log.info("Loaded %d members", len(members))

    if args.download:
        log.info("Downloading AEC bulk ZIP files…")
        download_zips(args.zip_dir)

    annual_zip   = os.path.join(args.zip_dir, ANNUAL_ZIP_NAME)
    election_zip = os.path.join(args.zip_dir, ELECTION_ZIP_NAME)

    all_rows: list[dict] = []

    if not args.election_only:
        if not os.path.exists(annual_zip):
            log.error("Missing %s — run with --download to fetch it", annual_zip)
            sys.exit(1)
        log.info("Processing annual returns…")
        all_rows.extend(process_annual(annual_zip, members))

    if not args.annual_only:
        if not os.path.exists(election_zip):
            log.error("Missing %s — run with --download to fetch it", election_zip)
            sys.exit(1)
        log.info("Processing election campaign donations…")
        all_rows.extend(process_elections(election_zip, members))

    matched   = sum(1 for r in all_rows if r["member_id"])
    unmatched = sum(1 for r in all_rows if not r["member_id"])
    unique_donors = len({r["donor_name"] for r in all_rows})
    unique_recipients = len({r["recipient_name"] for r in all_rows})

    log.info("─" * 60)
    log.info("Total records:        %d", len(all_rows))
    log.info("Matched to members:   %d", matched)
    log.info("Unmatched:            %d", unmatched)
    log.info("Unique donors:        %d", unique_donors)
    log.info("Unique recipients:    %d", unique_recipients)

    # Top unmatched names
    unmatched_names: dict[str, int] = {}
    for r in all_rows:
        if not r["member_id"]:
            unmatched_names[r["recipient_name"]] = unmatched_names.get(r["recipient_name"], 0) + 1
    if unmatched_names:
        top = sorted(unmatched_names.items(), key=lambda x: -x[1])[:15]
        log.info("Top unmatched: %s", [n for n, _ in top])

    # Top recipients by total amount
    recipient_totals: dict[str, float] = {}
    for r in all_rows:
        recipient_totals[r["recipient_name"]] = recipient_totals.get(r["recipient_name"], 0) + r["amount"]
    top_recipients = sorted(recipient_totals.items(), key=lambda x: -x[1])[:10]
    log.info("Top recipients by amount:")
    for name, total in top_recipients:
        log.info("  %-40s $%s", name, f"{total:,.0f}")

    if not all_rows:
        log.warning("No rows to insert — check ZIP files and CSV contents")
        return

    # Clear existing data and re-insert
    log.info("Clearing existing individual_donations…")
    db.table("individual_donations").delete().neq(
        "id", "00000000-0000-0000-0000-000000000000"
    ).execute()

    BATCH = 200
    inserted = 0
    for i in range(0, len(all_rows), BATCH):
        batch = all_rows[i : i + BATCH]
        try:
            db.table("individual_donations").insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            log.error("Insert error at batch %d: %s", i, e)

    log.info("Done. %d/%d records inserted.", inserted, len(all_rows))


if __name__ == "__main__":
    main()
