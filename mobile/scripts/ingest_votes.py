#!/usr/bin/env python3
"""
ingest_votes.py — Pull division (vote) records from TheyVoteForYou.org.au
and store them in the `divisions` and `division_votes` tables.

API docs: https://theyvoteforyou.org.au/help/data
  GET /api/v1/divisions.json?key=KEY&house=HOUSE&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
  GET /api/v1/divisions/{id}.json?key=KEY

Idempotent: upserts on tvfy_id (divisions) and (division_id,tvfy_person_id) (division_votes).
Pagination: 90-day date windows to stay under the 100-result-per-call limit.
"""
import logging
import os
import sys
import time
from datetime import date, timedelta

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

TVFY_BASE    = "https://theyvoteforyou.org.au/api/v1"
HOUSES       = ["representatives", "senate"]
START_DATE   = date(2022, 7, 1)   # 47th Parliament
WINDOW_DAYS  = 90
DELAY        = 0.4                 # seconds between API calls
VOTE_BATCH   = 100


def get_tvfy_key() -> str:
    key = os.environ.get("TVFY_API_KEY") or os.environ.get("THEYVOTEFORYOU_API_KEY")
    if not key:
        log.error(
            "Missing TVFY_API_KEY. Add it to your .env file:\n"
            "  TVFY_API_KEY=your_key_here\n"
            "Get a key at https://theyvoteforyou.org.au/api_keys"
        )
        sys.exit(1)
    return key


def fetch_division_list(key: str, house: str, start: date, end: date) -> list[dict]:
    """Returns up to 100 division stubs for a house/date-range window."""
    try:
        resp = requests.get(
            f"{TVFY_BASE}/divisions.json",
            params={
                "key":        key,
                "house":      house,
                "start_date": start.isoformat(),
                "end_date":   end.isoformat(),
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []
    except Exception as exc:
        log.warning("  Division list failed (%s %s–%s): %s", house, start, end, exc)
        return []


def fetch_division_detail(key: str, division_id: int) -> dict | None:
    """Returns full division detail including per-person votes."""
    try:
        resp = requests.get(
            f"{TVFY_BASE}/divisions/{division_id}.json",
            params={"key": key},
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        log.warning("  Division detail failed (id=%d): %s", division_id, exc)
        return None


def parse_tvfy_name(name_str: str) -> tuple[str, str]:
    """Parse a TVFY name string into (first_name, last_name).

    TVFY usually returns "Surname, Given name" but sometimes "Given Surname".
    """
    name_str = name_str.strip()
    if "," in name_str:
        last, rest = name_str.split(",", 1)
        first = rest.strip().split()[0] if rest.strip() else ""
    else:
        parts = name_str.split()
        first = parts[0] if parts else ""
        last  = " ".join(parts[1:]) if len(parts) > 1 else ""
    return first.strip(), last.strip()


def build_member_lookup(db) -> dict[tuple[str, str], str]:
    """Build {(first_lower, last_lower): member_uuid} for every member."""
    result = db.table("members").select("id, first_name, last_name").execute()
    lookup: dict[tuple[str, str], str] = {}
    for row in result.data:
        key = (row["first_name"].lower().strip(), row["last_name"].lower().strip())
        lookup[key] = row["id"]
    log.info("Loaded %d members into name lookup.", len(lookup))
    return lookup


def main() -> None:
    sb_url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not sb_url or not sb_key:
        log.error("Missing SUPABASE_URL / SUPABASE_KEY")
        sys.exit(1)

    tvfy_key     = get_tvfy_key()
    db           = create_client(sb_url, sb_key)
    member_lookup = build_member_lookup(db)

    # Cache existing TVFY IDs so we skip re-fetching detail for known divisions
    existing_result  = db.table("divisions").select("tvfy_id").execute()
    existing_ids: set[int] = {row["tvfy_id"] for row in existing_result.data}
    log.info("Existing divisions in DB: %d", len(existing_ids))

    total_divisions = 0
    total_votes     = 0
    unmatched: set[str] = set()
    today = date.today()

    for house in HOUSES:
        log.info("══ %s ═══════════════════════════════════════", house)
        window_start = START_DATE
        while window_start <= today:
            window_end = min(window_start + timedelta(days=WINDOW_DAYS - 1), today)

            stubs = fetch_division_list(tvfy_key, house, window_start, window_end)
            time.sleep(DELAY)

            new_stubs = [s for s in stubs if s.get("id") not in existing_ids]
            log.info("  %s–%s: %d total, %d new",
                     window_start, window_end, len(stubs), len(new_stubs))

            for stub in new_stubs:
                div_id = stub["id"]

                detail = fetch_division_detail(tvfy_key, div_id)
                time.sleep(DELAY)
                if not detail:
                    continue

                bills      = detail.get("bills") or []
                bill_title = bills[0].get("title") if bills else None

                # divisions.id is TEXT NOT NULL with no default — provide it explicitly
                div_text_id = str(detail["id"])
                div_row = {
                    "id":               div_text_id,
                    "tvfy_id":          detail["id"],
                    "name":             detail.get("name", ""),
                    "date":             detail.get("date"),
                    "chamber":          detail.get("house", house),
                    "bill_title":       bill_title,
                    "aye_votes":        detail.get("aye_votes", 0),
                    "no_votes":         detail.get("no_votes", 0),
                    "possible_turnout": detail.get("possible_turnout"),
                    "rebellions":       detail.get("rebellions", 0),
                    "clock_time":       detail.get("clock_time"),
                    "source_url": (
                        "https://theyvoteforyou.org.au/divisions/"
                        f"{detail.get('house', house)}"
                        f"/{detail.get('date', '')}/{detail['id']}"
                    ),
                }

                upsert_result = (
                    db.table("divisions")
                    .upsert(div_row, on_conflict="tvfy_id")
                    .execute()
                )
                if not upsert_result.data:
                    log.warning("  Division upsert returned no data (tvfy_id=%d)", div_id)
                    continue

                existing_ids.add(div_id)
                total_divisions += 1

                # Build vote rows — division_votes.division_id is TEXT FK → divisions.id
                vote_rows = []
                for v in detail.get("votes", []):
                    person         = v.get("member", {})
                    tvfy_person_id = person.get("id")
                    raw_name       = person.get("name", "")
                    first, last    = parse_tvfy_name(raw_name)
                    member_id      = member_lookup.get((first.lower(), last.lower()))

                    if not member_id and raw_name:
                        unmatched.add(raw_name)

                    vote_rows.append({
                        "division_id":    div_text_id,
                        "politician_id":  str(tvfy_person_id) if tvfy_person_id else None,
                        "tvfy_person_id": tvfy_person_id,
                        "vote_cast":      v.get("vote", "").lower(),
                        "rebelled":       bool(v.get("rebel", False)),
                        "member_id":      member_id,
                    })

                if vote_rows:
                    for i in range(0, len(vote_rows), VOTE_BATCH):
                        db.table("division_votes").upsert(
                            vote_rows[i : i + VOTE_BATCH],
                            on_conflict="division_id,tvfy_person_id",
                        ).execute()
                    total_votes += len(vote_rows)

                if total_divisions % 100 == 0:
                    log.info("  Progress: %d divisions, %d votes",
                             total_divisions, total_votes)

            window_start = window_end + timedelta(days=1)

    # ── Summary ──────────────────────────────────────────────
    log.info("════════════════════════════════════════════════")
    log.info("Divisions ingested  : %d", total_divisions)
    log.info("Votes recorded      : %d", total_votes)
    if unmatched:
        sample = sorted(unmatched)[:30]
        log.info("Unmatched names (%d): %s", len(unmatched), ", ".join(sample))

    div_count  = db.table("divisions").select("id", count="exact", head=True).execute()
    vote_count = db.table("division_votes").select("id", count="exact", head=True).execute()
    log.info("Total divisions in DB     : %d", div_count.count  or 0)
    log.info("Total division_votes in DB: %d", vote_count.count or 0)


if __name__ == "__main__":
    main()
