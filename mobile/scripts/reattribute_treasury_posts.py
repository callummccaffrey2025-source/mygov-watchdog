#!/usr/bin/env python3
"""
reattribute_treasury_posts.py — one-shot cleanup of mis-attributed
official_posts rows.

Background
  Scraping Treasury's media-release page initially defaulted every release
  to the Treasurer regardless of the actual byline. Six releases are now
  hidden behind attribution_verified=false because their real author is
  a different minister (e.g. Katy Gallagher for Finance releases, Andrew
  Leigh for Assistant Treasurer releases, Catherine King for joint
  Infrastructure releases).

What this script does
  1. Load every member into an in-memory (first, last) index.
  2. SELECT every official_posts row where attribution_verified = false.
  3. For each row, parse the first byline from content using the
     shared mp_author_parser.
  4. If the byline resolves to a known member, UPDATE author_id to that
     member and set attribution_verified = true.
  5. If no byline parses or no member matches, leave the row alone —
     it stays hidden by design.

Run
  python scripts/reattribute_treasury_posts.py --dry-run   # preview only
  python scripts/reattribute_treasury_posts.py             # commit changes
"""
from __future__ import annotations

import argparse
import logging
import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from supabase import create_client

# Shared parser lives next to this file
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp_author_parser import build_members_index, resolve_primary_author  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY in .env")
    sb = create_client(url, key)

    members_index = build_members_index(sb)
    if not members_index:
        raise SystemExit("No members loaded — cannot reattribute safely")

    # Baseline count so the user can verify the end-state.
    before_verified = (
        sb.table("official_posts")
        .select("id", count="exact")
        .eq("attribution_verified", True)
        .execute()
    )
    before_count = before_verified.count or 0

    # Fetch unverified rows
    resp = (
        sb.table("official_posts")
        .select("id, author_id, content")
        .eq("attribution_verified", False)
        .execute()
    )
    rows = resp.data or []

    print()
    mode = "DRY-RUN" if args.dry_run else "LIVE"
    print(f"═══════════════ REATTRIBUTE TREASURY POSTS ({mode}) ═══════════════")
    print(f"Members in index:           {len(members_index)}")
    print(f"Rows with attribution_verified=false: {len(rows)}")
    print(f"Rows with attribution_verified=true (baseline): {before_count}")
    print()

    reattributed = 0
    no_byline = 0
    byline_no_match = 0
    unchanged_same_author = 0
    unresolved_ids: list[tuple[str, str]] = []

    for row in rows:
        row_id = row["id"]
        content = row.get("content") or ""
        current_author = row.get("author_id")

        member, matched_name = resolve_primary_author(content, members_index)

        if not matched_name:
            no_byline += 1
            unresolved_ids.append((row_id, "no byline parsed"))
            continue

        if member is None:
            byline_no_match += 1
            unresolved_ids.append((row_id, f"byline '{matched_name}' not in members"))
            continue

        new_author = member["id"]
        if new_author == current_author:
            # Same author; just flip the flag so the post becomes visible.
            verb = "verify"
        else:
            verb = f"re-attribute to {matched_name}"

        if args.dry_run:
            print(f"  [{row_id}]  →  {verb} (would write)")
            reattributed += 1
            continue

        try:
            sb.table("official_posts").update(
                {
                    "author_id": new_author,
                    "attribution_verified": True,
                }
            ).eq("id", row_id).execute()
            reattributed += 1
            print(f"  [{row_id}]  →  {verb}")
        except Exception as e:
            log.warning("Update failed for %s: %s", row_id, e)

    # After-state count if we actually wrote.
    after_count = before_count
    if not args.dry_run:
        after_verified = (
            sb.table("official_posts")
            .select("id", count="exact")
            .eq("attribution_verified", True)
            .execute()
        )
        after_count = after_verified.count or 0

    print()
    print("═══════════════ SUMMARY ═══════════════")
    print(f"  Reattributed / verified       : {reattributed}")
    print(f"  No byline parsed              : {no_byline}")
    print(f"  Byline parsed but no member   : {byline_no_match}")
    print(f"  Unchanged same-author verify  : {unchanged_same_author}")
    print()
    print(f"  attribution_verified=true before: {before_count}")
    print(f"  attribution_verified=true after : {after_count}")
    print(f"  Delta                            : +{after_count - before_count}")
    print()
    if unresolved_ids:
        print("  Rows still attribution_verified=false (staying hidden):")
        for rid, reason in unresolved_ids[:20]:
            print(f"    {rid}  —  {reason}")
        if len(unresolved_ids) > 20:
            print(f"    ... and {len(unresolved_ids) - 20} more")
    print("════════════════════════════════════════")


if __name__ == "__main__":
    main()
