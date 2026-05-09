#!/usr/bin/env python3
"""
calculate_participation_index.py — Compute participation metrics for all active MPs
and populate the participation_index table.

Dimensions:
  1. Voting participation: votes_cast / divisions_eligible
  2. Parliamentary activity: speeches + questions from hansard
  3. Independence: votes against party / total votes
  4. Committee engagement: active committees + inquiry participations

Uses Wilson score intervals for confidence indicators.
Methodology version: v1.0 — raw counts + percentile ranking within chamber.
"""

import json
import logging
import math
import os
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

METHODOLOGY_VERSION = "v1.0"


def wilson_ci(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score confidence interval (95%)."""
    if total == 0:
        return (0.0, 0.0)
    p = successes / total
    denom = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denom
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denom
    return (max(0, centre - spread), min(1, centre + spread))


def percentile_rank(values: list[float], value: float) -> float:
    """Compute percentile rank of value within the list."""
    if not values:
        return 50.0
    below = sum(1 for v in values if v < value)
    equal = sum(1 for v in values if v == value)
    return round(((below + equal * 0.5) / len(values)) * 100, 1)


def main():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)
    dry_run = "--dry-run" in sys.argv

    # Period: last 12 months
    period_end = datetime.now(timezone.utc).date()
    period_start = period_end - timedelta(days=365)

    log.info("Calculating participation index for period %s to %s", period_start, period_end)

    # Get all active members
    members_result = db.table("members").select("id, first_name, last_name, chamber, party_id").eq("is_active", True).execute()
    members = members_result.data
    log.info("Active members: %d", len(members))

    # Get all divisions in period, grouped by chamber
    # Divisions use "representatives"/"senate", members use "house"/"senate"
    CHAMBER_MAP = {"representatives": "house", "senate": "senate"}
    divisions_data = []
    offset = 0
    PAGE = 1000
    while True:
        result = (db.table("divisions").select("id, date, chamber")
                  .gte("date", str(period_start))
                  .lte("date", str(period_end))
                  .range(offset, offset + PAGE - 1)
                  .execute())
        divisions_data.extend(result.data)
        if len(result.data) < PAGE:
            break
        offset += PAGE

    # Build chamber-specific division sets
    division_ids_all = {d["id"] for d in divisions_data}
    division_ids_by_chamber: dict[str, set] = {"house": set(), "senate": set()}
    for d in divisions_data:
        mapped = CHAMBER_MAP.get(d.get("chamber", ""), "house")
        division_ids_by_chamber[mapped].add(d["id"])
    log.info("Divisions in period: %d (house=%d, senate=%d)",
             len(division_ids_all),
             len(division_ids_by_chamber["house"]),
             len(division_ids_by_chamber["senate"]))

    # Get all division_votes (paginated — Supabase default limit is 1000)
    all_votes = []
    offset = 0
    PAGE = 1000
    while True:
        result = (db.table("division_votes")
                  .select("member_id, division_id, vote_cast, rebelled")
                  .range(offset, offset + PAGE - 1)
                  .execute())
        all_votes.extend(result.data)
        if len(result.data) < PAGE:
            break
        offset += PAGE
    log.info("Total division votes: %d", len(all_votes))

    # Build per-member vote stats (only period divisions)
    member_votes: dict[str, list[dict]] = {}
    for v in all_votes:
        if v["division_id"] in division_ids_all:
            mid = v["member_id"]
            if mid not in member_votes:
                member_votes[mid] = []
            member_votes[mid].append(v)

    # Compute party majority per division for rebellion detection
    # For each division, find what most members of each party voted
    member_party: dict[str, str] = {}  # member_id → party_id
    for m in members:
        if m.get("party_id"):
            member_party[m["id"]] = m["party_id"]

    party_division_majority: dict[str, dict[str, str]] = {}  # division_id → {party_id → majority_vote}
    division_party_votes: dict[str, dict[str, dict[str, int]]] = {}  # div → party → {aye: N, no: N}
    for v in all_votes:
        did = v["division_id"]
        if did not in division_ids_all:
            continue
        mid = v.get("member_id")
        if not mid or mid not in member_party:
            continue
        pid = member_party[mid]
        vc = v.get("vote_cast", "")
        if vc not in ("aye", "no"):
            continue
        if did not in division_party_votes:
            division_party_votes[did] = {}
        if pid not in division_party_votes[did]:
            division_party_votes[did][pid] = {"aye": 0, "no": 0}
        division_party_votes[did][pid][vc] += 1

    for did, parties in division_party_votes.items():
        party_division_majority[did] = {}
        for pid, counts in parties.items():
            party_division_majority[did][pid] = "aye" if counts["aye"] >= counts["no"] else "no"
    log.info("Computed party majorities for %d divisions", len(party_division_majority))

    # Get hansard entries in period (paginated)
    hansard_data = []
    offset = 0
    while True:
        result = (db.table("hansard_entries").select("member_id, debate_topic")
                  .gte("date", str(period_start))
                  .lte("date", str(period_end))
                  .range(offset, offset + PAGE - 1)
                  .execute())
        hansard_data.extend(result.data)
        if len(result.data) < PAGE:
            break
        offset += PAGE
    member_speeches: dict[str, list[dict]] = {}
    for h in hansard_data:
        mid = h.get("member_id")
        if mid:
            if mid not in member_speeches:
                member_speeches[mid] = []
            member_speeches[mid].append(h)
    log.info("Hansard entries in period: %d", len(hansard_data))

    # Get committee memberships
    committees_result = db.table("committee_memberships").select("member_id, role").execute()
    member_committees: dict[str, list[dict]] = {}
    for c in committees_result.data:
        mid = c["member_id"]
        if mid not in member_committees:
            member_committees[mid] = []
        member_committees[mid].append(c)

    # Calculate per-member scores
    rows = []
    voting_values = []
    activity_values = []
    independence_values = []
    committee_values = []

    for m in members:
        mid = m["id"]
        votes = member_votes.get(mid, [])
        speeches = member_speeches.get(mid, [])
        committees = member_committees.get(mid, [])

        # Voting participation — chamber-filtered
        chamber = m.get("chamber", "house")
        chamber_divisions = division_ids_by_chamber.get(chamber, division_ids_all)
        divisions_eligible = len(chamber_divisions)
        # Only count votes in this member's chamber's divisions
        chamber_votes = [v for v in votes if v["division_id"] in chamber_divisions]
        votes_cast = len([v for v in chamber_votes if v.get("vote_cast") in ("aye", "no", "yes")])
        paired = len([v for v in chamber_votes if v.get("vote_cast") in ("paired", "pair")])
        effective_eligible = divisions_eligible - paired
        voting_pct = (votes_cast / effective_eligible * 100) if effective_eligible > 0 else 0
        voting_ci = wilson_ci(votes_cast, effective_eligible)

        # Parliamentary activity
        speeches_total = len(speeches)
        questions = len([s for s in speeches if s.get("debate_topic") and
                        ("question" in s["debate_topic"].lower() or
                         "without notice" in s["debate_topic"].lower())])
        speeches_substantive = speeches_total - questions
        activity_score = speeches_total

        # Independence — computed from party majority (since rebelled field is always false)
        party_id = m.get("party_id")
        votes_with = 0
        votes_against = 0
        for v in chamber_votes:
            vc = v.get("vote_cast", "")
            if vc not in ("aye", "no"):
                continue
            did = v["division_id"]
            if party_id and did in party_division_majority and party_id in party_division_majority[did]:
                majority = party_division_majority[did][party_id]
                if vc == majority:
                    votes_with += 1
                else:
                    votes_against += 1
            else:
                votes_with += 1  # No party data = assume aligned
        substantive = votes_with + votes_against
        independence_pct = (votes_against / substantive * 100) if substantive > 0 else 0
        independence_ci = wilson_ci(votes_against, substantive)

        # Committee engagement
        active_committees = len(committees)
        committee_score = active_committees

        voting_values.append(voting_pct)
        activity_values.append(activity_score)
        independence_values.append(independence_pct)
        committee_values.append(committee_score)

        rows.append({
            "member_id": mid,
            "methodology_version": METHODOLOGY_VERSION,
            "period_start": str(period_start),
            "period_end": str(period_end),
            "speeches_total": speeches_total,
            "speeches_substantive": speeches_substantive,
            "questions_asked": questions,
            "parliamentary_activity_value": round(activity_score, 2),
            "divisions_eligible": effective_eligible,
            "votes_cast": votes_cast,
            "voting_participation_value": round(voting_pct, 2),
            "voting_participation_ci_low": round(voting_ci[0] * 100, 2),
            "voting_participation_ci_high": round(voting_ci[1] * 100, 2),
            "votes_with_party": votes_with,
            "votes_against_party": votes_against,
            "independence_value": round(independence_pct, 2),
            "independence_ci_low": round(independence_ci[0] * 100, 2),
            "independence_ci_high": round(independence_ci[1] * 100, 2),
            "active_committees": active_committees,
            "inquiry_participations": 0,  # Not yet tracked
            "committee_value": committee_score,
            "context_flags": [],
            "excluded_from_comparison": False,
            "sample_size": votes_cast,
            "_name": f"{m['first_name']} {m['last_name']}",  # temp for logging
        })

    # Compute percentiles
    for row in rows:
        row["parliamentary_activity_percentile"] = percentile_rank(activity_values, row["parliamentary_activity_value"])
        row["voting_participation_percentile"] = percentile_rank(voting_values, row["voting_participation_value"])
        row["independence_percentile"] = percentile_rank(independence_values, row["independence_value"])
        row["committee_percentile"] = percentile_rank(committee_values, row["committee_value"])

    log.info("Calculated scores for %d members", len(rows))

    if dry_run:
        # Show top 5 by each dimension
        log.info("\nTop 5 by voting participation:")
        for r in sorted(rows, key=lambda x: x["voting_participation_value"], reverse=True)[:5]:
            log.info("  %s: %.1f%% (%d/%d)", r["_name"], r["voting_participation_value"], r["votes_cast"], r["divisions_eligible"])

        log.info("\nTop 5 by speeches:")
        for r in sorted(rows, key=lambda x: x["speeches_total"], reverse=True)[:5]:
            log.info("  %s: %d speeches, %d questions", r["_name"], r["speeches_total"], r["questions_asked"])

        log.info("\nTop 5 by independence (rebels):")
        for r in sorted(rows, key=lambda x: x["independence_value"], reverse=True)[:5]:
            log.info("  %s: %.1f%% (%d rebellions)", r["_name"], r["independence_value"], r["votes_against_party"])

        log.info("\nTop 5 by committees:")
        for r in sorted(rows, key=lambda x: x["active_committees"], reverse=True)[:5]:
            log.info("  %s: %d committees", r["_name"], r["active_committees"])
        return

    # Clean up temp field and upsert
    for row in rows:
        del row["_name"]

    # Clear existing data for this period
    db.table("participation_index").delete().eq("methodology_version", METHODOLOGY_VERSION).execute()

    # Insert in batches
    BATCH = 50
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        result = db.table("participation_index").insert(batch).execute()
        total += len(result.data)

    log.info("Done. %d participation index rows inserted.", total)


if __name__ == "__main__":
    main()
