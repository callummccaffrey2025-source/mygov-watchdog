#!/usr/bin/env python3
"""
llm_costs.py — Per-call LLM cost tracking for the Verity pipeline.

Every LLM call in the pipeline logs (caller, purpose, model, tokens, cost)
to the llm_calls table. One query answers "where do the credits go".

As a library:
    from llm_costs import log_llm_call
    msg = client.messages.create(...)
    log_llm_call(sb, caller="generate_ai_summaries.py", purpose="news-summary",
                 model=MODEL, usage=msg.usage)

As a report:
    python scripts/llm_costs.py --report           # last 7 days by caller
    python scripts/llm_costs.py --report --days 30
"""
import argparse
import logging
import os
import sys
from pathlib import Path

log = logging.getLogger("llm_costs")

# USD per million tokens (input, output). Update when Anthropic pricing changes.
PRICES_PER_MTOK = {
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-opus-4-6": (15.00, 75.00),
}
DEFAULT_PRICE = (3.00, 15.00)  # unknown models priced as sonnet — conservative


def compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    inp, outp = PRICES_PER_MTOK.get(model, DEFAULT_PRICE)
    return round((input_tokens * inp + output_tokens * outp) / 1_000_000, 6)


def log_llm_call(sb, caller: str, model: str, usage, purpose: str | None = None) -> None:
    """Fire-and-forget cost log. `usage` is an anthropic Usage object or dict.
    Never raises — cost tracking must not break the pipeline."""
    try:
        input_tokens = getattr(usage, "input_tokens", None) or (usage or {}).get("input_tokens", 0)
        output_tokens = getattr(usage, "output_tokens", None) or (usage or {}).get("output_tokens", 0)
        sb.table("llm_calls").insert({
            "caller": caller,
            "purpose": purpose,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": compute_cost(model, input_tokens, output_tokens),
        }).execute()
    except Exception as e:
        log.debug("llm_calls log failed (non-fatal): %s", e)


def report(days: int) -> None:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
    from supabase import create_client
    from datetime import datetime, timedelta, timezone

    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"],
    )
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = (
        sb.table("llm_calls")
        .select("caller, purpose, model, input_tokens, output_tokens, cost_usd")
        .gte("created_at", since)
        .execute()
    ).data or []

    print()
    print(f"═══════════ LLM COST REPORT — last {days} days ═══════════")
    if not rows:
        print("  No calls logged yet.")
        return

    by_caller: dict[str, dict] = {}
    for r in rows:
        key = f"{r['caller']} ({r.get('purpose') or '-'}) [{r['model'].split('-2025')[0]}]"
        agg = by_caller.setdefault(key, {"calls": 0, "in": 0, "out": 0, "cost": 0.0, "model": r["model"]})
        agg["calls"] += 1
        agg["in"] += r["input_tokens"]
        agg["out"] += r["output_tokens"]
        agg["cost"] += float(r["cost_usd"])

    total = 0.0
    for key, agg in sorted(by_caller.items(), key=lambda kv: -kv[1]["cost"]):
        total += agg["cost"]
        print(f"  ${agg['cost']:8.4f}  {agg['calls']:4d} calls  {agg['in']:>8,} in / {agg['out']:>7,} out  {agg['model'].split('-2025')[0]:18s}  {key}")
    print(f"  {'─' * 60}")
    print(f"  ${total:8.4f}  TOTAL")
    print("═" * 56)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true")
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args()
    if args.report:
        report(args.days)
    else:
        parser.print_help()
