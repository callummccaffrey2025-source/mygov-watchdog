#!/usr/bin/env python3
"""
check_golden_fixture.py — Regress the live DB against the Laxale golden fixture.

The fixture (evals/golden/laxale.json) is one MP's record frozen at a point in
time. If the pipeline ever corrupts historical data — a vote flips, a tally
changes, the member record drifts — this catches it. One deeply-verified
example beats an aggregate pass rate across 225.

Checks:
  1. Member record fields match exactly (party, electorate, active, photo, email)
  2. Vote aggregates: counts >= frozen values (data only grows)
  3. Rebellion count matches exactly (politically loaded — changes need human review)
  4. Each of the 10 frozen votes still exists with identical vote_cast, tallies, rebelled

Exit 0 = record intact. Exit 1 = REGRESSION — historical data changed.

Usage: python scripts/check_golden_fixture.py
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).parent.parent
load_dotenv(PROJECT_DIR / ".env")

from supabase import create_client

FIXTURE = PROJECT_DIR / "evals" / "golden" / "laxale.json"


def main() -> None:
    fixture = json.loads(FIXTURE.read_text())
    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"],
    )

    member_id = fixture["member"]["id"]
    failures: list[str] = []

    print()
    print("═══════════ GOLDEN FIXTURE: Jerome Laxale ═══════════")
    if not fixture["_meta"].get("founder_verified"):
        print("  ⚠ fixture not yet founder-verified — machine-frozen baseline only")

    # ── 1. Member record ─────────────────────────────────────────────
    r = (
        sb.table("members")
        .select("first_name, last_name, is_active, email, aph_id, photo_url, chamber, party_id, electorate_id")
        .eq("id", member_id)
        .limit(1)
        .execute()
    )
    m = (r.data or [None])[0]
    if not m:
        print("  ✗ member row MISSING")
        failures.append("member row missing")
    else:
        party_name = None
        if m.get("party_id"):
            pr = sb.table("parties").select("name").eq("id", m["party_id"]).limit(1).execute()
            party_name = (pr.data or [{}])[0].get("name")
        electorate_name = None
        if m.get("electorate_id"):
            er = sb.table("electorates").select("name").eq("id", m["electorate_id"]).limit(1).execute()
            electorate_name = (er.data or [{}])[0].get("name")

        f = fixture["member"]
        checks = [
            ("first_name", m.get("first_name"), f["first_name"]),
            ("last_name", m.get("last_name"), f["last_name"]),
            ("party", party_name, f["party"]),
            ("electorate", electorate_name, f["electorate"]),
            ("chamber", m.get("chamber"), f["chamber"]),
            ("is_active", m.get("is_active"), f["is_active"]),
            ("has_photo", m.get("photo_url") is not None, f["has_photo"]),
            ("email", m.get("email"), f["email"]),
            ("aph_id", m.get("aph_id"), f["aph_id"]),
        ]
        bad = [(name, got, want) for name, got, want in checks if got != want]
        if bad:
            for name, got, want in bad:
                print(f"  ✗ member.{name}: expected {want!r}, got {got!r}")
                failures.append(f"member.{name} drift")
        else:
            print("  ✓ member record intact (9 fields)")

    # ── 2 + 3. Vote aggregates ───────────────────────────────────────
    def count_votes(**filters) -> int:
        q = sb.table("division_votes").select("id", count="exact").eq("member_id", member_id)
        for k, v in filters.items():
            q = q.eq(k, v)
        r = q.execute()
        return r.count or 0

    total = count_votes()
    aye = count_votes(vote_cast="aye")
    no = count_votes(vote_cast="no")
    rebellions = count_votes(rebelled=True)

    mins = fixture["vote_aggregates_min"]
    for name, got, frozen in [("total_votes", total, mins["total_votes"]),
                              ("aye_votes", aye, mins["aye_votes"]),
                              ("no_votes", no, mins["no_votes"])]:
        if got < frozen:
            print(f"  ✗ {name}: {got} < frozen {frozen} — votes have been LOST")
            failures.append(f"{name} shrank")
        else:
            print(f"  ✓ {name}: {got} (frozen min {frozen})")

    frozen_reb = fixture["vote_aggregates_exact"]["rebellions"]
    if rebellions != frozen_reb:
        print(f"  ✗ rebellions: {rebellions} != frozen {frozen_reb} — review and re-freeze deliberately if genuine")
        failures.append("rebellion count changed")
    else:
        print(f"  ✓ rebellions: {rebellions} (exact)")

    # ── 4. Frozen individual votes ───────────────────────────────────
    vote_failures = 0
    for fv in fixture["frozen_votes"]:
        r = (
            sb.table("divisions")
            .select("id, name, date, aye_votes, no_votes")
            .eq("tvfy_id", fv["tvfy_id"])
            .limit(1)
            .execute()
        )
        d = (r.data or [None])[0]
        if not d:
            print(f"  ✗ division tvfy_id={fv['tvfy_id']} MISSING")
            failures.append(f"division {fv['tvfy_id']} missing")
            vote_failures += 1
            continue
        problems = []
        if fv["name_contains"].lower() not in (d.get("name") or "").lower():
            problems.append(f"name no longer contains {fv['name_contains']!r}")
        if d.get("date") != fv["date"]:
            problems.append(f"date {d.get('date')} != {fv['date']}")
        if d.get("aye_votes") != fv["aye_votes"] or d.get("no_votes") != fv["no_votes"]:
            problems.append(f"tally {d.get('aye_votes')}–{d.get('no_votes')} != {fv['aye_votes']}–{fv['no_votes']}")

        vr = (
            sb.table("division_votes")
            .select("vote_cast, rebelled")
            .eq("division_id", d["id"])
            .eq("member_id", member_id)
            .limit(1)
            .execute()
        )
        v = (vr.data or [None])[0]
        if not v:
            problems.append("Laxale's vote row missing")
        else:
            if v.get("vote_cast") != fv["vote_cast"]:
                problems.append(f"vote_cast {v.get('vote_cast')!r} != frozen {fv['vote_cast']!r} — A HISTORICAL VOTE FLIPPED")
            if v.get("rebelled") != fv["rebelled"]:
                problems.append(f"rebelled {v.get('rebelled')} != frozen {fv['rebelled']}")

        if problems:
            print(f"  ✗ tvfy_id={fv['tvfy_id']} ({fv['name_contains'][:40]}): " + "; ".join(problems))
            failures.extend(problems)
            vote_failures += 1

    if vote_failures == 0:
        print(f"  ✓ all {len(fixture['frozen_votes'])} frozen votes intact (tallies + vote_cast + rebelled)")

    # ── Verdict ──────────────────────────────────────────────────────
    print()
    if failures:
        print(f"  GOLDEN FIXTURE: FAIL — {len(failures)} regression(s). Historical data changed.")
        print("═" * 53)
        sys.exit(1)
    print("  GOLDEN FIXTURE: PASS — Laxale's record is intact")
    print("═" * 53)


if __name__ == "__main__":
    main()
