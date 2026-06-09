#!/usr/bin/env python3
"""
backfill_knowledge_graph.py — Populate entity_relationships from existing tables.

Derives typed, sourced edges from:
  1. members → parties (member_of_party)
  2. members → electorates (represents_electorate)
  3. committee_memberships (committee_member / committee_chair)
  4. individual_donations (received_donation / donated_to_member)
  5. registered_interests (declared_interest)
  6. division_votes where rebelled=true (crossed_floor)

Every edge has extraction_method='backfill' and confidence=1.0 (these are facts).

Run:
  python3 scripts/backfill_knowledge_graph.py [--dry-run]
"""
import os
import sys
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

BATCH_SIZE = 100


def insert_edges(db, edges: list[dict], dry_run: bool) -> int:
    if not edges:
        return 0
    if dry_run:
        return len(edges)
    inserted = 0
    for i in range(0, len(edges), BATCH_SIZE):
        batch = edges[i:i + BATCH_SIZE]
        try:
            db.table("entity_relationships").upsert(
                batch,
                on_conflict="source_entity_type,source_entity_id,target_entity_type,target_entity_id,relationship_type",
            ).execute()
            inserted += len(batch)
        except Exception as e:
            # Fallback: insert one by one, skip duplicates
            for edge in batch:
                try:
                    db.table("entity_relationships").insert(edge).execute()
                    inserted += 1
                except Exception:
                    pass  # duplicate or constraint violation
    return inserted


def backfill_party_membership(db, dry_run: bool) -> int:
    """members → parties"""
    r = db.table("members").select("id, party_id").eq("is_active", True).not_.is_("party_id", "null").execute()
    edges = []
    for m in (r.data or []):
        edges.append({
            "source_entity_type": "member",
            "source_entity_id": m["id"],
            "target_entity_type": "party",
            "target_entity_id": m["party_id"],
            "relationship_type": "member_of_party",
            "source_table": "members",
            "extraction_method": "backfill",
            "confidence": 1.0,
        })
    return insert_edges(db, edges, dry_run)


def backfill_electorate_representation(db, dry_run: bool) -> int:
    """members → electorates"""
    r = db.table("members").select("id, electorate_id").eq("is_active", True).not_.is_("electorate_id", "null").execute()
    edges = []
    for m in (r.data or []):
        edges.append({
            "source_entity_type": "member",
            "source_entity_id": m["id"],
            "target_entity_type": "electorate",
            "target_entity_id": m["electorate_id"],
            "relationship_type": "represents_electorate",
            "source_table": "members",
            "extraction_method": "backfill",
            "confidence": 1.0,
        })
    return insert_edges(db, edges, dry_run)


def backfill_committees(db, dry_run: bool) -> int:
    """committee_memberships → committee_member / committee_chair"""
    r = db.table("committee_memberships").select("member_id, committee_name, committee_type, role, start_date, end_date").execute()
    edges = []
    for cm in (r.data or []):
        rel_type = "committee_chair" if cm.get("role") == "chair" else "committee_member"
        edges.append({
            "source_entity_type": "member",
            "source_entity_id": cm["member_id"],
            "target_entity_type": "committee",
            "target_entity_id": cm["committee_name"],
            "relationship_type": rel_type,
            "relationship_subtype": cm.get("role"),
            "start_date": cm.get("start_date"),
            "end_date": cm.get("end_date"),
            "source_table": "committee_memberships",
            "extraction_method": "backfill",
            "confidence": 1.0,
        })
    return insert_edges(db, edges, dry_run)


def backfill_donations(db, dry_run: bool) -> int:
    """individual_donations → received_donation"""
    r = db.table("individual_donations").select("member_id, donor_name, amount, financial_year").not_.is_("member_id", "null").execute()
    edges = []
    seen = set()
    for d in (r.data or []):
        key = (d["member_id"], d["donor_name"])
        if key in seen:
            continue
        seen.add(key)
        edges.append({
            "source_entity_type": "donor",
            "source_entity_id": d["donor_name"],
            "target_entity_type": "member",
            "target_entity_id": d["member_id"],
            "relationship_type": "donated_to_member",
            "source_table": "individual_donations",
            "source_excerpt": f"${d.get('amount', '?')} in {d.get('financial_year', '?')}",
            "extraction_method": "backfill",
            "confidence": 1.0,
        })
    return insert_edges(db, edges, dry_run)


def backfill_interests(db, dry_run: bool) -> int:
    """registered_interests → declared_interest"""
    r = db.table("registered_interests").select("member_id, category, description, source_url").execute()
    edges = []
    for ri in (r.data or []):
        edges.append({
            "source_entity_type": "member",
            "source_entity_id": ri["member_id"],
            "target_entity_type": "interest",
            "target_entity_id": f"{ri.get('category', 'unknown')}:{(ri.get('description') or '')[:50]}",
            "relationship_type": "declared_interest",
            "relationship_subtype": ri.get("category"),
            "source_url": ri.get("source_url"),
            "source_excerpt": (ri.get("description") or "")[:200],
            "source_table": "registered_interests",
            "extraction_method": "backfill",
            "confidence": 1.0,
        })
    return insert_edges(db, edges, dry_run)


def backfill_rebellions(db, dry_run: bool) -> int:
    """division_votes where rebelled=true → crossed_floor"""
    r = db.table("division_votes").select(
        "member_id, division_id, vote_cast, divisions(name, date)"
    ).eq("rebelled", True).limit(500).execute()
    edges = []
    for dv in (r.data or []):
        div = dv.get("divisions") or {}
        edges.append({
            "source_entity_type": "member",
            "source_entity_id": dv["member_id"],
            "target_entity_type": "division",
            "target_entity_id": dv["division_id"],
            "relationship_type": "crossed_floor",
            "source_excerpt": f"Voted {dv['vote_cast']} on {div.get('name', '?')[:80]}",
            "start_date": div.get("date"),
            "source_table": "division_votes",
            "extraction_method": "backfill",
            "confidence": 1.0,
        })
    return insert_edges(db, edges, dry_run)


def main():
    dry_run = "--dry-run" in sys.argv

    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    print(f"\n{'=' * 60}")
    print(f"KNOWLEDGE GRAPH BACKFILL")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"{'=' * 60}\n")

    total = 0

    tasks = [
        ("Party membership", backfill_party_membership),
        ("Electorate representation", backfill_electorate_representation),
        ("Committee memberships", backfill_committees),
        ("Donations received", backfill_donations),
        ("Declared interests", backfill_interests),
        ("Floor crossings", backfill_rebellions),
    ]

    for label, fn in tasks:
        count = fn(db, dry_run)
        total += count
        print(f"  {label}: {count} edges")

    print(f"\n{'=' * 60}")
    print(f"TOTAL EDGES: {total}")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
