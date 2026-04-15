#!/usr/bin/env python3
"""
audit_data.py — Data quality report for Verity's Supabase database.

Checks:
  - Members missing party or electorate links
  - Bills with null/empty titles
  - Electorates with no member linked
  - Postcode → electorate → member chain for 9 key postcodes

No writes — read-only diagnostic tool.
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

TEST_POSTCODES = [
    ("2000", "Sydney"),
    ("2060", "North Sydney"),
    ("2110", "Bennelong"),
    ("3000", "Melbourne"),
    ("4000", "Brisbane"),
    ("5000", "Adelaide"),
    ("6000", "Perth"),
    ("7000", "Hobart"),
    ("2600", "Canberra"),
]

def section(title: str) -> None:
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")

def main() -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("ERROR: Missing SUPABASE_URL / SUPABASE_KEY"); sys.exit(1)

    db = create_client(url, key)

    # ── 1. Members overview ──────────────────────────────────────────────────
    section("1. MEMBERS OVERVIEW")
    members = (db.table("members").select("id,first_name,last_name,chamber,party_id,electorate_id,is_active").execute()).data or []
    active = [m for m in members if m.get("is_active")]
    print(f"  Total members: {len(members)}  |  Active: {len(active)}")

    no_party = [m for m in active if not m.get("party_id")]
    if no_party:
        print(f"\n  ⚠  {len(no_party)} active members missing party_id:")
        for m in no_party:
            print(f"     • {m['first_name']} {m['last_name']} ({m.get('chamber', '?')})")
    else:
        print("  ✓  All active members have a party_id")

    house_members = [m for m in active if (m.get("chamber") or "").lower() == "house"]
    no_electorate_house = [m for m in house_members if not m.get("electorate_id")]
    if no_electorate_house:
        print(f"\n  ⚠  {len(no_electorate_house)} House members missing electorate_id:")
        for m in no_electorate_house[:10]:
            print(f"     • {m['first_name']} {m['last_name']}")
        if len(no_electorate_house) > 10:
            print(f"     ... and {len(no_electorate_house)-10} more")
    else:
        print(f"  ✓  All {len(house_members)} House members have an electorate_id")

    # ── 2. Bills with null/empty titles ─────────────────────────────────────
    section("2. BILLS WITH NULL / EMPTY TITLES")
    bad_bills = (db.table("bills").select("id,title").is_("title", "null").execute()).data or []
    empty_bills = (db.table("bills").select("id,title").eq("title", "").execute()).data or []
    if bad_bills or empty_bills:
        print(f"  ⚠  {len(bad_bills)} bills with NULL title, {len(empty_bills)} with empty title")
    else:
        print("  ✓  All bills have non-null, non-empty titles")

    # ── 3. Electorates with no member ───────────────────────────────────────
    section("3. ELECTORATES WITH NO MEMBER LINKED")
    electorates = (db.table("electorates").select("id,name,state,level").eq("level", "federal").execute()).data or []
    electorate_ids_with_members = {m["electorate_id"] for m in active if m.get("electorate_id")}
    unlinked = [e for e in electorates if e["id"] not in electorate_ids_with_members]
    if unlinked:
        print(f"  ⚠  {len(unlinked)} federal electorates have no active member linked:")
        for e in unlinked[:15]:
            print(f"     • {e['name']} ({e['state']})")
        if len(unlinked) > 15:
            print(f"     ... and {len(unlinked)-15} more")
    else:
        print("  ✓  All federal electorates have a member linked")

    # ── 4. Bill status distribution ──────────────────────────────────────────
    section("4. BILL STATUS DISTRIBUTION (top 10)")
    bills_statuses = (db.table("bills").select("current_status").execute()).data or []
    from collections import Counter
    status_counts = Counter(b.get("current_status") or "NULL" for b in bills_statuses)
    for status, count in status_counts.most_common(10):
        print(f"  {count:>5}  {status}")

    # ── 5. Postcode chain verification ───────────────────────────────────────
    section("5. POSTCODE → ELECTORATE → MEMBER CHAIN")
    # Check if postcodes table exists
    try:
        db.table("postcodes").select("electorate_id").limit(1).execute()
    except Exception as e:
        print(f"  ⚠  postcodes table not found — skipping ({e})")
        print(f"{'─'*60}\nAudit complete.\n")
        return

    parties_resp = db.table("parties").select("id,name,short_name").execute()
    party_map = {p["id"]: p.get("short_name") or p["name"] for p in (parties_resp.data or [])}

    member_by_electorate = {}
    for m in active:
        eid = m.get("electorate_id")
        if eid:
            member_by_electorate[eid] = m

    for postcode, area in TEST_POSTCODES:
        pc_resp = db.table("postcodes").select("electorate_id").eq("postcode", postcode).limit(1).execute()
        pc_data = pc_resp.data[0] if pc_resp.data else None
        if not pc_data:
            print(f"  ✗  {postcode} ({area})  →  no postcode record")
            continue

        electorate_id = pc_data.get("electorate_id")
        if not electorate_id:
            print(f"  ✗  {postcode} ({area})  →  postcode has no electorate_id")
            continue

        e_resp = db.table("electorates").select("name,state").eq("id", electorate_id).limit(1).execute()
        e_data = e_resp.data[0] if e_resp.data else None
        if not e_data:
            print(f"  ✗  {postcode} ({area})  →  electorate record missing")
            continue

        electorate_name = e_data["name"]
        electorate_state = e_data["state"]

        member = member_by_electorate.get(electorate_id)
        if not member:
            print(f"  ✗  {postcode} ({area})  →  {electorate_name} ({electorate_state})  →  no member linked")
        else:
            party = party_map.get(member.get("party_id") or "", "?")
            print(f"  ✓  {postcode} ({area})  →  {electorate_name}  →  {member['first_name']} {member['last_name']} ({party})")

    print(f"\n{'─'*60}\nAudit complete.\n")


if __name__ == "__main__":
    main()
