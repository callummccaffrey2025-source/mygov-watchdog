#!/usr/bin/env python3
"""
classify_divisions.py — Classify parliamentary divisions into policy issues
using Claude Haiku. Writes to division_issue_tags.

Idempotent: skips already-tagged divisions.
Processes all untagged divisions in sub-batches of 20.

Usage:
    python scripts/classify_divisions.py [--dry-run] [--batch N] [--model MODEL]

Cost estimate: ~1,929 divisions × ~300 input tokens × $0.80/M = ~$0.46 with Haiku.
"""
import argparse
import json
import os
import sys
import time
import logging

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

import anthropic
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-haiku-4-5-20251001"
SUB_BATCH_SIZE = 20  # divisions per API call
MAX_TOKENS = 4000

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    sys.exit(1)
if not ANTHROPIC_KEY:
    print("ERROR: ANTHROPIC_API_KEY must be set")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)


def load_policy_issues() -> dict[str, dict]:
    """Load policy issues from Supabase. Returns {slug: {id, name, stance_question}}."""
    all_issues = []
    offset = 0
    while True:
        resp = sb.table("policy_issues").select("id,slug,name,stance_question").eq("active", True).range(offset, offset + 99).execute()
        rows = resp.data or []
        all_issues.extend(rows)
        if len(rows) < 100:
            break
        offset += 100

    if not all_issues:
        print("ERROR: No policy issues found. Run the match engine migration first.")
        sys.exit(1)

    return {r["slug"]: r for r in all_issues}


def load_tagged_division_ids() -> set[str]:
    """Load all division IDs that already have tags."""
    tagged = set()
    offset = 0
    while True:
        resp = sb.table("division_issue_tags").select("division_id").range(offset, offset + 999).execute()
        rows = resp.data or []
        for r in rows:
            tagged.add(r["division_id"])
        if len(rows) < 1000:
            break
        offset += 1000
    return tagged


def load_all_divisions() -> list[dict]:
    """Load all divisions from Supabase."""
    divisions = []
    offset = 0
    while True:
        resp = (
            sb.table("divisions")
            .select("id,name,date,chamber,bill_title")
            .order("date", desc=True)
            .range(offset, offset + 999)
            .execute()
        )
        rows = resp.data or []
        divisions.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return divisions


def classify_batch(divisions: list[dict], issues: dict[str, dict], model: str) -> list[dict]:
    """Classify a sub-batch of divisions via Claude. Returns parsed results."""
    issue_list = "\n".join(
        f"- {slug}: \"{info['name']}\" — {info['stance_question']}"
        for slug, info in sorted(issues.items(), key=lambda x: x[1].get("sort_order", 0) if "sort_order" in x[1] else 0)
    )

    division_lines = "\n".join(
        f'{i+1}. [{d["id"]}] "{d["name"]}" ({d["date"]}, {d["chamber"]}'
        f'{f", bill: \"{d['bill_title']}\"" if d.get("bill_title") else ""})'
        for i, d in enumerate(divisions)
    )

    prompt = f"""You are classifying Australian parliamentary divisions (votes) into policy issues for a civic intelligence app.

POLICY ISSUES:
{issue_list}

DIVISIONS TO CLASSIFY:
{division_lines}

For each division, determine:
1. Which 0-2 policy issues it relates to (use the slug). Many divisions relate to 0 issues (procedural motions, adjournments, etc.) — return an empty array for those.
2. Whether voting "Aye" supports the "support" side of the stance question (aye_supports: true/false).
3. Your confidence (0.0-1.0) that this classification is correct.
4. A one-line rationale.

Respond with a JSON array. Each element:
{{
  "division_id": "<the id in brackets>",
  "tags": [
    {{ "issue_slug": "<slug>", "aye_supports": true|false, "confidence": 0.0-1.0, "rationale": "<one line>" }}
  ]
}}

If a division is procedural or doesn't clearly map to any issue, return "tags": [].
Be conservative — only tag when you're reasonably confident. Many parliamentary divisions are procedural."""

    resp = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system="You are a factual Australian parliamentary analyst. Respond only with valid JSON, no markdown fences.",
        messages=[{"role": "user", "content": prompt}],
    )

    text = resp.content[0].text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError as e:
        log.error(f"JSON parse error: {e}\nResponse: {text[:500]}")
        return []


def main():
    parser = argparse.ArgumentParser(description="Classify divisions into policy issues")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--batch", type=int, default=0, help="Max divisions to process (0=all)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Claude model (default: {DEFAULT_MODEL})")
    args = parser.parse_args()

    log.info("Loading policy issues...")
    issues = load_policy_issues()
    log.info(f"  {len(issues)} policy issues loaded: {', '.join(issues.keys())}")

    log.info("Loading tagged divisions...")
    tagged_ids = load_tagged_division_ids()
    log.info(f"  {len(tagged_ids)} already tagged")

    log.info("Loading all divisions...")
    all_divs = load_all_divisions()
    log.info(f"  {len(all_divs)} total divisions")

    untagged = [d for d in all_divs if d["id"] not in tagged_ids]
    log.info(f"  {len(untagged)} untagged divisions")

    if not untagged:
        log.info("All divisions already tagged. Nothing to do.")
        return

    if args.batch > 0:
        untagged = untagged[:args.batch]
        log.info(f"  Processing first {len(untagged)} (--batch {args.batch})")

    total_tagged = 0
    total_skipped = 0
    total_errors = 0

    for i in range(0, len(untagged), SUB_BATCH_SIZE):
        sub = untagged[i:i + SUB_BATCH_SIZE]
        log.info(f"\nSub-batch {i // SUB_BATCH_SIZE + 1} ({i+1}-{i+len(sub)} of {len(untagged)})")

        try:
            results = classify_batch(sub, issues, args.model)
        except Exception as e:
            log.error(f"  API error: {e}")
            total_errors += 1
            time.sleep(2)
            continue

        batch_tagged = 0
        for result in results:
            div_id = result.get("division_id")
            tags = result.get("tags", [])

            if not div_id or not isinstance(tags, list):
                continue

            if len(tags) == 0:
                total_skipped += 1
                continue

            for tag in tags:
                slug = tag.get("issue_slug")
                if slug not in issues:
                    log.warning(f"  Unknown issue slug: {slug}")
                    continue

                row = {
                    "division_id": div_id,
                    "issue_id": issues[slug]["id"],
                    "aye_supports": tag.get("aye_supports", True),
                    "confidence": tag.get("confidence", 0.5),
                    "source": "ai",
                    "rationale": tag.get("rationale", ""),
                }

                if args.dry_run:
                    div = next((d for d in sub if d["id"] == div_id), None)
                    log.info(f"  [DRY RUN] {div['name'][:60] if div else div_id} → {slug} "
                             f"(conf={tag.get('confidence', 0):.1f}, aye_supports={tag.get('aye_supports')})")
                else:
                    resp = sb.table("division_issue_tags").upsert(
                        row, on_conflict="division_id,issue_id"
                    ).execute()
                    if hasattr(resp, 'error') and resp.error:
                        log.error(f"  Insert error: {resp.error}")
                    else:
                        batch_tagged += 1

        total_tagged += batch_tagged
        log.info(f"  → {batch_tagged} tags written")

        # Rate limit: 0.5s between sub-batches
        if i + SUB_BATCH_SIZE < len(untagged):
            time.sleep(0.5)

    log.info(f"\n{'='*60}")
    log.info(f"DONE")
    log.info(f"  Tags written:       {total_tagged}")
    log.info(f"  Procedural skipped: {total_skipped}")
    log.info(f"  Errors:             {total_errors}")
    log.info(f"{'='*60}")

    # Print distribution
    if not args.dry_run and total_tagged > 0:
        log.info("\nDistribution by issue:")
        for slug, info in issues.items():
            resp = (
                sb.table("division_issue_tags")
                .select("id", count="exact")
                .eq("issue_id", info["id"])
                .gte("confidence", 0.6)
                .execute()
            )
            count = resp.count or 0
            if count > 0:
                log.info(f"  {info['name']:30s} {count:>5d}")


if __name__ == "__main__":
    main()
