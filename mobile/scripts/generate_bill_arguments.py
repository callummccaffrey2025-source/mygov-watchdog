#!/usr/bin/env python3
"""
generate_bill_arguments.py — Use Claude Haiku 4.5 to generate balanced
For/Against arguments for the top N most-active bills, then insert them
into the bill_arguments table.

Reads bills with the most recent activity, asks Claude for 2 FOR + 2 AGAINST
arguments per bill, and inserts each as a separate row in bill_arguments.
"""
import os
import sys
import time
import logging
import json
import re

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

import anthropic
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 500
TARGET_BILLS = 20  # top N bills to populate

SYSTEM_PROMPT = (
    "You are a neutral policy analyst for an Australian civic intelligence app. "
    "You write balanced, factual arguments. You do not editorialise."
)

PROMPT_TEMPLATE = """List 2 arguments FOR and 2 arguments AGAINST this Australian bill.
Keep each argument to one factual sentence. Be balanced.

Title: {title}
Summary: {summary}

Respond ONLY with valid JSON in this exact shape, no preamble:
{{
  "for": ["arg1", "arg2"],
  "against": ["arg1", "arg2"]
}}"""


def parse_response(text: str) -> dict | None:
    """Extract JSON from Claude's response, tolerating ```json fences."""
    if not text:
        return None
    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = cleaned.replace("```", "").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract the first JSON object via regex
        match = re.search(r"\{[^{}]*\"for\"[^{}]*\"against\"[^{}]*\}", cleaned, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

    fors = data.get("for", [])
    againsts = data.get("against", [])
    if not isinstance(fors, list) or not isinstance(againsts, list):
        return None
    if not fors or not againsts:
        return None
    return {"for": fors[:2], "against": againsts[:2]}


def main() -> None:
    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_KEY")
    anth_key = os.environ.get("ANTHROPIC_API_KEY")
    if not sb_url or not sb_key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY")
    if not anth_key:
        raise SystemExit("Missing ANTHROPIC_API_KEY")

    sb = create_client(sb_url, sb_key)
    client = anthropic.Anthropic(api_key=anth_key)

    log.info("Querying top %d bills for argument generation…", TARGET_BILLS)
    bills_resp = (
        sb.table("bills")
        .select("id, title, short_title, summary_plain, summary_full, current_status, last_updated")
        .not_.is_("summary_plain", "null")
        .order("last_updated", desc=True)
        .limit(TARGET_BILLS * 2)  # over-fetch to skip bills already covered
        .execute()
    )
    bills = bills_resp.data or []
    if not bills:
        log.warning("No bills with summaries found")
        return

    inserted = 0
    skipped = 0
    failed = 0
    total_input_tokens = 0
    total_output_tokens = 0

    for i, bill in enumerate(bills):
        if inserted >= TARGET_BILLS:
            break

        bill_id = bill["id"]

        # Skip if this bill already has arguments
        existing = sb.table("bill_arguments").select("id").eq("bill_id", bill_id).limit(1).execute()
        if existing.data:
            skipped += 1
            continue

        title = bill.get("short_title") or bill.get("title") or ""
        summary = bill.get("summary_plain") or bill.get("summary_full") or ""
        if len(summary) > 1500:
            summary = summary[:1500] + "…"

        prompt = PROMPT_TEMPLATE.format(title=title, summary=summary)

        try:
            msg = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            text = msg.content[0].text if msg.content else ""
            try:
                total_input_tokens += msg.usage.input_tokens
                total_output_tokens += msg.usage.output_tokens
            except AttributeError:
                pass
        except Exception as e:
            failed += 1
            log.warning("Anthropic error on bill %s: %s", bill_id, e)
            continue

        parsed = parse_response(text)
        if not parsed:
            failed += 1
            log.warning("Could not parse response for bill %s: %s", bill_id, text[:200])
            continue

        rows = []
        for arg_text in parsed["for"]:
            rows.append({"bill_id": bill_id, "side": "for", "argument_text": arg_text})
        for arg_text in parsed["against"]:
            rows.append({"bill_id": bill_id, "side": "against", "argument_text": arg_text})

        try:
            sb.table("bill_arguments").insert(rows).execute()
            inserted += 1
            log.info("[%d/%d] %s — %d args", inserted, TARGET_BILLS, title[:50], len(rows))
        except Exception as e:
            failed += 1
            log.warning("Insert failed for bill %s: %s", bill_id, e)

        time.sleep(0.5)

    cost_input = total_input_tokens * 1.0 / 1_000_000
    cost_output = total_output_tokens * 5.0 / 1_000_000
    total_cost = cost_input + cost_output

    print()
    print("═══════════════ SUMMARY ═══════════════")
    print(f"  Bills covered:  {inserted}")
    print(f"  Skipped (existing): {skipped}")
    print(f"  Failed:         {failed}")
    print(f"  Input tokens:   {total_input_tokens:,}")
    print(f"  Output tokens:  {total_output_tokens:,}")
    print(f"  Estimated cost: ${total_cost:.4f}")
    print("════════════════════════════════════════")


if __name__ == "__main__":
    main()
