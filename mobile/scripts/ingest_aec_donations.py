#!/usr/bin/env python3
"""
ingest_aec_donations.py — Load AEC Transparency Register disclosure data.

Downloads bulk CSVs from https://transparency.aec.gov.au/Download, normalises
donors and recipients, and loads into aec_donors / aec_recipients / aec_receipts.

CAVEAT: AEC only discloses transactions above the indexed threshold (~$16,900
for 2024-25). This is large-donor data, NOT complete donation data.

Usage:
  python scripts/ingest_aec_donations.py --dev              # load to dev branch
  python scripts/ingest_aec_donations.py --prod             # load to production
  python scripts/ingest_aec_donations.py --dev --dry-run    # preview only
  python scripts/ingest_aec_donations.py --dev --skip-download  # reuse cached CSVs

Refresh: run after AEC publishes new returns (~Feb for annual, ~24 weeks post-election).
"""

import csv
import hashlib
import logging
import os
import re
import sys
import time
import zipfile
from datetime import datetime
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────

def load_env():
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k, v)

load_env()

DEV_MODE = '--dev' in sys.argv
PROD_MODE = '--prod' in sys.argv
DRY_RUN = '--dry-run' in sys.argv
SKIP_DOWNLOAD = '--skip-download' in sys.argv

if not DEV_MODE and not PROD_MODE:
    log.error("Specify --dev or --prod"); sys.exit(1)

if DEV_MODE:
    DB_URL = 'https://azvwzfsnzopeyzxzexto.supabase.co'
    DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dnd6ZnNuem9wZXl6eHpleHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjU0NjAsImV4cCI6MjA5MjAwMTQ2MH0.i9aQpbgXHj8lfdKqhraJia9fgcTuRqVCXEFV1Lyhd9k'
else:
    DB_URL = os.environ.get('SUPABASE_URL', os.environ.get('EXPO_PUBLIC_SUPABASE_URL', ''))
    DB_KEY = os.environ.get('SUPABASE_KEY', '')

HEADERS = {
    'apikey': DB_KEY,
    'Authorization': f'Bearer {DB_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
}

AEC_ANNUAL_URL = 'https://transparency.aec.gov.au/Download/AllAnnualData'
AEC_ELECTION_URL = 'https://transparency.aec.gov.au/Download/AllElectionsData'
CACHE_DIR = Path('/tmp/aec')

# ── Helpers ──────────────────────────────────────────────────────

def normalise_name(name: str) -> str:
    """Lowercase, strip whitespace, collapse multiple spaces."""
    return re.sub(r'\s+', ' ', name.strip().lower())

def row_hash(parts: list[str]) -> str:
    """SHA-256 hash of concatenated parts for idempotency."""
    payload = '|'.join(str(p) for p in parts)
    return hashlib.sha256(payload.encode()).hexdigest()[:40]

def classify_return_type(raw: str) -> str:
    """Map AEC return type to our recipient_type enum."""
    lower = raw.lower()
    if 'political party' in lower: return 'political_party'
    if 'associated entity' in lower: return 'associated_entity'
    if 'candidate' in lower or 'member of h' in lower or 'senator' in lower: return 'candidate'
    if 'significant third' in lower: return 'significant_third_party'
    if 'political campaigner' in lower: return 'political_campaigner'
    if 'senate group' in lower: return 'senate_group'
    return 'other'

def parse_amount(raw: str) -> float | None:
    try:
        return float(raw.replace(',', '').replace('$', '').strip())
    except (ValueError, AttributeError):
        return None

def parse_date_dmy(raw: str) -> str | None:
    """Parse DD/MM/YYYY to YYYY-MM-DD."""
    if not raw or not raw.strip(): return None
    try:
        return datetime.strptime(raw.strip(), '%d/%m/%Y').strftime('%Y-%m-%d')
    except ValueError:
        return None

def rest_upsert(table: str, rows: list[dict], batch_size: int = 500, on_conflict: str | None = None) -> int:
    """Upsert rows via Supabase REST API. Returns count inserted."""
    upsert_headers = {
        **HEADERS,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
    }
    url = f'{DB_URL}/rest/v1/{table}'
    if on_conflict:
        url += f'?on_conflict={on_conflict}'
    inserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        resp = requests.post(url, headers=upsert_headers, json=batch, timeout=60)
        if resp.status_code in (200, 201):
            inserted += len(batch)
        else:
            log.warning(f"  {table} batch {i}: {resp.status_code} {resp.text[:150]}")
        if (i + batch_size) % 5000 == 0 and i > 0:
            log.info(f"  {table}: {inserted}/{len(rows)} inserted...")
    return inserted

# ── Download ─────────────────────────────────────────────────────

def download_and_extract():
    CACHE_DIR.mkdir(exist_ok=True)
    for url, label in [(AEC_ANNUAL_URL, 'annual'), (AEC_ELECTION_URL, 'election')]:
        zip_path = CACHE_DIR / f'aec_{label}.zip'
        if SKIP_DOWNLOAD and zip_path.exists():
            log.info(f"Using cached {zip_path}")
        else:
            log.info(f"Downloading {label} data...")
            resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=120, stream=True)
            resp.raise_for_status()
            with open(zip_path, 'wb') as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
            log.info(f"  Downloaded {zip_path} ({zip_path.stat().st_size / 1024:.0f} KB)")

        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(CACHE_DIR)
            log.info(f"  Extracted {len(zf.namelist())} files")

# ── Load Detailed Receipts ───────────────────────────────────────

def load_detailed_receipts():
    csv_path = CACHE_DIR / 'Detailed Receipts.csv'
    if not csv_path.exists():
        log.error(f"Missing {csv_path}"); return

    log.info(f"Parsing {csv_path}...")
    donors_cache: dict[str, str] = {}   # name_normalised -> donor_id
    recipients_cache: dict[str, str] = {}  # (name_norm, type) -> recipient_id
    receipt_rows: list[dict] = []
    donor_rows: list[dict] = []
    recipient_rows: list[dict] = []

    skipped = 0
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            fy = row.get('Financial Year', '').strip()
            return_type = row.get('Return Type', '').strip()
            recipient_name = row.get('Recipient Name', '').strip()
            donor_name = row.get('Received From', '').strip()
            receipt_type = row.get('Receipt Type', '').strip()
            value_raw = row.get('Value', '')

            amount = parse_amount(value_raw)
            if amount is None or amount <= 0:
                skipped += 1; continue
            if not donor_name or not recipient_name:
                skipped += 1; continue

            # Normalise donor
            donor_norm = normalise_name(donor_name)
            if donor_norm not in donors_cache:
                donor_rows.append({
                    'name': donor_name.strip(),
                    'name_normalised': donor_norm,
                })
                donors_cache[donor_norm] = None  # placeholder

            # Normalise recipient
            rtype = classify_return_type(return_type)
            recip_norm = normalise_name(recipient_name)
            recip_key = f"{recip_norm}|{rtype}"
            if recip_key not in recipients_cache:
                recipient_rows.append({
                    'name': recipient_name.strip(),
                    'name_normalised': recip_norm,
                    'recipient_type': rtype,
                    'aec_return_type': return_type,
                })
                recipients_cache[recip_key] = None

            # Receipt row
            rh = row_hash([fy, return_type, recipient_name, donor_name, receipt_type, value_raw])
            receipt_rows.append({
                'financial_year': fy,
                'return_type': return_type,
                'receipt_type': receipt_type,
                'amount': amount,
                'source_file': 'annual_detailed_receipts',
                'row_hash': rh,
                '_donor_norm': donor_norm,
                '_recip_key': recip_key,
            })

    log.info(f"Parsed: {len(receipt_rows)} receipts, {len(donor_rows)} unique donors, {len(recipient_rows)} unique recipients, {skipped} skipped")
    return donor_rows, recipient_rows, receipt_rows, donors_cache, recipients_cache


def load_election_donations():
    csv_path = CACHE_DIR / 'Senate Groups and Candidate Donations.csv'
    if not csv_path.exists():
        log.warning(f"Missing {csv_path}, skipping election donations"); return None

    log.info(f"Parsing {csv_path}...")
    donor_rows = []
    recipient_rows = []
    receipt_rows = []
    donors_cache = {}
    recipients_cache = {}
    skipped = 0

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            event = row.get('Event', '').strip()
            rtype_raw = row.get('Return Type (Candidate/Senate Group)', '').strip()
            name = row.get('Name', '').strip()
            donor_name = row.get('Donor Name', '').strip()
            date_raw = row.get('Date Of Gift', '')
            value_raw = row.get('Gift Value', '')

            amount = parse_amount(value_raw)
            if amount is None or amount <= 0:
                skipped += 1; continue
            if not donor_name or not name:
                skipped += 1; continue

            donor_norm = normalise_name(donor_name)
            if donor_norm not in donors_cache:
                donor_rows.append({'name': donor_name.strip(), 'name_normalised': donor_norm})
                donors_cache[donor_norm] = None

            rtype = 'candidate' if 'candidate' in rtype_raw.lower() else 'senate_group'
            recip_norm = normalise_name(name)
            recip_key = f"{recip_norm}|{rtype}"
            if recip_key not in recipients_cache:
                recipient_rows.append({
                    'name': name.strip(),
                    'name_normalised': recip_norm,
                    'recipient_type': rtype,
                    'aec_return_type': f'{rtype_raw} ({event})',
                })
                recipients_cache[recip_key] = None

            gift_date = parse_date_dmy(date_raw)
            # Derive financial year from event
            fy = event.replace(' Federal Election', '').strip() if event else ''

            rh = row_hash([event, rtype_raw, name, donor_name, date_raw, value_raw])
            receipt_rows.append({
                'financial_year': fy,
                'return_type': f'{rtype_raw} ({event})',
                'receipt_type': 'Election Donation',
                'amount': amount,
                'gift_date': gift_date,
                'source_file': 'election_candidate_donations',
                'row_hash': rh,
                '_donor_norm': donor_norm,
                '_recip_key': recip_key,
            })

    log.info(f"Parsed: {len(receipt_rows)} election donations, {len(donor_rows)} donors, {len(recipient_rows)} recipients, {skipped} skipped")
    return donor_rows, recipient_rows, receipt_rows, donors_cache, recipients_cache


# ── Insert ───────────────────────────────────────────────────────

def insert_all(donor_rows, recipient_rows, receipt_rows, donors_cache, recipients_cache):
    if DRY_RUN:
        total_amount = sum(r['amount'] for r in receipt_rows)
        log.info(f"[DRY RUN] Would insert {len(donor_rows)} donors, {len(recipient_rows)} recipients, {len(receipt_rows)} receipts (${total_amount:,.0f})")
        return

    # 1. Insert donors
    log.info(f"Inserting {len(donor_rows)} donors...")
    inserted = rest_upsert('aec_donors', donor_rows, on_conflict='name_normalised')
    log.info(f"  Donors inserted: {inserted}")

    # 2. Fetch back donor IDs
    log.info("Fetching donor ID map...")
    all_donors = []
    offset = 0
    while True:
        resp = requests.get(f'{DB_URL}/rest/v1/aec_donors?select=id,name_normalised&limit=1000&offset={offset}',
            headers={'apikey': DB_KEY, 'Authorization': f'Bearer {DB_KEY}'}, timeout=30)
        batch = resp.json()
        all_donors.extend(batch)
        if len(batch) < 1000: break
        offset += 1000
    for d in all_donors:
        donors_cache[d['name_normalised']] = d['id']
    log.info(f"  Mapped {len(donors_cache)} donor IDs")

    # 3. Insert recipients
    log.info(f"Inserting {len(recipient_rows)} recipients...")
    inserted = rest_upsert('aec_recipients', recipient_rows, on_conflict='name_normalised,recipient_type')
    log.info(f"  Recipients inserted: {inserted}")

    # 4. Fetch back recipient IDs
    log.info("Fetching recipient ID map...")
    all_recips = []
    offset = 0
    while True:
        resp = requests.get(f'{DB_URL}/rest/v1/aec_recipients?select=id,name_normalised,recipient_type&limit=1000&offset={offset}',
            headers={'apikey': DB_KEY, 'Authorization': f'Bearer {DB_KEY}'}, timeout=30)
        batch = resp.json()
        all_recips.extend(batch)
        if len(batch) < 1000: break
        offset += 1000
    for r in all_recips:
        key = f"{r['name_normalised']}|{r['recipient_type']}"
        recipients_cache[key] = r['id']
    log.info(f"  Mapped {len(recipients_cache)} recipient IDs")

    # 5. Build receipt rows with resolved FKs
    log.info(f"Resolving {len(receipt_rows)} receipt FKs...")
    resolved = []
    unresolved = 0
    for r in receipt_rows:
        donor_id = donors_cache.get(r['_donor_norm'])
        recip_id = recipients_cache.get(r['_recip_key'])
        if not donor_id or not recip_id:
            unresolved += 1; continue
        resolved.append({
            'donor_id': donor_id,
            'recipient_id': recip_id,
            'amount': r['amount'],
            'financial_year': r['financial_year'],
            'receipt_type': r['receipt_type'],
            'return_type': r['return_type'],
            'source_file': r['source_file'],
            'row_hash': r['row_hash'],
            'gift_date': r.get('gift_date'),
        })

    if unresolved:
        log.warning(f"  {unresolved} receipts could not resolve donor/recipient FK — skipped")

    # Deduplicate by row_hash within the batch
    seen_hashes: set[str] = set()
    deduped = []
    for r in resolved:
        if r['row_hash'] not in seen_hashes:
            seen_hashes.add(r['row_hash'])
            deduped.append(r)
    if len(deduped) < len(resolved):
        log.info(f"  Deduped: {len(resolved)} -> {len(deduped)} (removed {len(resolved) - len(deduped)} duplicate hashes)")
    resolved = deduped

    # 6. Insert receipts
    log.info(f"Inserting {len(resolved)} receipts...")
    inserted = rest_upsert('aec_receipts', resolved, on_conflict='row_hash')
    log.info(f"  Receipts inserted: {inserted}")

    return len(resolved)


# ── Main ─────────────────────────────────────────────────────────

def main():
    log.info(f"Target: {'DEV' if DEV_MODE else 'PROD'} | Dry run: {DRY_RUN}")

    download_and_extract()

    # Load annual detailed receipts
    annual = load_detailed_receipts()
    if not annual:
        log.error("Failed to parse annual receipts"); sys.exit(1)
    a_donors, a_recips, a_receipts, a_dc, a_rc = annual

    # Load election donations
    election = load_election_donations()

    # Merge
    all_donors = a_donors[:]
    all_recips = a_recips[:]
    all_receipts = a_receipts[:]
    merged_dc = dict(a_dc)
    merged_rc = dict(a_rc)

    if election:
        e_donors, e_recips, e_receipts, e_dc, e_rc = election
        # Add new donors/recipients not already seen
        for d in e_donors:
            if d['name_normalised'] not in merged_dc:
                all_donors.append(d)
                merged_dc[d['name_normalised']] = None
        for r in e_recips:
            key = f"{r['name_normalised']}|{r['recipient_type']}"
            if key not in merged_rc:
                all_recips.append(r)
                merged_rc[key] = None
        all_receipts.extend(e_receipts)

    log.info(f"\nTotals: {len(all_donors)} donors, {len(all_recips)} recipients, {len(all_receipts)} receipts")
    total_amount = sum(r['amount'] for r in all_receipts)
    log.info(f"Total value: ${total_amount:,.0f}")

    insert_all(all_donors, all_recips, all_receipts, merged_dc, merged_rc)

    # Verification
    log.info("\n=== VERIFICATION ===")
    for table in ['aec_donors', 'aec_recipients', 'aec_receipts']:
        resp = requests.get(f'{DB_URL}/rest/v1/{table}?select=id',
            headers={'apikey': DB_KEY, 'Authorization': f'Bearer {DB_KEY}', 'Prefer': 'count=exact', 'Range': '0-0'}, timeout=30)
        count = resp.headers.get('content-range', '').split('/')[-1]
        log.info(f"  {table}: {count} rows")

    log.info(f"  Source CSV receipts: {len(all_receipts)}")
    log.info(f"  Source total value: ${total_amount:,.0f}")


if __name__ == '__main__':
    main()
