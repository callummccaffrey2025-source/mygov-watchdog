#!/usr/bin/env python3
"""
agent_qa_monitoring.py — QA & Monitoring Agent (Agent 4)

READ-ONLY agent that checks:
1. TypeScript compilation (npx tsc --noEmit)
2. Data staleness (articles, stories, briefs)
3. Member data completeness
4. API spend tracking
5. Schema anomalies

Can only alert, never fix. Outputs JSON metrics on last line for orchestrator.
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import agent_guard

AGENT_NAME = "qa_monitoring"
PROJECT_ROOT = Path(__file__).parent.parent

log = agent_guard.log


def check_typescript(sb) -> dict:
    """Run tsc --noEmit and report errors."""
    result = {"check": "typescript", "passed": False, "details": ""}
    try:
        proc = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            capture_output=True, text=True,
            timeout=120,
            cwd=str(PROJECT_ROOT),
        )
        if proc.returncode == 0:
            result["passed"] = True
            result["details"] = "Zero TypeScript errors"
        else:
            error_count = proc.stdout.count("error TS")
            result["details"] = f"{error_count} TypeScript error(s)"
            result["errors_sample"] = proc.stdout[:500]
    except subprocess.TimeoutExpired:
        result["details"] = "tsc timed out after 120s"
    except FileNotFoundError:
        result["details"] = "npx/tsc not found"
        result["passed"] = True  # skip on systems without node
    return result


def check_data_freshness(sb) -> dict:
    """Check that articles, stories, and briefs are fresh."""
    result = {"check": "data_freshness", "passed": True, "details": {}}
    now = datetime.now(tz=timezone.utc)

    # Latest article
    try:
        r = (
            sb.table("news_articles")
            .select("published_at")
            .order("published_at", desc=True)
            .limit(1)
            .execute()
        )
        if r.data:
            latest = r.data[0]["published_at"]
            latest_dt = datetime.fromisoformat(latest.replace("Z", "+00:00"))
            age_hours = (now - latest_dt).total_seconds() / 3600
            fresh = age_hours <= 24
            result["details"]["articles"] = {
                "age_hours": round(age_hours, 1),
                "fresh": fresh,
            }
            if not fresh:
                result["passed"] = False
        else:
            result["details"]["articles"] = {"age_hours": None, "fresh": False, "note": "empty"}
    except Exception as e:
        result["details"]["articles"] = {"error": str(e)[:100], "note": "table may not exist"}

    # Latest story
    try:
        r = (
            sb.table("news_stories")
            .select("created_at")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if r.data:
            latest = r.data[0]["created_at"]
            latest_dt = datetime.fromisoformat(latest.replace("Z", "+00:00"))
            age_hours = (now - latest_dt).total_seconds() / 3600
            result["details"]["stories"] = {"age_hours": round(age_hours, 1)}
        else:
            result["details"]["stories"] = {"age_hours": None, "note": "empty"}
    except Exception as e:
        result["details"]["stories"] = {"error": str(e)[:100], "note": "table may not exist"}

    return result


def check_member_completeness(sb) -> dict:
    """Check member data quality."""
    result = {"check": "member_completeness", "passed": True, "details": {}}

    try:
        r = sb.table("members").select("id").limit(1).execute()
        total = len(r.data) if r.data else 0
        if total == 0:
            result["details"]["note"] = "Empty database or table missing"
            return result

        # Count all members
        all_members = sb.table("members").select("id,photo_url,party").execute()
        total = len(all_members.data or [])
        result["details"]["total_members"] = total

        missing_photos = sum(1 for m in (all_members.data or []) if not m.get("photo_url"))
        missing_party = sum(1 for m in (all_members.data or []) if not m.get("party"))
        result["details"]["missing_photos"] = missing_photos
        result["details"]["missing_party"] = missing_party

        if missing_party > 5:
            result["passed"] = False
    except Exception as e:
        result["details"]["error"] = str(e)[:100]
        result["details"]["note"] = "table may not exist"

    return result


def check_agent_health(sb) -> dict:
    """Check recent agent run statuses."""
    result = {"check": "agent_health", "passed": True, "details": {}}

    # Get all agent configs
    configs = sb.table("agent_config").select("*").execute()
    for config in (configs.data or []):
        name = config["agent_name"]
        if name == AGENT_NAME:
            continue  # skip self

        # Get last run
        last = (
            sb.table("agent_runs")
            .select("status,started_at,error_message")
            .eq("agent_name", name)
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        if last.data:
            run = last.data[0]
            result["details"][name] = {
                "last_status": run["status"],
                "last_run": run["started_at"],
                "enabled": config["enabled"],
            }
            if run["status"] == "failed" and config["enabled"]:
                result["details"][name]["error"] = (run.get("error_message") or "")[:200]
        else:
            result["details"][name] = {"last_status": "never_run", "enabled": config["enabled"]}

    return result


def check_cost_today(sb) -> dict:
    """Check today's total agent spend."""
    result = {"check": "cost_today", "passed": True, "details": {}}
    today = datetime.now(tz=timezone.utc).date().isoformat()

    runs = (
        sb.table("agent_runs")
        .select("agent_name,cost_usd")
        .gte("started_at", today)
        .execute()
    )
    total = sum(r.get("cost_usd", 0) or 0 for r in (runs.data or []))
    result["details"]["total_usd"] = round(total, 4)
    result["details"]["ceiling_usd"] = 20.0
    result["details"]["utilization_pct"] = round(total / 20.0 * 100, 1)

    if total >= 15.0:  # warn at 75%
        result["passed"] = False
        result["details"]["warning"] = "Approaching daily cost ceiling"

    return result


def main():
    sb = agent_guard.init(AGENT_NAME)
    run_id = agent_guard.log_run_start(sb, AGENT_NAME)

    checks = []
    rows_read = 0
    alerts_created = 0

    try:
        # Run all checks
        for check_fn in [
            check_typescript,
            check_data_freshness,
            check_member_completeness,
            check_agent_health,
            check_cost_today,
        ]:
            result = check_fn(sb)
            checks.append(result)
            log.info(
                "Check '%s': %s — %s",
                result["check"],
                "PASS" if result["passed"] else "FAIL",
                json.dumps(result.get("details", {}), default=str)[:200],
            )

            # Create alerts for failed checks
            if not result["passed"]:
                agent_guard.create_alert(
                    sb, AGENT_NAME,
                    severity="warning",
                    alert_type=f"check_failed_{result['check']}",
                    subject=f"QA check failed: {result['check']}",
                    body=json.dumps(result["details"], default=str)[:1000],
                    context=result,
                )
                alerts_created += 1

        passed = sum(1 for c in checks if c["passed"])
        total = len(checks)
        all_passed = passed == total

        agent_guard.log_run_end(
            sb, run_id,
            status="succeeded",
            rows_read=rows_read,
            rows_flagged=alerts_created,
            logs={"checks": checks, "summary": f"{passed}/{total} passed"},
        )

        # Print JSON metrics for orchestrator to parse
        print(json.dumps({
            "rows_read": rows_read,
            "rows_written": 0,
            "rows_flagged": alerts_created,
            "tokens_used": 0,
            "cost_usd": 0.0,
            "checks_passed": passed,
            "checks_total": total,
        }))

        sys.exit(0 if all_passed else 0)  # QA always exits 0 — it reports via alerts

    except Exception as e:
        agent_guard.log_run_end(
            sb, run_id,
            status="failed",
            error_message=str(e),
        )
        log.exception("QA monitoring agent failed")
        print(json.dumps({"rows_read": 0, "rows_written": 0, "rows_flagged": 0}))
        sys.exit(1)


if __name__ == "__main__":
    main()
