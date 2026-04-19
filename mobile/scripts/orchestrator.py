#!/usr/bin/env python3
"""
orchestrator.py — Central agent orchestrator for Verity.

Reads agent_config, determines which agent is due, launches it as a subprocess,
logs results to agent_runs, enforces circuit breakers and cost ceilings.

Usage:
    python scripts/orchestrator.py              # run next due agent
    python scripts/orchestrator.py --agent qa_monitoring  # force-run specific agent
    python scripts/orchestrator.py --dry-run     # show what would run without executing
"""
import argparse
import json
import os
import subprocess
import sys
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Ensure scripts/ is on the path for agent_guard import
sys.path.insert(0, str(Path(__file__).parent))
import agent_guard

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [orchestrator] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("orchestrator")

SCRIPTS_DIR = Path(__file__).parent
DAILY_COST_CEILING = 20.0

# Maps agent_name → script filename
AGENT_SCRIPTS = {
    "data_ingestion": "agent_data_ingestion.py",
    "news_clustering": "agent_news_clustering.py",
    "metrics_calculation": "agent_metrics_calculation.py",
    "qa_monitoring": "agent_qa_monitoring.py",
    "content_preparation": "agent_content_preparation.py",
    "safety_compliance": "agent_safety_compliance.py",
}


def parse_cron_is_due(cron_expr: str, last_run_at: str | None) -> bool:
    """
    Simple cron check: determine if enough time has elapsed since last run
    based on the cron expression interval.

    Supports: */N * * * * (every N minutes), 0 */N * * * (every N hours),
    0 N * * D (weekly on day D at hour N), 0 N * * * (daily at hour N).
    """
    if not cron_expr:
        return False

    now = datetime.now(tz=timezone.utc)

    if last_run_at is None:
        return True  # never run before → due now

    last = datetime.fromisoformat(last_run_at.replace("Z", "+00:00"))
    elapsed = now - last
    parts = cron_expr.strip().split()

    if len(parts) != 5:
        log.warning("Unparseable cron: %s", cron_expr)
        return False

    minute, hour, dom, mon, dow = parts

    # */N minutes
    if minute.startswith("*/"):
        interval_min = int(minute[2:])
        return elapsed >= timedelta(minutes=interval_min)

    # 0 */N * * * — every N hours
    if hour.startswith("*/"):
        interval_hr = int(hour[2:])
        return elapsed >= timedelta(hours=interval_hr)

    # 0 N * * D — weekly
    if dow != "*":
        return elapsed >= timedelta(days=7)

    # 0 N * * * — daily
    if minute.isdigit() and hour.isdigit():
        return elapsed >= timedelta(hours=24)

    # Fallback: run if > 1 hour since last
    return elapsed >= timedelta(hours=1)


def get_last_run(sb, agent_name: str) -> dict | None:
    """Get the most recent agent_runs entry for an agent."""
    result = (
        sb.table("agent_runs")
        .select("*")
        .eq("agent_name", agent_name)
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def count_consecutive_failures(sb, agent_name: str) -> int:
    """Count consecutive failed runs for an agent (most recent first)."""
    result = (
        sb.table("agent_runs")
        .select("status")
        .eq("agent_name", agent_name)
        .order("started_at", desc=True)
        .limit(10)
        .execute()
    )
    count = 0
    for run in (result.data or []):
        if run["status"] == "failed":
            count += 1
        else:
            break
    return count


def pause_agent(sb, agent_name: str, reason: str):
    """Disable an agent and create a critical alert."""
    sb.table("agent_config").update({
        "enabled": False,
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }).eq("agent_name", agent_name).execute()

    agent_guard.create_alert(
        sb, agent_name,
        severity="critical",
        alert_type="circuit_breaker",
        subject=f"Agent '{agent_name}' auto-paused",
        body=reason,
    )
    log.warning("Paused agent '%s': %s", agent_name, reason)


def run_agent(agent_name: str) -> tuple[int, str]:
    """
    Launch an agent script as a subprocess. Returns (exit_code, output).
    """
    script = AGENT_SCRIPTS.get(agent_name)
    if not script:
        return 1, f"No script mapped for agent '{agent_name}'"

    script_path = SCRIPTS_DIR / script
    if not script_path.exists():
        return 1, f"Script not found: {script_path}"

    log.info("Launching %s ...", script_path)
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=600,  # 10-minute timeout per agent
            cwd=str(SCRIPTS_DIR.parent),
        )
        output = result.stdout + result.stderr
        return result.returncode, output
    except subprocess.TimeoutExpired:
        return 1, f"Agent '{agent_name}' timed out after 600s"
    except Exception as e:
        return 1, f"Failed to launch agent: {e}"


def main():
    parser = argparse.ArgumentParser(description="Verity Agent Orchestrator")
    parser.add_argument("--agent", help="Force-run a specific agent")
    parser.add_argument("--dry-run", action="store_true", help="Show what would run")
    args = parser.parse_args()

    sb = agent_guard.init("orchestrator")

    # Check daily cost ceiling
    if not agent_guard.check_cost_ceiling(sb, DAILY_COST_CEILING):
        agent_guard.create_alert(
            sb, "orchestrator",
            severity="critical",
            alert_type="cost_ceiling",
            subject=f"Daily cost ceiling ${DAILY_COST_CEILING} reached — all agents paused",
        )
        log.critical("Daily cost ceiling reached. Stopping.")
        sys.exit(1)

    # Load agent configs
    configs = sb.table("agent_config").select("*").execute()
    agents = {c["agent_name"]: c for c in (configs.data or [])}

    if args.agent:
        # Force-run a specific agent
        if args.agent not in agents:
            log.error("Unknown agent: %s", args.agent)
            sys.exit(1)
        to_run = [args.agent]
    else:
        # Determine which agents are due
        to_run = []
        for name, config in agents.items():
            if not config["enabled"]:
                continue

            last_run = get_last_run(sb, name)
            last_at = last_run["started_at"] if last_run else None

            if parse_cron_is_due(config.get("schedule_cron", ""), last_at):
                to_run.append(name)

    if not to_run:
        log.info("No agents due to run.")
        return

    # Run agents serially (never two simultaneously)
    for agent_name in to_run:
        config = agents.get(agent_name, {})
        log.info("=== Agent: %s ===", agent_name)

        if args.dry_run:
            log.info("[DRY RUN] Would run agent '%s'", agent_name)
            continue

        # Circuit breaker check
        failures = count_consecutive_failures(sb, agent_name)
        threshold = config.get("failure_threshold", 3)
        if failures >= threshold:
            pause_agent(sb, agent_name, f"{failures} consecutive failures (threshold: {threshold})")
            continue

        # Start run
        run_id = agent_guard.log_run_start(sb, agent_name)

        exit_code, output = run_agent(agent_name)

        # Parse output for metrics (agents print JSON summary on last line)
        metrics = {}
        for line in reversed(output.strip().split("\n")):
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    metrics = json.loads(line)
                    break
                except json.JSONDecodeError:
                    pass

        if exit_code == 0:
            agent_guard.log_run_end(
                sb, run_id,
                status="succeeded",
                rows_read=metrics.get("rows_read", 0),
                rows_written=metrics.get("rows_written", 0),
                rows_flagged=metrics.get("rows_flagged", 0),
                tokens_used=metrics.get("tokens_used", 0),
                cost_usd=metrics.get("cost_usd", 0.0),
                logs={"output": output[-2000:]},  # last 2KB
            )
        else:
            error_msg = output[-500:] if output else f"Exit code {exit_code}"
            agent_guard.log_run_end(
                sb, run_id,
                status="failed",
                error_message=error_msg,
                logs={"output": output[-2000:]},
            )
            log.error("Agent '%s' failed: %s", agent_name, error_msg[:200])

    log.info("Orchestrator complete.")


if __name__ == "__main__":
    main()
