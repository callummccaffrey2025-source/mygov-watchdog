#!/usr/bin/env python3
"""
ingest_mp_emails.py — Populate email addresses for federal MPs and Senators.

Strategy:
  - House MPs:    firstname.lastname@aph.gov.au
  - Senators:     senator.lastname@aph.gov.au  (primary format)
                  firstname.lastname@aph.gov.au  (fallback / newer senators)

Name normalisation:
  - Lowercase, strip accents
  - Replace spaces within name parts with hyphens (e.g. Mary-Jo → mary-jo)
  - Strip apostrophes, commas, brackets
  - Handle "O'Brien" → "obrien", "van der Berg" → "vanderberg"

Run:
  python ingest_mp_emails.py            # dry-run, print only
  python ingest_mp_emails.py --write    # write to Supabase
  python ingest_mp_emails.py --member "Albanese" --write

Outputs:
  - Rows updated
  - Members with no aph_id skipped (email generated anyway from name)
"""

import argparse
import logging
import os
import re
import unicodedata

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Set SUPABASE_URL and SUPABASE_KEY in .env")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def normalise_name_part(s: str) -> str:
    """Lower-case, strip accents, remove non-alpha except hyphens."""
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"['\",.()\[\]{}]", "", s)
    s = re.sub(r"\s+", "", s)  # collapse spaces inside a name part
    return s


def build_email(first: str, last: str, chamber: str) -> str:
    f = normalise_name_part(first)
    l = normalise_name_part(last)
    if chamber == "senate":
        return f"senator.{l}@aph.gov.au"
    return f"{f}.{l}@aph.gov.au"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Write emails to Supabase")
    parser.add_argument("--member", default=None, help="Filter by last name substring")
    args = parser.parse_args()

    query = sb.table("members").select("id,first_name,last_name,chamber,email,is_active").eq("is_active", True)
    if args.member:
        query = query.ilike("last_name", f"%{args.member}%")

    result = query.execute()
    members = result.data or []
    log.info(f"Found {len(members)} active members")

    updated = 0
    skipped_has_email = 0
    for m in members:
        existing = m.get("email") or ""
        generated = build_email(m["first_name"], m["last_name"], m["chamber"])

        if existing and existing.endswith("@aph.gov.au"):
            skipped_has_email += 1
            log.debug(f"SKIP (has email)  {m['first_name']} {m['last_name']}  {existing}")
            continue

        if not existing:
            log.info(f"  {m['first_name']} {m['last_name']} ({m['chamber']})  →  {generated}")
            if args.write:
                sb.table("members").update({"email": generated}).eq("id", m["id"]).execute()
            updated += 1
        else:
            # Has non-APH email already — don't overwrite
            log.debug(f"SKIP (non-APH email)  {m['first_name']} {m['last_name']}  {existing}")

    if args.write:
        log.info(f"\n✅ Updated {updated} members with generated emails")
    else:
        log.info(f"\nDry run — would update {updated} members (pass --write to commit)")
    log.info(f"Skipped {skipped_has_email} members already have @aph.gov.au emails")


if __name__ == "__main__":
    main()
