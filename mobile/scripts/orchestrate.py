#!/usr/bin/env python3
"""
orchestrate.py — Master pipeline orchestrator for Verity.

Runs data ingestion scripts in dependency order with retry, timeout,
logging, and status reporting. Replaces refresh_all.sh.

Usage:
  python scripts/orchestrate.py              # Full pipeline
  python scripts/orchestrate.py --stage news # Just news ingestion
  python scripts/orchestrate.py --stage votes
  python scripts/orchestrate.py --stage summaries
  python scripts/orchestrate.py --stage health
  python scripts/orchestrate.py --dry-run    # Preview what would run
  python scripts/orchestrate.py --verbose    # Show script output in real-time

Stages (dependency order):
  1. news + votes (parallel-safe, no dependency)
  2. summaries (depends on news)
  3. health check (runs last)

Each script gets:
  - 10 minute timeout
  - 1 automatic retry on failure (30s delay)
  - stdout/stderr captured
  - Result logged to pipeline_status.json + Supabase pipeline_runs
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

SCRIPTS_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPTS_DIR.parent
load_dotenv(PROJECT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("orchestrate")

STATUS_FILE = SCRIPTS_DIR / "pipeline_status.json"
TIMEOUT_SECONDS = 600  # 10 minutes
RETRY_DELAY = 30

# Pipeline stages — order matters
STAGES = {
    "news": {"script": "ingest_news.py", "args": ["--fresh"], "stage": 1},
    "votes": {"script": "ingest_votes.py", "args": [], "stage": 1},
    "summaries": {"script": "generate_ai_summaries.py", "args": [], "stage": 2},
    "health": {"script": "data_monitor.py", "args": [], "stage": 3},
}

FULL_ORDER = ["news", "votes", "summaries", "health"]


def run_script(name: str, script: str, args: list[str], verbose: bool) -> dict:
    """Run a Python script with timeout and retry."""
    cmd = [sys.executable, str(SCRIPTS_DIR / script)] + args
    result = {
        "script": name,
        "command": " ".join(cmd),
        "status": "pending",
        "duration_s": 0,
        "attempts": 0,
        "error": None,
        "output_tail": "",
    }

    for attempt in range(1, 3):  # max 2 attempts
        result["attempts"] = attempt
        start = time.time()
        log.info("Running %s (attempt %d)...", name, attempt)

        try:
            proc = subprocess.run(
                cmd,
                cwd=str(PROJECT_DIR),
                capture_output=not verbose,
                text=True,
                timeout=TIMEOUT_SECONDS,
            )
            elapsed = time.time() - start
            result["duration_s"] = round(elapsed, 1)

            if not verbose and proc.stdout:
                result["output_tail"] = proc.stdout[-500:]
            if not verbose and proc.stderr:
                result["output_tail"] += "\n" + proc.stderr[-300:]

            if proc.returncode == 0:
                result["status"] = "success"
                log.info("✓ %s completed in %.1fs", name, elapsed)
                return result
            else:
                result["error"] = f"Exit code {proc.returncode}"
                log.warning(
                    "✗ %s failed (exit %d) in %.1fs",
                    name, proc.returncode, elapsed,
                )

        except subprocess.TimeoutExpired:
            elapsed = time.time() - start
            result["duration_s"] = round(elapsed, 1)
            result["error"] = f"Timeout after {TIMEOUT_SECONDS}s"
            log.warning("✗ %s timed out after %ds", name, TIMEOUT_SECONDS)

        except Exception as e:
            elapsed = time.time() - start
            result["duration_s"] = round(elapsed, 1)
            result["error"] = str(e)
            log.warning("✗ %s error: %s", name, e)

        # Retry?
        if attempt < 2:
            log.info("  Retrying %s in %ds...", name, RETRY_DELAY)
            time.sleep(RETRY_DELAY)

    result["status"] = "failed"
    return result


def write_status(results: list[dict], start_time: datetime):
    """Write pipeline_status.json."""
    overall = "success" if all(r["status"] == "success" for r in results) else \
              "failed" if all(r["status"] == "failed" for r in results) else "partial"

    status = {
        "timestamp": start_time.isoformat(),
        "overall_status": overall,
        "duration_s": round(sum(r["duration_s"] for r in results), 1),
        "stages": results,
    }

    STATUS_FILE.write_text(json.dumps(status, indent=2))
    log.info("Status written to %s", STATUS_FILE)
    return status


def log_to_supabase(status: dict):
    """Log pipeline run to Supabase pipeline_runs table."""
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            return
        sb = create_client(url, key)
        sb.table("pipeline_runs").insert({
            "pipeline": "orchestrator",
            "status": status["overall_status"],
            "details": json.dumps(status),
            "started_at": status["timestamp"],
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        log.info("Logged to pipeline_runs")
    except Exception as e:
        log.warning("Failed to log to Supabase: %s", e)


def main():
    parser = argparse.ArgumentParser(description="Verity pipeline orchestrator")
    parser.add_argument("--stage", choices=list(STAGES.keys()), help="Run a single stage")
    parser.add_argument("--dry-run", action="store_true", help="Preview without executing")
    parser.add_argument("--verbose", action="store_true", help="Show script output in real-time")
    args = parser.parse_args()

    # Determine which stages to run
    if args.stage:
        to_run = [args.stage]
    else:
        to_run = FULL_ORDER

    start_time = datetime.now(timezone.utc)
    log.info("=== Verity Pipeline — %s ===", start_time.strftime("%Y-%m-%d %H:%M UTC"))
    log.info("Stages: %s", ", ".join(to_run))

    if args.dry_run:
        for name in to_run:
            cfg = STAGES[name]
            cmd = f"python scripts/{cfg['script']} {' '.join(cfg['args'])}".strip()
            log.info("  [DRY RUN] Stage %d: %s → %s", cfg["stage"], name, cmd)
        return

    results = []
    current_stage = 0

    for name in to_run:
        cfg = STAGES[name]

        # Wait for stage transition
        if cfg["stage"] > current_stage:
            current_stage = cfg["stage"]
            if results and any(r["status"] == "failed" for r in results):
                log.warning("Previous stage had failures — continuing anyway")

        result = run_script(name, cfg["script"], cfg["args"], args.verbose)
        results.append(result)

    # Write status and log
    status = write_status(results, start_time)
    log_to_supabase(status)

    # Summary
    passed = sum(1 for r in results if r["status"] == "success")
    failed = sum(1 for r in results if r["status"] == "failed")
    log.info("=== Pipeline complete: %d/%d passed, %d failed ===", passed, len(results), failed)

    if failed > 0:
        for r in results:
            if r["status"] == "failed":
                log.error("  FAILED: %s — %s", r["script"], r["error"])
        sys.exit(1)


if __name__ == "__main__":
    main()
