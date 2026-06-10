#!/usr/bin/env python3
"""
run_brief_evals.py — Run the adversarial eval set against the brief grader.

Uses the SAME grader code and prompt as production (scripts/grade_brief.py +
prompts/brief-grader.md). Each case must match its expected verdict on BOTH
panel models. This is the regression test for:
  - the grader prompt (did an edit make it blind or over-strict?)
  - the grader models (did a model swap change behaviour?)

95% pass means nothing if the failing 5% are the explosive ones — so ANY
mismatch is a hard failure (exit 1).

Usage:
  python scripts/run_brief_evals.py             # full set, both models
  python scripts/run_brief_evals.py --case real-002-procedural-as-passage
  python scripts/run_brief_evals.py --model claude-sonnet-4-6   # one model only
"""
import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).parent.parent
load_dotenv(PROJECT_DIR / ".env")

import anthropic

# Reuse production grader pieces — evals test what actually runs
from grade_brief import GRADER_MODELS, load_grader_system_prompt, run_grader

CASES_FILE = PROJECT_DIR / "evals" / "adversarial" / "brief_cases.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", help="run a single case by id")
    parser.add_argument("--model", help="run a single grader model")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    data = json.loads(CASES_FILE.read_text())
    cases = data["cases"]
    if args.case:
        cases = [c for c in cases if c["id"] == args.case]
        if not cases:
            print(f"No case with id {args.case!r}")
            sys.exit(1)

    models = [args.model] if args.model else GRADER_MODELS
    system_prompt = load_grader_system_prompt()
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    print()
    print("═══════════ BRIEF GRADER — ADVERSARIAL EVALS ═══════════")
    print(f"  Cases: {len(cases)}  |  Models: {', '.join(m.split('-2025')[0] for m in models)}")
    print()

    mismatches = []
    for case in cases:
        expected = case["expected"]
        brief_json = json.dumps(case["brief"], indent=2)
        row = f"  {case['id']:36s} expect {expected:4s} →"
        verdicts = []
        for model in models:
            try:
                result = run_grader(client, model, system_prompt, case["evidence"], brief_json, args.verbose)
                verdict = result.get("verdict", "FAIL")
            except Exception as e:
                verdict = f"ERROR({e})"
            verdicts.append(verdict)
            short = "S" if "sonnet" in model else "H"
            marker = "✓" if verdict == expected else "✗"
            row += f"  {short}:{verdict}{marker}"
            if verdict != expected:
                mismatches.append((case["id"], model, expected, verdict))
        print(row)

    print()
    total_checks = len(cases) * len(models)
    failed = len(mismatches)
    if mismatches:
        print(f"  EVALS: FAIL — {failed}/{total_checks} checks mismatched:")
        for cid, model, exp, got in mismatches:
            print(f"    {cid} [{model.split('-2025')[0]}]: expected {exp}, got {got}")
        print("═" * 56)
        sys.exit(1)
    print(f"  EVALS: PASS — {total_checks}/{total_checks} checks matched expected verdicts")
    print("═" * 56)


if __name__ == "__main__":
    main()
