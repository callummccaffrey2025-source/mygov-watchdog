#!/usr/bin/env python3
"""
summarise_bills.py — Generate plain-English summaries and pro/con arguments
for bills that don't have one yet, using Claude.

Usage:
  python summarise_bills.py              # process all unsummarised bills
  python summarise_bills.py --dry-run    # print bills without processing
  python summarise_bills.py --limit 10   # process at most 10 bills

Idempotent: skips bills that already have summary_plain.
Rate-limited to avoid Claude API throttling.
"""

import argparse
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
MAX_TOKENS = 1024
RATE_LIMIT_SECS = 1.0  # seconds between API calls

SUMMARY_PROMPT = """\
You are a civic education assistant helping young Australians understand parliament.

Here is an Australian federal bill:

TITLE: {title}

OFFICIAL SUMMARY:
{summary_raw}

(If the official summary is not provided or is the same as the title, use your knowledge of Australian federal legislation to describe what this bill likely proposes.)

Please provide:
1. A plain-English summary (2-3 sentences) that a 16-year-old could understand.
   Start with "This bill..."
2. Two key arguments FOR this bill (one sentence each).
3. Two key arguments AGAINST this bill (one sentence each).

Respond in this exact JSON format (no markdown, no preamble):
{{
  "summary_plain": "...",
  "arguments_for": ["...", "..."],
  "arguments_against": ["...", "..."]
}}
"""


def fetch_unsummarised(db, limit: int | None) -> list[dict]:
    query = (
        db.table("bills")
        .select("id, title, summary_raw, summary_full, summary_plain")
        .is_("summary_plain", "null")
        .order("last_updated", desc=True)
    )
    if limit:
        query = query.limit(limit)
    return query.execute().data


def call_claude(client: anthropic.Anthropic, title: str, summary_raw: str) -> dict | None:
    prompt = SUMMARY_PROMPT.format(title=title, summary_raw=summary_raw[:3000])
    try:
        msg = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        import json
        return json.loads(text)
    except Exception as exc:
        log.error("Claude call failed for %r: %s", title[:60], exc)
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="List bills without processing")
    parser.add_argument("--limit", type=int, default=None, help="Max bills to process")
    args = parser.parse_args()

    db_url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(db_url, key)

    bills = fetch_unsummarised(db, args.limit)
    log.info("Found %d bills without summary_plain.", len(bills))

    if args.dry_run:
        for b in bills:
            print(f"  [{b['id'][:8]}] {b['title'][:80]}")
        return

    if not bills:
        log.info("Nothing to do.")
        return

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        log.error("ANTHROPIC_API_KEY not set.")
        sys.exit(1)

    claude = anthropic.Anthropic(api_key=anthropic_key)

    processed = 0
    errors = 0

    for bill in bills:
        log.info("[%d/%d] %s", processed + 1, len(bills), bill["title"][:70])

        source_text = bill.get("summary_raw") or bill.get("summary_full") or bill["title"]
        result = call_claude(claude, bill["title"], source_text)
        if not result:
            errors += 1
            time.sleep(RATE_LIMIT_SECS)
            continue

        # Update bill with summary
        db.table("bills").update(
            {"summary_plain": result["summary_plain"]}
        ).eq("id", bill["id"]).execute()

        # Insert bill_arguments (delete existing first for idempotency)
        db.table("bill_arguments").delete().eq("bill_id", bill["id"]).execute()
        argument_rows = []
        for text in result.get("arguments_for", []):
            argument_rows.append({"bill_id": bill["id"], "side": "for", "argument_text": text})
        for text in result.get("arguments_against", []):
            argument_rows.append({"bill_id": bill["id"], "side": "against", "argument_text": text})
        if argument_rows:
            db.table("bill_arguments").insert(argument_rows).execute()

        processed += 1
        log.info("  ✓ summary + %d arguments saved", len(argument_rows))
        time.sleep(RATE_LIMIT_SECS)

    log.info("Done. %d processed, %d errors.", processed, errors)


if __name__ == "__main__":
    main()
