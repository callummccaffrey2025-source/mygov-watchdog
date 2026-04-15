#!/usr/bin/env python3
"""
ingest_hansard.py — Fetch Hansard speech data from the OpenAustralia API
and load into Supabase hansard_entries table.

Strategy:
  The OA API's person-filter is broken for House members (500 error).
  Instead, we iterate sitting dates, fetch all debate subsections,
  then fetch individual speeches (with speaker attribution) per subsection,
  and filter to our matched MPs.

Usage:
  python ingest_hansard.py [--test] [--member "Last Name"] [--days 60]

  --test           Only process first 2 sitting days
  --member NAME    Only process members whose last name contains NAME
  --days N         Number of days of history to check (default: 60)

Requires OPENAUSTRALIA_API_KEY in .env
"""

import argparse
import concurrent.futures
import logging
import os
import re
import sys
import time
from datetime import date, timedelta
from difflib import SequenceMatcher
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

OA_BASE = "https://www.openaustralia.org.au/api"
OA_WEB = "https://www.openaustralia.org.au"
API_KEY = os.environ.get("OPENAUSTRALIA_API_KEY", "")

_TITLE_RE = re.compile(
    r"\b(hon|dr|mr|ms|mrs|prof|rev|senator|the)\b[.\s]*", re.IGNORECASE
)
_SUFFIX_RE = re.compile(
    r"\b(mp|oam|am|ao|obe|mbe|kbe|ac|asc|apm|qc|sc|phd)\b[.\s]*", re.IGNORECASE
)
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_ENTITY_RE = re.compile(r"&(?:[a-z]+|#\d+);")


def strip_titles(name: str) -> str:
    name = _TITLE_RE.sub("", name)
    name = _SUFFIX_RE.sub("", name)
    return re.sub(r"\s+", " ", name).strip()


def normalise(name: str) -> str:
    return re.sub(r"[^a-z ]", "", strip_titles(name).lower()).strip()


def name_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalise(a), normalise(b)).ratio()


def strip_html(text: str) -> str:
    text = _HTML_TAG_RE.sub(" ", text)
    text = _HTML_ENTITY_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def oa_get(session: requests.Session, endpoint: str, params: dict) -> list | dict:
    """GET the OpenAustralia API; return parsed JSON or empty list on error."""
    p = {"key": API_KEY, "output": "js", **params}
    for attempt in range(3):
        try:
            resp = session.get(f"{OA_BASE}/{endpoint}", params=p, timeout=30)
            if resp.status_code == 500:
                return []  # known broken for some person queries
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt == 2:
                log.debug("  API error %s: %s", endpoint, e)
                return []
            time.sleep(1 + attempt)
    return []


def get_oa_members(session: requests.Session) -> list[dict]:
    """Fetch all current House and Senate members from OpenAustralia."""
    results = []
    for endpoint, chamber in [("getRepresentatives", "house"), ("getSenators", "senate")]:
        data = oa_get(session, endpoint, {})
        members_raw = data if isinstance(data, list) else []
        if isinstance(data, dict):
            for key in ("members", "representatives", "senators", "data"):
                if key in data and isinstance(data[key], list):
                    members_raw = data[key]
                    break
        for m in members_raw:
            pid = str(m.get("person_id") or m.get("id") or "")
            name = m.get("name") or m.get("full_name") or ""
            if pid and name:
                results.append({"person_id": pid, "name": name, "chamber": chamber})
        log.info("  %s: %d members", endpoint, sum(1 for r in results if r["chamber"] == chamber))
    return results


def get_sitting_dates(session: requests.Session, days: int) -> list[str]:
    """
    Return dates in the last `days` days on which parliament sat (House of Reps).
    A sitting day has more than 1 debate section.
    """
    sitting = []
    start = date.today() - timedelta(days=days)
    log.info("Scanning %d days for sitting dates…", days)
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        data = oa_get(session, "getDebates", {"type": "representatives", "date": d, "num": 5})
        if isinstance(data, list) and len(data) > 1:
            sitting.append(d)
        time.sleep(0.1)
    log.info("Found %d sitting days", len(sitting))
    return sitting


def get_subsection_gids(session: requests.Session, sitting_date: str) -> list[tuple[str, str]]:
    """
    Return (gid, topic) for each debate subsection on a sitting day.
    These are the htype=11 entries (one level below top-level sections).
    """
    data = oa_get(session, "getDebates", {"type": "representatives", "date": sitting_date, "num": 1000})
    if not isinstance(data, list):
        return []
    result = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        topic = strip_html(entry.get("entry", {}).get("body", "") or "")
        for sub in entry.get("subs", []):
            gid = sub.get("gid")
            sub_topic = strip_html(sub.get("body", "") or topic)
            if gid and int(sub.get("contentcount", 0)) > 0:
                result.append((gid, sub_topic))
    return result


def get_speeches_for_gid(
    session: requests.Session,
    gid: str,
    topic: str,
    sitting_date: str,
    matched_person_ids: set[str],
    chamber_by_person_id: dict[str, str],
) -> list[dict]:
    """
    Fetch individual speeches for a subsection gid.
    Return entries matching our members' person_ids.
    """
    data = oa_get(session, "getDebates", {"type": "representatives", "gid": gid, "num": 500})
    if not isinstance(data, list):
        return []

    results = []
    for row in data:
        if not isinstance(row, dict):
            continue
        speaker = row.get("speaker") or {}
        if not isinstance(speaker, dict):
            continue
        pid = str(speaker.get("person_id") or "")
        if pid not in matched_person_ids:
            continue

        body_raw = row.get("body") or ""
        excerpt = strip_html(body_raw)[:300]
        if not excerpt:
            continue

        listurl = row.get("listurl") or ""
        if listurl and not listurl.startswith("http"):
            listurl = OA_WEB + listurl

        # Use sitting_date as the canonical date (hdate on individual speeches is same)
        results.append({
            "person_id": pid,
            "date": sitting_date,
            "debate_topic": topic[:200] if topic else None,
            "excerpt": excerpt,
            "source_url": listurl or None,
            "chamber": chamber_by_person_id.get(pid, "house"),
        })
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Hansard speech data")
    parser.add_argument("--test", action="store_true", help="Only process first 2 sitting days")
    parser.add_argument("--member", default=None, help="Filter by last name substring")
    parser.add_argument("--days", type=int, default=60, help="Days of history to check (default: 60)")
    args = parser.parse_args()

    if not API_KEY:
        log.error("Missing OPENAUSTRALIA_API_KEY in .env")
        sys.exit(1)

    from supabase import create_client
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")
        sys.exit(1)
    db = create_client(url, key)

    # Load our members
    members = db.table("members").select("id,first_name,last_name,chamber").execute().data or []
    if args.member:
        members = [m for m in members if args.member.lower() in m["last_name"].lower()]
    log.info("Loaded %d members", len(members))

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; Verity/1.0; research)",
        "Accept": "application/json",
    })

    # Step 1: Match our members to OA person_ids
    log.info("Fetching OA member lists…")
    oa_members = get_oa_members(session)
    if not oa_members:
        log.error("No members from OA API — check API key")
        sys.exit(1)

    all_scores: list[tuple[float, dict, dict]] = []
    for our_m in members:
        our_name = f"{our_m['first_name']} {our_m['last_name']}"
        for oa_m in oa_members:
            if oa_m["chamber"] != our_m.get("chamber", "house"):
                continue
            score = name_similarity(our_name, oa_m["name"])
            if score >= 0.72:
                all_scores.append((score, our_m, oa_m))

    all_scores.sort(key=lambda x: -x[0])
    used_pids: set[str] = set()
    used_mids: set[str] = set()
    member_by_pid: dict[str, str] = {}  # person_id → member_id
    chamber_by_pid: dict[str, str] = {}  # person_id → chamber

    for _, our_m, oa_m in all_scores:
        if our_m["id"] in used_mids or oa_m["person_id"] in used_pids:
            continue
        member_by_pid[oa_m["person_id"]] = our_m["id"]
        chamber_by_pid[oa_m["person_id"]] = our_m.get("chamber", "house")
        used_mids.add(our_m["id"])
        used_pids.add(oa_m["person_id"])

    matched_pids = set(member_by_pid.keys())
    log.info("Matched %d/%d members to OA person_ids", len(matched_pids), len(members))

    # Step 2: Find sitting dates
    sitting_dates = get_sitting_dates(session, args.days)
    if args.test:
        sitting_dates = sitting_dates[-2:]  # last 2 sitting days for quick test
        log.info("--test mode: processing %d sitting days", len(sitting_dates))

    # Step 3: For each sitting day, collect all subsection gids
    all_gids: list[tuple[str, str, str]] = []  # (gid, topic, sitting_date)
    for d in sitting_dates:
        gids = get_subsection_gids(session, d)
        for gid, topic in gids:
            all_gids.append((gid, topic, d))
        log.info("  %s: %d subsections", d, len(gids))

    log.info("Total subsections to scan: %d", len(all_gids))

    # Step 4: Fetch individual speeches for each subsection (with concurrency)
    all_speeches: list[dict] = []
    processed = 0

    def fetch_one(args_tuple: tuple) -> list[dict]:
        gid, topic, sitting_date = args_tuple
        return get_speeches_for_gid(
            session, gid, topic, sitting_date, matched_pids, chamber_by_pid
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_one, t): t for t in all_gids}
        for future in concurrent.futures.as_completed(futures):
            try:
                speeches = future.result()
                all_speeches.extend(speeches)
            except Exception as e:
                log.debug("Error fetching gid: %s", e)
            processed += 1
            if processed % 50 == 0:
                log.info("  Processed %d/%d subsections, %d speeches so far", processed, len(all_gids), len(all_speeches))

    log.info("Collected %d speeches total", len(all_speeches))

    # Attach member_ids
    rows = []
    for s in all_speeches:
        pid = s.pop("person_id")
        mid = member_by_pid.get(pid)
        if mid:
            rows.append({"member_id": mid, **s})

    members_with_speeches = len({r["member_id"] for r in rows})
    log.info("Speeches attributed to %d members", members_with_speeches)

    if not rows:
        log.info("No speeches to insert.")
        return

    # Step 5: Save hansard_entries
    # Full run: truncate then insert (AEC-style idempotency)
    # Partial run (--test or --member): delete for those member_ids then insert
    if not args.test and not args.member:
        log.info("Truncating hansard_entries…")
        db.table("hansard_entries").delete().gte("created_at", "2000-01-01").execute()
    else:
        # Delete existing entries for the members we're processing
        member_ids_to_refresh = list({r["member_id"] for r in rows})
        log.info("Deleting existing entries for %d members…", len(member_ids_to_refresh))
        for mid in member_ids_to_refresh:
            db.table("hansard_entries").delete().eq("member_id", mid).execute()

    log.info("Inserting %d entries…", len(rows))
    BATCH = 200
    inserted = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        try:
            db.table("hansard_entries").insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            log.error("Insert error at batch %d: %s", i, e)

    log.info("Done. %d entries upserted, %d members with speeches.", inserted, members_with_speeches)


if __name__ == "__main__":
    main()
