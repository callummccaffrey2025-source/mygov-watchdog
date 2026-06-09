#!/usr/bin/env python3
"""
bill_diff_engine.py — Compute structured diffs between bill versions.

Detects:
1. Status changes (reading progression, defeat, withdrawal)
2. Summary changes (paragraph-level diff with before/after spans)
3. Title changes (renamed between readings)
4. Progress stage additions (new reading stages)
5. Loophole flags: changes that benefit specific entities (keyword heuristic)

Usage:
  # Compute deltas for all bills with 2+ versions
  python3 scripts/bill_diff_engine.py

  # Compute for a specific bill
  python3 scripts/bill_diff_engine.py --bill-id <uuid>

  # Dry run
  python3 scripts/bill_diff_engine.py --dry-run
"""
import difflib
import json
import logging
import os
import re
import sys
from typing import Any

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


# ── Beneficiary detection keywords ──────────────────────────────────────────

SECTOR_KEYWORDS = {
    "mining": ["mining", "mineral", "coal", "iron ore", "bauxite", "lithium", "resources"],
    "banking": ["bank", "financial services", "lending", "credit", "mortgage", "finance"],
    "property": ["property", "real estate", "housing", "developer", "construction", "land"],
    "energy": ["energy", "gas", "oil", "petroleum", "electricity", "power", "renewable"],
    "defence": ["defence", "defense", "military", "arms", "weapons", "security contractor"],
    "pharmaceutical": ["pharmaceutical", "drug", "medicine", "health insurance", "pharmacy"],
    "agriculture": ["agriculture", "farming", "livestock", "pastoral", "grain", "dairy"],
    "technology": ["technology", "software", "data", "digital", "telecommunications", "telco"],
    "media": ["media", "broadcasting", "publishing", "news", "entertainment"],
    "gambling": ["gambling", "gaming", "casino", "wagering", "betting"],
    "tobacco": ["tobacco", "cigarette", "nicotine", "vaping"],
    "alcohol": ["alcohol", "liquor", "brewery", "winery"],
    "education": ["university", "education", "school", "HECS", "student"],
    "superannuation": ["superannuation", "retirement", "pension", "super fund"],
}


def detect_beneficiary(text: str) -> list[dict]:
    """Detect potential beneficiaries from changed text using keyword heuristics."""
    lower = text.lower()
    matches = []
    for sector, keywords in SECTOR_KEYWORDS.items():
        matched_kws = [kw for kw in keywords if kw in lower]
        if len(matched_kws) >= 2:
            matches.append({
                "sector": sector,
                "keywords": matched_kws,
                "confidence": min(0.3 + 0.1 * len(matched_kws), 0.8),
            })
    return sorted(matches, key=lambda m: m["confidence"], reverse=True)


# ── Paragraph-level diff ───────────────────────────────────────────────────

def diff_summaries(old: str | None, new: str | None) -> list[dict]:
    """Compute paragraph-level diff between two summaries."""
    if not old and not new:
        return []
    if not old:
        return [{"type": "added", "text": new, "section": "summary"}]
    if not new:
        return [{"type": "removed", "text": old, "section": "summary"}]

    old_paras = [p.strip() for p in old.split('\n') if p.strip()]
    new_paras = [p.strip() for p in new.split('\n') if p.strip()]

    changes = []
    matcher = difflib.SequenceMatcher(None, old_paras, new_paras)

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            continue
        elif tag == 'replace':
            changes.append({
                "type": "modified",
                "before": '\n'.join(old_paras[i1:i2]),
                "after": '\n'.join(new_paras[j1:j2]),
                "section": f"paragraph_{i1+1}",
            })
        elif tag == 'insert':
            changes.append({
                "type": "added",
                "text": '\n'.join(new_paras[j1:j2]),
                "section": f"after_paragraph_{i1}",
            })
        elif tag == 'delete':
            changes.append({
                "type": "removed",
                "text": '\n'.join(old_paras[i1:i2]),
                "section": f"paragraph_{i1+1}",
            })

    return changes


# ── Loophole flag heuristics ───────────────────────────────────────────────

def detect_loophole_flags(
    from_version: dict,
    to_version: dict,
    changed_sections: list[dict],
) -> list[dict]:
    """
    Flag potential loopholes: changes that may disproportionately benefit
    specific entities. Returns flags with source spans.

    A flag is NOT an accusation. It's a factual statement:
    "This clause was added/changed between readings. Here's what changed
    and who it may benefit."
    """
    flags = []

    for change in changed_sections:
        changed_text = change.get("after") or change.get("text") or ""
        if not changed_text or len(changed_text) < 20:
            continue

        beneficiaries = detect_beneficiary(changed_text)
        if not beneficiaries:
            continue

        # Only flag if there's a reading stage change (between readings = suspicious)
        from_stage = from_version.get("reading_stage", "")
        to_stage = to_version.get("reading_stage", "")
        between_readings = from_stage != to_stage

        for b in beneficiaries[:1]:  # Top beneficiary only
            flags.append({
                "flag_type": "beneficiary_change",
                "severity": "medium" if between_readings else "low",
                "sector": b["sector"],
                "confidence": b["confidence"],
                "change_type": change["type"],
                "source_span": {
                    "before": change.get("before", ""),
                    "after": changed_text[:500],
                    "section": change.get("section", ""),
                },
                "between_readings": between_readings,
                "from_stage": from_stage,
                "to_stage": to_stage,
            })

    return flags


# ── Main diff computation ─────────────────────────────────────────────────

def compute_delta(from_v: dict, to_v: dict) -> dict:
    """Compute a structured delta between two consecutive versions."""
    status_changed = from_v.get("status_snapshot") != to_v.get("status_snapshot")
    title_changed = from_v.get("title_snapshot") != to_v.get("title_snapshot")
    summary_changed = from_v.get("summary_snapshot") != to_v.get("summary_snapshot")

    # Paragraph-level diff
    changed_sections = diff_summaries(
        from_v.get("summary_snapshot"),
        to_v.get("summary_snapshot"),
    )

    # New progress stages
    from_stages = set(json.dumps(s, sort_keys=True) for s in (from_v.get("progress_snapshot") or []))
    to_stages = to_v.get("progress_snapshot") or []
    new_stages = [s for s in to_stages if json.dumps(s, sort_keys=True) not in from_stages]

    # Build change summary
    parts = []
    if status_changed:
        parts.append(f"Status: {from_v.get('status_snapshot')} -> {to_v.get('status_snapshot')}")
    if title_changed:
        parts.append("Title modified")
    if summary_changed:
        parts.append(f"Summary changed ({len(changed_sections)} section{'s' if len(changed_sections) != 1 else ''})")
    for stage in new_stages:
        parts.append(f"New stage: {stage.get('stage', '?')} ({stage.get('chamber', '?')})")
    change_summary = "; ".join(parts) if parts else "Minor metadata change"

    # Beneficiary from changed text
    all_changed_text = " ".join(
        (c.get("after") or c.get("text") or "") for c in changed_sections
    )
    beneficiaries = detect_beneficiary(all_changed_text)
    top_beneficiary = beneficiaries[0]["sector"] if beneficiaries else None

    # Loophole flags
    loophole_flags = detect_loophole_flags(from_v, to_v, changed_sections)

    # Source spans for traceability
    source_spans = []
    for cs in changed_sections:
        span = {"section": cs.get("section", ""), "type": cs["type"]}
        if cs.get("before"):
            span["from_text"] = cs["before"][:300]
        if cs.get("after") or cs.get("text"):
            span["to_text"] = (cs.get("after") or cs.get("text", ""))[:300]
        source_spans.append(span)

    return {
        "status_changed": status_changed,
        "title_changed": title_changed,
        "summary_changed": summary_changed,
        "progress_stages_added": new_stages,
        "change_summary": change_summary,
        "changed_sections": changed_sections,
        "beneficiary": top_beneficiary,
        "source_spans": source_spans,
        "loophole_flags": loophole_flags,
    }


# ── CLI ────────────────────────────────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv
    target_bill = None
    for i, arg in enumerate(sys.argv):
        if arg == "--bill-id" and i + 1 < len(sys.argv):
            target_bill = sys.argv[i + 1]

    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    # Find bills with 2+ versions that don't have deltas yet
    query = db.table("bill_versions").select("bill_id").order("bill_id")
    if target_bill:
        query = query.eq("bill_id", target_bill)
    r = query.execute()

    # Group by bill_id
    versions_by_bill: dict[str, list] = {}
    for v in (r.data or []):
        versions_by_bill.setdefault(v["bill_id"], []).append(v)

    # Only process bills with 2+ versions
    multi_version = {bid: vs for bid, vs in versions_by_bill.items() if len(vs) >= 2}

    log.info("Bills with 2+ versions: %d", len(multi_version))

    if not multi_version:
        log.info("No multi-version bills found. Deltas will be computed when new versions are ingested.")
        log.info("Run `python3 scripts/ingest_federal_bills.py` after APH access is restored to create version 2+.")
        return

    deltas_created = 0
    for bill_id, _ in multi_version.items():
        # Fetch full version data ordered by version_number
        vr = db.table("bill_versions").select("*").eq("bill_id", bill_id).order("version_number").execute()
        versions = vr.data or []

        for i in range(1, len(versions)):
            from_v = versions[i - 1]
            to_v = versions[i]

            # Check if delta already exists
            existing = db.table("bill_deltas").select("id").eq("from_version_id", from_v["id"]).eq("to_version_id", to_v["id"]).execute()
            if existing.data:
                continue

            delta = compute_delta(from_v, to_v)

            if dry_run:
                log.info("  [DRY] %s: %s", bill_id[:8], delta["change_summary"][:80])
                deltas_created += 1
                continue

            row = {
                "bill_id": bill_id,
                "from_version_id": from_v["id"],
                "to_version_id": to_v["id"],
                **delta,
            }
            try:
                db.table("bill_deltas").insert(row).execute()
                deltas_created += 1
            except Exception as e:
                log.warning("Delta insert failed for %s: %s", bill_id[:8], e)

    log.info("Deltas created: %d", deltas_created)


if __name__ == "__main__":
    main()
