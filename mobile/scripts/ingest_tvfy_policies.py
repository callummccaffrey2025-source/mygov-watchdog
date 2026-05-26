#!/usr/bin/env python3
"""
ingest_tvfy_policies.py — Fetch TheyVoteForYou policies and their linked divisions.

Populates:
  - tvfy_policies (id, name, description)
  - policy_division_links (policy_id, division_id, policy_position)

Usage:
  python scripts/ingest_tvfy_policies.py                    # production
  python scripts/ingest_tvfy_policies.py --dev               # dev branch
  python scripts/ingest_tvfy_policies.py --dev --dry-run     # preview only
"""

import os, sys, time, json, logging, re
import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Env ──────────────────────────────────────────────────────────

def load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
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

if DEV_MODE:
    # Dev branch project
    SUPABASE_URL = 'https://azvwzfsnzopeyzxzexto.supabase.co'
    SUPABASE_KEY = os.environ.get('SUPABASE_DEV_KEY', '')
    if not SUPABASE_KEY:
        log.error("SUPABASE_DEV_KEY not set in .env — add your dev branch service_role key")
        sys.exit(1)
else:
    SUPABASE_URL = os.environ.get('SUPABASE_URL', os.environ.get('EXPO_PUBLIC_SUPABASE_URL', ''))
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

TVFY_KEY = os.environ.get('THEYVOTEFORYOU_API_KEY', '')
if not TVFY_KEY:
    log.error("THEYVOTEFORYOU_API_KEY not set in .env")
    sys.exit(1)

from supabase import create_client
db = create_client(SUPABASE_URL, SUPABASE_KEY)

TVFY_BASE = 'https://theyvoteforyou.org.au/api/v1'

# ── Fetch policies ───────────────────────────────────────────────

def fetch_policies() -> list[dict]:
    url = f'{TVFY_BASE}/policies.json?key={TVFY_KEY}'
    log.info("Fetching policies from TVFY...")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    policies = resp.json()
    log.info(f"  Got {len(policies)} policies")
    return policies

def fetch_policy_divisions(policy_id: int) -> list[dict]:
    url = f'{TVFY_BASE}/policies/{policy_id}.json?key={TVFY_KEY}'
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    # The policy detail includes a 'policy_divisions' array
    return data.get('policy_divisions', [])

# ── Main ─────────────────────────────────────────────────────────

def main():
    log.info(f"Mode: {'DEV' if DEV_MODE else 'PRODUCTION'} | Dry run: {DRY_RUN}")

    policies = fetch_policies()

    # Upsert policies
    policy_rows = []
    for p in policies:
        policy_rows.append({
            'id': p['id'],
            'name': p['name'],
            'description': p.get('description', ''),
        })

    if not DRY_RUN:
        # Batch upsert policies
        BATCH = 50
        for i in range(0, len(policy_rows), BATCH):
            batch = policy_rows[i:i+BATCH]
            db.table('tvfy_policies').upsert(batch, on_conflict='id').execute()
        log.info(f"Upserted {len(policy_rows)} policies")
    else:
        log.info(f"[DRY RUN] Would upsert {len(policy_rows)} policies")
        for p in policy_rows[:5]:
            log.info(f"  {p['id']}: {p['name']}")

    # Fetch and upsert division links for each policy
    total_links = 0
    for i, p in enumerate(policies):
        pid = p['id']
        if (i + 1) % 10 == 0 or i == 0:
            log.info(f"  [{i+1}/{len(policies)}] Fetching divisions for policy {pid}: {p['name'][:50]}")

        try:
            divs = fetch_policy_divisions(pid)
        except Exception as e:
            log.warning(f"  Failed to fetch divisions for policy {pid}: {e}")
            time.sleep(1)
            continue

        link_rows = []
        for d in divs:
            division = d.get('division', {})
            div_id = division.get('id')
            if not div_id:
                continue
            # TVFY division IDs look like "uk.org.publicwhip/debate/2024-06-20.1"
            # Our division_votes.division_id might be different — store the TVFY format
            vote = d.get('vote', 'aye')  # 'aye3' means strong aye, 'no3' strong no
            position = 'no' if 'no' in str(vote).lower() else 'aye'
            link_rows.append({
                'policy_id': pid,
                'division_id': str(div_id),
                'policy_position': position,
            })

        if link_rows and not DRY_RUN:
            # Upsert in batches
            for j in range(0, len(link_rows), 50):
                batch = link_rows[j:j+50]
                db.table('policy_division_links').upsert(
                    batch, on_conflict='policy_id,division_id'
                ).execute()

        total_links += len(link_rows)
        time.sleep(0.5)  # Be polite to TVFY API

    log.info(f"\n=== DONE ===")
    log.info(f"Policies: {len(policy_rows)}")
    log.info(f"Division links: {total_links}")

if __name__ == '__main__':
    main()
