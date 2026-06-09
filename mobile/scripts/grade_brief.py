#!/usr/bin/env python3
"""
grade_brief.py — Council gate for the daily brief.

The model that wrote the brief (Haiku, inside generate-daily-brief) never
solely vouches for it. A two-model panel (Sonnet primary + Haiku second
opinion) independently grades today's brief against the SAME deterministic
evidence the writer was given: news_stories (48h) and divisions (14d).
Both must PASS.

Exit codes:
  0 — brief passed (or no brief exists yet — that's the watchdog's job)
  1 — brief FAILED grading. Alerts fired. daily_cycle marks the run degraded.

Usage:
  python scripts/grade_brief.py             # grade today's national brief
  python scripts/grade_brief.py --date 2026-06-10
  python scripts/grade_brief.py --verbose   # print full grader responses
"""
import argparse
import json
import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

SCRIPTS_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPTS_DIR.parent
load_dotenv(PROJECT_DIR / ".env")

import anthropic
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger("grade_brief")

GRADER_MODELS = [
    "claude-sonnet-4-6",            # primary — different model than the writer
    "claude-haiku-4-5-20251001",    # second opinion
]
MAX_TOKENS = 800
GRADER_PROMPT_FILE = PROJECT_DIR / "prompts" / "brief-grader.md"


def load_grader_system_prompt() -> str:
    """Extract the system prompt section from prompts/brief-grader.md."""
    text = GRADER_PROMPT_FILE.read_text()
    # Everything after "# System prompt"
    marker = "# System prompt"
    idx = text.find(marker)
    if idx == -1:
        log.error("No '# System prompt' section in %s", GRADER_PROMPT_FILE)
        sys.exit(1)
    return text[idx + len(marker):].strip()


def fetch_brief(sb, date_aest: str) -> dict | None:
    r = (
        sb.table("daily_briefs")
        .select("id, date, electorate, ai_text")
        .eq("date", date_aest)
        .eq("electorate", "__national__")
        .maybe_single()
        .execute()
    )
    return r.data if r and r.data else None


def fetch_evidence(sb) -> tuple[str, str]:
    """Re-fetch the same evidence the writer was given (stories 48h, divisions 14d)."""
    now = datetime.now(timezone.utc)
    since_48h = (now - timedelta(hours=48)).isoformat()
    since_14d = (now - timedelta(days=14)).date().isoformat()

    stories = (
        sb.table("news_stories")
        .select("headline, article_count, category")
        .gte("first_seen", since_48h)
        .order("article_count", desc=True)
        .limit(8)
        .execute()
    ).data or []
    if len(stories) < 3:
        stories = (
            sb.table("news_stories")
            .select("headline, article_count, category")
            .order("first_seen", desc=True)
            .limit(8)
            .execute()
        ).data or []

    divisions = (
        sb.table("divisions")
        .select("name, date, aye_votes, no_votes, bill_title")
        .gte("date", since_14d)
        .order("date", desc=True)
        .limit(6)
        .execute()
    ).data or []

    stories_text = "\n".join(
        f"- \"{s['headline']}\" [{s.get('category')}] — {s.get('article_count')} sources"
        for s in stories
    ) or "No recent stories."

    divisions_text = "\n".join(
        f"- {d['name']} ({d['date']}): "
        f"{'passed' if (d.get('aye_votes') or 0) > (d.get('no_votes') or 0) else 'defeated'} "
        f"({d.get('aye_votes')}–{d.get('no_votes')})"
        for d in divisions
    ) or "No recent parliamentary votes."

    return stories_text, divisions_text


def run_grader(client, model: str, system_prompt: str, evidence: str, brief_json: str, verbose: bool) -> dict:
    """Run one grader model. Returns parsed verdict dict."""
    msg = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": f"EVIDENCE:\n{evidence}\n\nBRIEF:\n{brief_json}\n\nGrade it now.",
        }],
    )
    raw = msg.content[0].text.strip() if msg.content else ""
    if verbose:
        log.info("[%s] raw response:\n%s", model, raw)

    # Extract JSON
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        return {"verdict": "FAIL", "issues": [f"grader returned no JSON: {raw[:200]}"], "checked_claims": 0}
    try:
        return json.loads(raw[start:end + 1])
    except json.JSONDecodeError as e:
        return {"verdict": "FAIL", "issues": [f"grader JSON parse error: {e}"], "checked_claims": 0}


def log_result(sb, status: str, details: str) -> None:
    try:
        now = datetime.now(timezone.utc).isoformat()
        sb.table("pipeline_runs").insert({
            "pipeline": "brief-grade",
            "status": status,
            "started_at": now,
            "finished_at": now,
            "details": details if status == "success" else None,
            "error": details if status != "success" else None,
        }).execute()
    except Exception as e:
        log.warning("Could not log grade result: %s", e)


def escalate(reason: str) -> None:
    """Fire all alert channels via ops_alert + macOS notification."""
    try:
        subprocess.run(
            ["osascript", "-e",
             f'display notification "{reason[:100]}" with title "🔴 Verity: Brief FAILED grading"'],
            timeout=5, capture_output=True,
        )
    except Exception:
        pass
    try:
        subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "ops_alert.py"), "--force"],
            timeout=60, capture_output=True,
        )
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Council gate for the daily brief")
    parser.add_argument("--date", help="AEST date to grade (default: today)")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    date_aest = args.date or (datetime.now(timezone.utc) + timedelta(hours=10)).date().isoformat()

    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"],
    )
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    brief = fetch_brief(sb, date_aest)
    if not brief or not brief.get("ai_text"):
        log.info("No brief with ai_text for %s — nothing to grade (watchdog handles missing briefs)", date_aest)
        sys.exit(0)

    brief_json = json.dumps(brief["ai_text"], indent=2)
    stories_text, divisions_text = fetch_evidence(sb)
    evidence = f"News stories given to the writer:\n{stories_text}\n\nVote records given to the writer:\n{divisions_text}"
    system_prompt = load_grader_system_prompt()

    print()
    print("═══════════════ BRIEF COUNCIL GATE ═══════════════")
    print(f"  Date: {date_aest}  |  Brief id: {brief['id']}")
    print(f"  Writer: haiku (inside generate-daily-brief)")
    print(f"  Panel:  {', '.join(GRADER_MODELS)}")
    print()

    verdicts = []
    all_issues = []
    for model in GRADER_MODELS:
        try:
            result = run_grader(client, model, system_prompt, evidence, brief_json, args.verbose)
        except Exception as e:
            result = {"verdict": "FAIL", "issues": [f"grader call failed: {e}"], "checked_claims": 0}
        verdict = result.get("verdict", "FAIL")
        issues = result.get("issues", [])
        checked = result.get("checked_claims", "?")
        marker = "✓" if verdict == "PASS" else "✗"
        print(f"  {marker}  {model:32s}  {verdict}  ({checked} claims checked)")
        for issue in issues:
            print(f"       └─ {issue}")
        verdicts.append(verdict)
        all_issues.extend(f"[{model}] {i}" for i in issues)

    print()
    if all(v == "PASS" for v in verdicts):
        print("  GATE: PASS — brief is consistent with the deterministic record")
        print("═══════════════════════════════════════════════════")
        log_result(sb, "success", f"{date_aest}: panel PASS ({len(GRADER_MODELS)} graders)")
        sys.exit(0)
    else:
        print("  GATE: FAIL — brief contradicts evidence or invents facts")
        print("═══════════════════════════════════════════════════")
        detail = f"{date_aest}: " + "; ".join(all_issues[:10])
        log_result(sb, "error", detail)
        escalate(all_issues[0] if all_issues else "Brief failed council gate")
        sys.exit(1)


if __name__ == "__main__":
    main()
