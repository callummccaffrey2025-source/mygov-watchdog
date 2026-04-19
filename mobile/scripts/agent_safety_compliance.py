#!/usr/bin/env python3
"""
agent_safety_compliance.py — Safety & Compliance Agent (Agent 6)

Reviews all entries in content_approval_queue where status='pending_review'.
Runs defamation, unsourced-claims, editorial-language, and length checks.
Sets risk_score and risk_flags on each entry.

CANNOT approve or reject — only annotates. A human decides.
No schedule — triggered by orchestrator when pending items exist.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import agent_guard

AGENT_NAME = "safety_compliance"

EDITORIAL_TERMS = [
    "caves", "radical", "slammed", "destroyed", "blasted",
    "failed", "crushed", "gutless", "coward", "traitor",
]

# Patterns that could be defamatory: "[Name] is [defamatory adjective]"
DEFAMATION_PATTERNS = [
    r"\b\w[\w\s]{2,30}\b\s+is\s+(?:corrupt|criminal|a\s+criminal|a\s+liar|liar|fraudulent|a\s+fraud)",
]

log = agent_guard.log


def flatten_content_text(proposed_content: dict) -> str:
    """Recursively extract all string values from proposed_content into one blob."""
    parts = []

    def _walk(obj):
        if isinstance(obj, str):
            parts.append(obj)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item)
        elif isinstance(obj, dict):
            for val in obj.values():
                _walk(val)

    _walk(proposed_content)
    return " ".join(parts)


def check_defamation(text: str) -> list[str]:
    """Flag defamatory patterns like '[name] is corrupt'."""
    flags = []
    for pattern in DEFAMATION_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            flags.append(f"defamation_risk: '{match.strip()}'")
    return flags


def check_unsourced_claims(text: str, proposed_content: dict) -> list[str]:
    """Flag if content references a politician's actions but has no source_url."""
    flags = []
    # Check if content mentions political actors doing something
    action_phrases = [
        r"(?:minister|senator|mp|prime minister|treasurer)\s+\w+\s+(?:said|announced|voted|declared|proposed|introduced)",
        r"\b(?:Labor|Liberal|Greens|Coalition|LNP)\s+(?:said|announced|voted|declared|proposed)",
    ]
    has_action_reference = False
    for pattern in action_phrases:
        if re.search(pattern, text, re.IGNORECASE):
            has_action_reference = True
            break

    if has_action_reference:
        # Check for source_url in proposed_content
        content_str = json.dumps(proposed_content)
        if "source_url" not in content_str and "source" not in content_str:
            flags.append("unsourced_claim: references politician actions without source_url")

    return flags


def check_editorial_language(text: str) -> list[str]:
    """Check for loaded editorial terms."""
    flags = []
    text_lower = text.lower()
    for term in EDITORIAL_TERMS:
        if term in text_lower:
            flags.append(f"editorial_language: contains '{term}'")
    return flags


def check_length(text: str) -> list[str]:
    """Flag unusually short or long content."""
    flags = []
    length = len(text.strip())
    if length < 50:
        flags.append(f"content_too_short: {length} chars (min 50)")
    elif length > 5000:
        flags.append(f"content_too_long: {length} chars (max 5000)")
    return flags


def calculate_risk_score(flags: list[str]) -> int:
    """Calculate risk score 0-100 based on flag severity."""
    score = 0
    for flag in flags:
        if flag.startswith("defamation_risk"):
            score += 40
        elif flag.startswith("unsourced_claim"):
            score += 25
        elif flag.startswith("editorial_language"):
            score += 10
        elif flag.startswith("content_too_short"):
            score += 15
        elif flag.startswith("content_too_long"):
            score += 5
        else:
            score += 5
    return min(score, 100)


def main():
    sb = agent_guard.init(AGENT_NAME)

    # Check for pending items BEFORE logging a run
    pending = (
        sb.table("content_approval_queue")
        .select("id", count="exact")
        .eq("status", "pending_review")
        .execute()
    )
    pending_count = pending.count or (len(pending.data) if pending.data else 0)

    if pending_count == 0:
        log.info("No pending items in content_approval_queue — exiting cleanly")
        print(json.dumps({
            "rows_read": 0, "rows_written": 0, "rows_flagged": 0,
            "tokens_used": 0, "cost_usd": 0.0,
            "status": "no_work",
        }))
        sys.exit(0)

    run_id = agent_guard.log_run_start(sb, AGENT_NAME)
    rows_read = 0
    rows_written = 0
    rows_flagged = 0

    try:
        # Fetch all pending items
        result = (
            sb.table("content_approval_queue")
            .select("*")
            .eq("status", "pending_review")
            .execute()
        )
        items = result.data or []
        rows_read = len(items)
        log.info("Found %d pending items to review", rows_read)

        for item in items:
            item_id = item["id"]
            proposed_content = item.get("proposed_content") or {}
            content_type = item.get("content_type", "unknown")

            log.info("Reviewing item %s (type=%s)", item_id, content_type)

            # Flatten all text in proposed_content
            text = flatten_content_text(proposed_content)

            # Run all checks
            all_flags = []
            all_flags.extend(check_defamation(text))
            all_flags.extend(check_unsourced_claims(text, proposed_content))
            all_flags.extend(check_editorial_language(text))
            all_flags.extend(check_length(text))

            # Merge with any existing risk_flags from the content preparation agent
            existing_flags = proposed_content.get("risk_flags", [])
            if isinstance(existing_flags, list):
                all_flags.extend(existing_flags)

            # Deduplicate
            all_flags = list(dict.fromkeys(all_flags))

            risk_score = calculate_risk_score(all_flags)

            log.info(
                "Item %s: risk_score=%d, flags=%d — %s",
                item_id, risk_score, len(all_flags),
                all_flags[:3] if all_flags else "clean",
            )

            # Update the queue entry with risk assessment
            # CANNOT approve or reject — only annotate
            sb.table("content_approval_queue").update({
                "risk_score": risk_score,
                "risk_flags": all_flags,
                "reviewed_by_agent": AGENT_NAME,
            }).eq("id", item_id).execute()
            rows_written += 1

            if all_flags:
                rows_flagged += 1

            # Create alert for high-risk items
            if risk_score >= 40:
                agent_guard.create_alert(
                    sb, AGENT_NAME,
                    severity="warning" if risk_score < 70 else "critical",
                    alert_type="high_risk_content",
                    subject=f"High-risk content detected (score={risk_score})",
                    body=f"Queue entry {item_id} has risk_score={risk_score}. "
                         f"Flags: {json.dumps(all_flags)}",
                    context={
                        "queue_entry_id": item_id,
                        "content_type": content_type,
                        "risk_score": risk_score,
                        "risk_flags": all_flags,
                    },
                )

        agent_guard.log_run_end(
            sb, run_id,
            status="succeeded",
            rows_read=rows_read,
            rows_written=rows_written,
            rows_flagged=rows_flagged,
            logs={
                "items_reviewed": rows_read,
                "items_flagged": rows_flagged,
            },
        )

        print(json.dumps({
            "rows_read": rows_read,
            "rows_written": rows_written,
            "rows_flagged": rows_flagged,
            "tokens_used": 0,
            "cost_usd": 0.0,
        }))
        sys.exit(0)

    except Exception as e:
        agent_guard.log_run_end(
            sb, run_id,
            status="failed",
            error_message=str(e),
        )
        log.exception("Safety compliance agent failed")
        print(json.dumps({
            "rows_read": rows_read, "rows_written": rows_written,
            "rows_flagged": rows_flagged, "tokens_used": 0, "cost_usd": 0.0,
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
