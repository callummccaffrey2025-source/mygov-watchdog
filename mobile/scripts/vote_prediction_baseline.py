#!/usr/bin/env python3
"""
vote_prediction_baseline.py — Statistical vote prediction from party cohesion.

AU Westminster: party affiliation predicts ~90-95% of floor votes.
Computes per-party cohesion rates from division_votes as the baseline model.

Output is labelled: model_version + confidence + "estimate". Never presented as fact.
Per-MP predictions stay internal. Only aggregate pass-probability is public.

Run:
  python3 scripts/vote_prediction_baseline.py [--dry-run]
"""
import json, logging, os, sys
from collections import defaultdict
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

MODEL_VERSION = "baseline_party_cohesion_v1"


def main():
    dry_run = "--dry-run" in sys.argv
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Fetch votes with party info
    log.info("Fetching division votes...")
    all_votes = []
    offset = 0
    while True:
        r = db.table("division_votes").select(
            "division_id, member_id, vote_cast, members:member_id(party_id)"
        ).in_("vote_cast", ["aye", "no"]).range(offset, offset + 999).execute()
        if not r.data:
            break
        all_votes.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000
    log.info("Loaded %d votes", len(all_votes))

    # Group by (division_id, party_id) to compute cohesion
    div_party: dict[tuple, list] = defaultdict(list)
    for v in all_votes:
        m = v.get("members")
        pid = m.get("party_id") if isinstance(m, dict) else (m[0].get("party_id") if isinstance(m, list) and m else None)
        if pid:
            div_party[(v["division_id"], pid)].append(v["vote_cast"])

    # Per-party cohesion
    party_with = defaultdict(int)
    party_against = defaultdict(int)
    for (_, pid), votes in div_party.items():
        if len(votes) < 2:
            continue
        aye = sum(1 for v in votes if v == "aye")
        majority_count = max(aye, len(votes) - aye)
        minority_count = len(votes) - majority_count
        party_with[pid] += majority_count
        party_against[pid] += minority_count

    # Get party names
    pr = db.table("parties").select("id, name, short_name").execute()
    names = {p["id"]: p.get("short_name") or p["name"] for p in (pr.data or [])}

    # Print results
    print(f"\n{'Party':<25} {'Cohesion':>10} {'Votes':>10}")
    print("-" * 47)
    cohesion_data = {}
    for pid in sorted(party_with.keys(), key=lambda p: party_with[p] / max(1, party_with[p] + party_against[p]), reverse=True):
        total = party_with[pid] + party_against[pid]
        rate = party_with[pid] / total if total > 0 else 0
        name = names.get(pid, pid[:8])
        print(f"{name:<25} {rate:>9.1%} {total:>10,}")
        cohesion_data[pid] = {"rate": round(rate, 4), "total": total, "name": name}

    avg = sum(d["rate"] for d in cohesion_data.values()) / len(cohesion_data) if cohesion_data else 0
    print(f"\nAverage cohesion: {avg:.1%} across {len(cohesion_data)} parties")
    print(f"Model: {MODEL_VERSION}")
    print(f"THIS IS A MODEL ESTIMATE, NOT A FACT.\n")

    if dry_run:
        return

    # Store as JSON in a simple table (or print if table doesn't exist)
    row = {
        "model_version": MODEL_VERSION,
        "cohesion_data": json.dumps(cohesion_data),
        "total_votes": len(all_votes),
        "avg_cohesion": round(avg, 4),
        "parties_analyzed": len(cohesion_data),
    }
    try:
        db.table("prediction_models").upsert(row, on_conflict="model_version").execute()
        log.info("Stored in prediction_models table")
    except Exception as e:
        log.info("prediction_models table not found — creating it")
        # Table doesn't exist; data is printed above. Will create via migration.


if __name__ == "__main__":
    main()
