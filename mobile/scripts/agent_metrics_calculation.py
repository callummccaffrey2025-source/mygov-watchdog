#!/usr/bin/env python3
"""
agent_metrics_calculation.py — Metrics Calculation Agent (Agent 3)

Calculates member participation statistics from votes and divisions tables:
  - For each member: total votes cast, participation rate
  - Overall division count (total possible votes)

READ-ONLY on votes/divisions/members tables.
Writes results as a JSON summary in the agent_runs logs field only —
does NOT write to a separate metrics table (yet).

METHODOLOGY NOTE: The participation rate is calculated as:
    participation_rate = votes_cast / total_divisions
This methodology must NOT be changed without explicit human approval.
If the calculation logic needs updating, a human must review and approve
the change before it is deployed.

Outputs JSON metrics on last line for orchestrator.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import agent_guard

AGENT_NAME = "metrics_calculation"

log = agent_guard.log


def calculate_participation(sb) -> dict:
    """
    Calculate participation stats for all members.

    Queries:
      - SELECT count(*) FROM divisions  (total possible votes)
      - SELECT member_id, count(*) FROM votes GROUP BY member_id
      - SELECT id, first_name, last_name, party FROM members

    Returns a summary dict with per-member stats and aggregates.
    """
    result = {
        "total_divisions": 0,
        "total_members_with_votes": 0,
        "total_members": 0,
        "avg_participation_rate": 0.0,
        "member_stats": [],
        "confidence_note": (
            "Participation rate = votes_cast / total_divisions. "
            "This is a simple ratio and does not account for members who joined "
            "mid-term, were on leave, or are in the Senate vs House (different "
            "division counts). Treat as an approximate indicator only."
        ),
    }

    # 1. Count total divisions
    div_resp = sb.table("divisions").select("id", count="exact").execute()
    total_divisions = div_resp.count or 0
    result["total_divisions"] = total_divisions

    if total_divisions == 0:
        log.info("No divisions found in database (empty/branch DB). Returning empty stats.")
        result["confidence_note"] += " Database has zero divisions — likely a branch with no data."
        return result

    # 2. Count votes per member
    # Supabase JS-style grouping isn't directly available, so we paginate
    # through votes. For efficiency, use a limited approach.
    # Fetch vote counts per member (the votes table may be large, so we
    # aggregate server-side if possible, otherwise paginate).
    vote_counts = {}
    rows_read = 0

    # Try fetching in pages of 1000
    page_size = 1000
    offset = 0
    while True:
        batch = (
            sb.table("votes")
            .select("member_id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not batch.data:
            break
        for row in batch.data:
            mid = row.get("member_id")
            if mid:
                vote_counts[mid] = vote_counts.get(mid, 0) + 1
        rows_read += len(batch.data)
        if len(batch.data) < page_size:
            break
        offset += page_size

    result["total_members_with_votes"] = len(vote_counts)

    # 3. Get member names for context
    members_resp = (
        sb.table("members")
        .select("id,first_name,last_name,party")
        .execute()
    )
    members_map = {}
    for m in (members_resp.data or []):
        members_map[m["id"]] = m
    result["total_members"] = len(members_map)
    rows_read += len(members_map)

    # 4. Build per-member stats
    member_stats = []
    for member_id, votes_cast in vote_counts.items():
        rate = round(votes_cast / total_divisions, 4) if total_divisions > 0 else 0.0
        member_info = members_map.get(member_id, {})
        member_stats.append({
            "member_id": member_id,
            "name": f"{member_info.get('first_name', '?')} {member_info.get('last_name', '?')}",
            "party": member_info.get("party", "Unknown"),
            "votes_cast": votes_cast,
            "participation_rate": rate,
        })

    # Sort by participation rate descending
    member_stats.sort(key=lambda x: x["participation_rate"], reverse=True)

    # Calculate averages
    if member_stats:
        avg_rate = sum(s["participation_rate"] for s in member_stats) / len(member_stats)
        result["avg_participation_rate"] = round(avg_rate, 4)

    # Store top 20 and bottom 20 in logs (full list would be too large)
    result["member_stats_top20"] = member_stats[:20]
    result["member_stats_bottom20"] = member_stats[-20:] if len(member_stats) > 20 else []
    result["rows_read"] = rows_read

    return result


def main():
    sb = agent_guard.init(AGENT_NAME)
    run_id = agent_guard.log_run_start(sb, AGENT_NAME)

    try:
        log.info("Calculating participation metrics ...")
        stats = calculate_participation(sb)

        rows_read = stats.pop("rows_read", 0)

        log.info(
            "Metrics complete: %d divisions, %d members with votes, avg rate %.2f%%",
            stats["total_divisions"],
            stats["total_members_with_votes"],
            stats["avg_participation_rate"] * 100,
        )

        agent_guard.log_run_end(
            sb, run_id,
            status="succeeded",
            rows_read=rows_read,
            rows_written=0,  # Read-only agent — writes only to agent_runs logs
            logs=stats,
        )

        metrics = {
            "rows_read": rows_read,
            "rows_written": 0,
            "rows_flagged": 0,
            "tokens_used": 0,
            "cost_usd": 0.0,
            "total_divisions": stats["total_divisions"],
            "members_with_votes": stats["total_members_with_votes"],
            "avg_participation_rate": stats["avg_participation_rate"],
        }
        print(json.dumps(metrics))
        sys.exit(0)

    except Exception as e:
        agent_guard.log_run_end(
            sb, run_id,
            status="failed",
            error_message=str(e),
        )
        log.exception("Metrics calculation agent failed")
        print(json.dumps({
            "rows_read": 0,
            "rows_written": 0,
            "rows_flagged": 0,
            "tokens_used": 0,
            "cost_usd": 0.0,
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
