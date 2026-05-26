#!/usr/bin/env python3
"""
ingest_hansard_speeches.py — Fetch Hansard speeches from OpenAustralia API.

Uses getDebates endpoint, iterating by date for the 47th+ parliament period.
Filters to target MPs, skips speeches < 150 words.

Usage:
  python scripts/ingest_hansard_speeches.py --dev              # all 10 pilot MPs
  python scripts/ingest_hansard_speeches.py --dev --mp Laxale  # single MP
  python scripts/ingest_hansard_speeches.py --dev --dry-run    # preview only
"""

import os, sys, json, logging, time, re
from datetime import date, timedelta
import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Env ──────────────────────────────────────────────────────────

def load_env():
    env_path = os.path.expanduser('~/verity/mobile/.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k, v)

load_env()

DEV_MODE = '--dev' in sys.argv
DRY_RUN = '--dry-run' in sys.argv
MP_FILTER = None
for i, arg in enumerate(sys.argv):
    if arg == '--mp' and i + 1 < len(sys.argv):
        MP_FILTER = sys.argv[i + 1].lower()

OA_KEY = os.environ.get('OPENAUSTRALIA_API_KEY', '')
if not OA_KEY:
    log.error("OPENAUSTRALIA_API_KEY not set"); sys.exit(1)

# Dev branch REST API (no RLS)
DEV_URL = 'https://azvwzfsnzopeyzxzexto.supabase.co'
DEV_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dnd6ZnNuem9wZXl6eHpleHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjU0NjAsImV4cCI6MjA5MjAwMTQ2MH0.i9aQpbgXHj8lfdKqhraJia9fgcTuRqVCXEFV1Lyhd9k'

PROD_URL = os.environ.get('SUPABASE_URL', os.environ.get('EXPO_PUBLIC_SUPABASE_URL', ''))
PROD_KEY = os.environ.get('SUPABASE_KEY', '')

DB_URL = DEV_URL if DEV_MODE else PROD_URL
DB_KEY = DEV_ANON if DEV_MODE else PROD_KEY

HEADERS = {
    'apikey': DB_KEY,
    'Authorization': f'Bearer {DB_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
}

# ── Target MPs ───────────────────────────────────────────────────
# OA person_id -> (name, production members.id for cross-ref)
# We'll look up the members.id from production later

PILOT_MPS = [
    {'name': 'Jerome Laxale', 'oa_id': 10967, 'house': 'representatives'},
    {'name': 'Anthony Albanese', 'oa_id': 10007, 'house': 'representatives'},
    {'name': 'Tanya Plibersek', 'oa_id': 10513, 'house': 'representatives'},
    {'name': 'David Littleproud', 'oa_id': 10890, 'house': 'representatives'},
    {'name': 'Bob Katter', 'oa_id': 10352, 'house': 'representatives'},
    {'name': 'Pauline Hanson', 'oa_id': 10280, 'house': 'senate'},
    {'name': 'David Pocock', 'oa_id': 11009, 'house': 'senate'},
    {'name': 'Allegra Spender', 'oa_id': 11001, 'house': 'representatives'},
    {'name': 'Zali Steggall', 'oa_id': 10941, 'house': 'representatives'},
    {'name': 'Helen Haines', 'oa_id': 10929, 'house': 'representatives'},
]

# ── Fetch member UUIDs from production ───────────────────────────

def get_member_uuids() -> dict:
    """Map OA person names to production member UUIDs."""
    resp = requests.get(
        f'{PROD_URL}/rest/v1/members?select=id,first_name,last_name&is_active=eq.true',
        headers={'apikey': PROD_KEY, 'Authorization': f'Bearer {PROD_KEY}'},
        timeout=30,
    )
    members = resp.json()
    lookup = {}
    for m in members:
        key = f"{m['first_name']} {m['last_name']}".lower()
        lookup[key] = m['id']
    return lookup

# ── OA API ───────────────────────────────────────────────────────

OA_BASE = 'https://www.openaustralia.org.au/api'

def fetch_debates_for_date(dt: str, house: str) -> list[dict]:
    """Fetch all debates for a given date and house type."""
    try:
        resp = requests.get(f'{OA_BASE}/getDebates', params={
            'key': OA_KEY,
            'type': house,
            'date': dt,
            'num': 1000,
            'output': 'json',
        }, timeout=30)
        if resp.status_code != 200:
            return []
        data = resp.json()
        if isinstance(data, dict) and 'error' in data:
            return []
        return data if isinstance(data, list) else []
    except Exception:
        return []

def extract_speeches(debates: list[dict], target_person_ids: set) -> list[dict]:
    """Extract individual speeches from debates, filtering to target speakers."""
    speeches = []
    for entry_wrapper in debates:
        entry = entry_wrapper.get('entry', entry_wrapper)
        speaker_id = entry.get('speaker', {}).get('person_id', '') if isinstance(entry.get('speaker'), dict) else ''

        if str(speaker_id) not in target_person_ids:
            continue

        body = entry.get('body', '')
        # Strip HTML
        clean = re.sub(r'<[^>]+>', ' ', body)
        clean = re.sub(r'\s+', ' ', clean).strip()
        word_count = len(clean.split())

        if word_count < 150:
            continue

        debate_title = entry.get('parent', {}).get('body', '') if isinstance(entry.get('parent'), dict) else ''
        if not debate_title:
            # Try htype-based title
            debate_title = entry.get('body', '')[:100] if entry.get('htype') == '10' else 'Unknown debate'

        # Strip HTML from title too
        debate_title = re.sub(r'<[^>]+>', '', debate_title).strip()

        gid = entry.get('gid', '')
        hdate = entry.get('hdate', '')
        source_url = f"https://www.openaustralia.org.au/debates/?id={gid}"

        speeches.append({
            'oa_person_id': str(speaker_id),
            'debate_title': debate_title[:500],
            'speech_date': hdate,
            'raw_text': clean,
            'source_url': source_url,
            'word_count': word_count,
        })
    return speeches

# ── Main ─────────────────────────────────────────────────────────

def main():
    log.info(f"Mode: {'DEV' if DEV_MODE else 'PRODUCTION'} | Dry run: {DRY_RUN}")

    # Get member UUIDs
    member_lookup = get_member_uuids()
    log.info(f"Loaded {len(member_lookup)} production member UUIDs")

    # Filter to target MPs
    targets = PILOT_MPS
    if MP_FILTER:
        targets = [m for m in targets if MP_FILTER in m['name'].lower()]
        if not targets:
            log.error(f"No MP matching '{MP_FILTER}'"); sys.exit(1)

    # Map OA IDs to member UUIDs
    mp_map = {}  # oa_id -> {name, uuid, house}
    for mp in targets:
        uuid = member_lookup.get(mp['name'].lower())
        if not uuid:
            log.warning(f"  No UUID for {mp['name']} — will skip")
            continue
        mp_map[str(mp['oa_id'])] = {
            'name': mp['name'],
            'uuid': uuid,
            'house': mp['house'],
        }
    log.info(f"Targeting {len(mp_map)} MPs: {', '.join(m['name'] for m in mp_map.values())}")

    target_ids = set(mp_map.keys())

    # Iterate dates from 2022-05-21 (47th parliament start) to today
    start_date = date(2022, 5, 21)
    end_date = date.today()
    current = start_date

    all_speeches = []
    dates_checked = 0

    # We only need to check sitting days. Parliament sits ~20 weeks/year, 3-4 days/week.
    # Iterate all weekdays (Mon-Fri) and skip weekends.
    while current <= end_date:
        if current.weekday() >= 5:  # Skip weekends
            current += timedelta(days=1)
            continue

        dt_str = current.strftime('%Y-%m-%d')

        # Fetch for both houses
        for house in ['representatives', 'senate']:
            # Only fetch the house relevant to our target MPs
            house_ids = {oa_id for oa_id, info in mp_map.items() if info['house'] == house}
            if not house_ids:
                continue

            debates = fetch_debates_for_date(dt_str, house)
            if debates:
                speeches = extract_speeches(debates, target_ids)
                all_speeches.extend(speeches)

        dates_checked += 1
        if dates_checked % 50 == 0:
            log.info(f"  Checked {dates_checked} dates ({current}), {len(all_speeches)} speeches so far")

        current += timedelta(days=1)
        time.sleep(0.3)  # Polite

    log.info(f"\nTotal: checked {dates_checked} weekdays, found {len(all_speeches)} speeches (≥150 words)")

    # Count per MP
    from collections import Counter
    per_mp = Counter(s['oa_person_id'] for s in all_speeches)
    for oa_id, count in per_mp.most_common():
        info = mp_map.get(oa_id, {'name': f'Unknown ({oa_id})'})
        log.info(f"  {info['name']}: {count} speeches")

    if DRY_RUN:
        log.info("[DRY RUN] Would insert speeches. Sample:")
        for s in all_speeches[:3]:
            info = mp_map.get(s['oa_person_id'], {'name': '?'})
            log.info(f"  {info['name']} | {s['speech_date']} | {s['word_count']}w | {s['debate_title'][:50]}")
        return

    # Insert into dev branch
    log.info(f"\nInserting {len(all_speeches)} speeches into {'DEV' if DEV_MODE else 'PROD'}...")
    rows = []
    for s in all_speeches:
        info = mp_map.get(s['oa_person_id'])
        if not info:
            continue
        rows.append({
            'mp_id': info['uuid'],
            'debate_title': s['debate_title'],
            'speech_date': s['speech_date'],
            'raw_text': s['raw_text'],
            'source_url': s['source_url'],
            'word_count': s['word_count'],
        })

    inserted = 0
    errors = 0
    for i in range(0, len(rows), 50):
        batch = rows[i:i+50]
        try:
            resp = requests.post(
                f'{DB_URL}/rest/v1/hansard_speeches',
                headers=HEADERS, json=batch, timeout=30,
            )
            if resp.status_code in (200, 201):
                inserted += len(batch)
            else:
                # Try one-by-one for conflict handling
                for row in batch:
                    r = requests.post(
                        f'{DB_URL}/rest/v1/hansard_speeches',
                        headers=HEADERS, json=[row], timeout=30,
                    )
                    if r.status_code in (200, 201):
                        inserted += 1
                    elif '23505' in r.text:  # Duplicate
                        pass  # Expected for re-runs
                    else:
                        errors += 1
        except Exception as e:
            log.error(f"Batch {i} error: {e}")
            errors += 1

        if (i + 50) % 200 == 0:
            log.info(f"  Inserted {inserted}/{len(rows)}...")

    log.info(f"\n=== DONE ===")
    log.info(f"Inserted: {inserted}, Errors: {errors}")

if __name__ == '__main__':
    main()
