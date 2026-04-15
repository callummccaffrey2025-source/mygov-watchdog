#!/usr/bin/env python3
"""
pipeline.py — Verity news ingestion orchestrator.

Runs the full pipeline in sequence:
  1. Ingest news (ingest_news.py) — fetches articles, clusters into stories,
     computes blindspot/factuality/AI summary metrics.
  2. Backfill images (backfill_news_images.py) — fetches og:image for articles
     and propagates to stories.

Logs each pipeline run to the `pipeline_runs` table.

Usage:
    python scripts/pipeline.py              # full run
    python scripts/pipeline.py --no-images  # skip image backfill
"""
import os
import sys
import subprocess
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))


def run_step(name: str, script: str, extra_args: list[str] | None = None) -> tuple[bool, str]:
    """Run a Python script as a subprocess. Returns (success, output)."""
    cmd = [sys.executable, os.path.join(SCRIPTS_DIR, script)] + (extra_args or [])
    log.info("▶  %s", name)
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=1800,  # 30 minute hard limit per step
        )
        output = result.stdout + result.stderr
        if result.returncode != 0:
            log.error("✗  %s failed (exit %d)\n%s", name, result.returncode, output[-2000:])
            return False, output
        log.info("✓  %s complete", name)
        return True, output
    except subprocess.TimeoutExpired:
        msg = f"{name} timed out after 1800s"
        log.error(msg)
        return False, msg
    except Exception as e:
        log.error("✗  %s error: %s", name, e)
        return False, str(e)


def log_pipeline_run(sb, pipeline: str, status: str, started_at: datetime,
                     details: str | None = None, error: str | None = None) -> None:
    try:
        sb.table("pipeline_runs").insert({
            "pipeline": pipeline,
            "status": status,
            "started_at": started_at.isoformat(),
            "finished_at": datetime.now(tz=timezone.utc).isoformat(),
            "details": details,
            "error": error,
        }).execute()
    except Exception as e:
        log.warning("Could not log pipeline run: %s", e)


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY in .env")

    sb = create_client(url, key)
    skip_images = "--no-images" in sys.argv
    started_at = datetime.now(tz=timezone.utc)

    log.info("═══════════════ Verity pipeline starting ═══════════════")

    all_output: list[str] = []
    errors: list[str] = []

    # ── Step 1: Ingest news ───────────────────────────────────────────────────
    ok, out = run_step("Ingest news + compute metrics", "ingest_news.py")
    all_output.append(out)
    if not ok:
        errors.append("ingest_news.py failed")

    # ── Step 2: Backfill images ───────────────────────────────────────────────
    if not skip_images:
        ok2, out2 = run_step("Backfill article images", "backfill_news_images.py", ["--limit", "200"])
        all_output.append(out2)
        if not ok2:
            errors.append("backfill_news_images.py failed")
    else:
        log.info("⏭  Skipping image backfill (--no-images)")

    # ── Log result ────────────────────────────────────────────────────────────
    status = "success" if not errors else "error"
    combined = "\n---\n".join(all_output)[-4000:]  # trim to last 4k chars
    log_pipeline_run(
        sb,
        pipeline="verity-news",
        status=status,
        started_at=started_at,
        details=combined if not errors else None,
        error="; ".join(errors) if errors else None,
    )

    log.info("═══════════════ Pipeline %s ═══════════════", status.upper())
    if errors:
        log.error("Errors: %s", ", ".join(errors))
        sys.exit(1)


if __name__ == "__main__":
    main()
