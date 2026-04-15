#!/usr/bin/env python3
"""
seed_party_policies.py — Use Claude to generate plain-English summaries of
each major party's policy position across 8 topic categories.

Idempotent: upserts on (party_id, category). Skips entries that already exist
unless --force is passed.

Usage:
  python seed_party_policies.py
  python seed_party_policies.py --force         # re-generate all
  python seed_party_policies.py --party "Labor" # single party
"""

import argparse
import json
import logging
import os
import sys
import time

import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 512
RATE_LIMIT_SECS = 1.2

CATEGORIES = [
    "housing",
    "healthcare",
    "economy",
    "climate",
    "immigration",
    "defence",
    "education",
    "cost_of_living",
]

CATEGORY_LABELS = {
    "housing": "housing affordability and rental",
    "healthcare": "healthcare and the Medicare system",
    "economy": "economic management, taxes, and the budget",
    "climate": "climate change and energy transition",
    "immigration": "immigration and border policy",
    "defence": "national defence and foreign policy",
    "education": "schools, universities, and vocational training",
    "cost_of_living": "cost of living and consumer prices",
}

# Known parties to process (short_name values from seed_parties.py)
TARGET_PARTIES = [
    "Labor",
    "Liberal",
    "Nationals",
    "Greens",
    "One Nation",
]

POLICY_PROMPT = """\
You are a neutral Australian political analyst. Describe the {party_name}'s
current official policy stance on {category_label} in Australia.

Write 2-3 plain-English sentences that a 16-year-old could understand.
Be factual and neutral. Focus on their stated policies, not political spin.
Do not include any preamble — start your response directly with the party's position.
"""


def call_claude(client: anthropic.Anthropic, party_name: str, category: str) -> str | None:
    prompt = POLICY_PROMPT.format(
        party_name=party_name,
        category_label=CATEGORY_LABELS[category],
    )
    try:
        msg = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as exc:
        log.error("Claude call failed (%s / %s): %s", party_name, category, exc)
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-generate existing policies")
    parser.add_argument("--party", default=None, help="Only process this party (short_name)")
    args = parser.parse_args()

    db_url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        log.error("ANTHROPIC_API_KEY not set.")
        sys.exit(1)

    db = create_client(db_url, key)
    claude = anthropic.Anthropic(api_key=anthropic_key)

    # Fetch parties
    party_filter = TARGET_PARTIES
    if args.party:
        party_filter = [args.party]

    result = db.table("parties").select("id, name, short_name").execute()
    parties = [
        p for p in result.data
        if (p.get("short_name") or p.get("short")) in party_filter
    ]
    if not parties:
        log.error("No matching parties found. Run seed_parties.py first.")
        sys.exit(1)

    # Fetch existing policies (to skip unless --force)
    existing: set = set()
    if not args.force:
        ex_result = db.table("party_policies").select("party_id, category").execute()
        existing = {(r["party_id"], r["category"]) for r in ex_result.data}
        log.info("Skipping %d existing policy entries (use --force to regenerate).", len(existing))

    processed = 0
    errors = 0
    total = len(parties) * len(CATEGORIES)

    for party in parties:
        party_id = party["id"]
        party_name = party["name"]
        short = party.get("short_name") or party.get("short", party_name)
        log.info("── %s ──", short)

        for category in CATEGORIES:
            if (party_id, category) in existing:
                log.debug("  skip %s/%s (exists)", short, category)
                continue

            log.info("  [%d/%d] %s → %s", processed + 1, total, short, category)
            summary = call_claude(claude, party_name, category)
            if not summary:
                errors += 1
                time.sleep(RATE_LIMIT_SECS)
                continue

            db.table("party_policies").upsert(
                {
                    "party_id": party_id,
                    "category": category,
                    "summary_plain": summary,
                },
                on_conflict="party_id,category",
            ).execute()

            processed += 1
            time.sleep(RATE_LIMIT_SECS)

    log.info("Done. %d policies written, %d errors.", processed, errors)


if __name__ == "__main__":
    main()
