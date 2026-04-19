#!/usr/bin/env python3
"""
agent_data_ingestion.py — Data Ingestion Agent (Agent 1)

Runs existing ingestion scripts as subprocesses:
  - ingest_federal_bills.py
  - ingest_votes.py
  - ingest_hansard.py
  - ingest_aph_profiles.py

INSERT-only — never UPDATEs existing rows (the underlying scripts handle
upsert semantics themselves).

Max 10,000 rows per run — tracked via subprocess output parsing.
If a sub-script fails, the agent continues to the next and reports all
failures via agent_guard.create_alert.

Outputs JSON metrics on last line for orchestrator.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import agent_guard

AGENT_NAME = "data_ingestion"
SCRIPTS_DIR = Path(__file__).parent
MAX_ROWS_PER_RUN = 10_000

# Sub-scripts to run, in order
SUB_SCRIPTS = [
    "ingest_federal_bills.py",
    "ingest_votes.py",
    "ingest_hansard.py",
    "ingest_aph_profiles.py",
]

log = agent_guard.log


def _parse_row_counts(output: str) -> tuple[int, int]:
    """
    Best-effort extraction of rows read/written from subprocess output.

    Looks for common patterns like:
      - "inserted 42 rows"  /  "42 inserted"
      - "fetched 100"  /  "100 rows fetched"
      - "wrote 10 bills"
      - "upserted 5"
      - generic numbers near keywords
    Returns (rows_read, rows_written).
    """
    rows_read = 0
    rows_written = 0

    # Written patterns
    for pattern in [
        r"(?:inserted|wrote|upserted|created|added|saved)\s+(\d+)",
        r"(\d+)\s+(?:inserted|wrote|upserted|created|added|saved|new)",
    ]:
        for match in re.finditer(pattern, output, re.IGNORECASE):
            rows_written += int(match.group(1))

    # Read / fetched patterns
    for pattern in [
        r"(?:fetched|read|loaded|found|retrieved|got)\s+(\d+)",
        r"(\d+)\s+(?:fetched|read|loaded|found|retrieved)",
    ]:
        for match in re.finditer(pattern, output, re.IGNORECASE):
            rows_read += int(match.group(1))

    return rows_read, rows_written


def run_subscript(script_name: str) -> dict:
    """Run a single ingestion script and return its result dict."""
    script_path = SCRIPTS_DIR / script_name
    result = {
        "script": script_name,
        "success": False,
        "rows_read": 0,
        "rows_written": 0,
        "error": None,
        "output_tail": "",
    }

    if not script_path.exists():
        result["error"] = f"Script not found: {script_path}"
        return result

    try:
        proc = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=600,  # 10 min per script
            cwd=str(SCRIPTS_DIR.parent),
        )

        combined_output = (proc.stdout or "") + "\n" + (proc.stderr or "")
        result["output_tail"] = combined_output[-500:]  # last 500 chars for debugging

        rr, rw = _parse_row_counts(combined_output)
        result["rows_read"] = rr
        result["rows_written"] = rw

        if proc.returncode == 0:
            result["success"] = True
        else:
            result["error"] = f"Exit code {proc.returncode}"

    except subprocess.TimeoutExpired:
        result["error"] = "Timed out after 600s"
    except Exception as e:
        result["error"] = str(e)

    return result


def main():
    sb = agent_guard.init(AGENT_NAME)
    run_id = agent_guard.log_run_start(sb, AGENT_NAME)

    total_read = 0
    total_written = 0
    failures = 0
    script_results = []

    try:
        for script_name in SUB_SCRIPTS:
            log.info("Running %s ...", script_name)
            result = run_subscript(script_name)
            script_results.append(result)

            total_read += result["rows_read"]
            total_written += result["rows_written"]

            if result["success"]:
                log.info(
                    "%s succeeded (read=%d, written=%d)",
                    script_name, result["rows_read"], result["rows_written"],
                )
            else:
                failures += 1
                log.error("%s failed: %s", script_name, result["error"])
                agent_guard.create_alert(
                    sb, AGENT_NAME,
                    severity="error",
                    alert_type="subscript_failure",
                    subject=f"Ingestion sub-script failed: {script_name}",
                    body=result.get("error", "Unknown error"),
                    context={
                        "script": script_name,
                        "output_tail": result.get("output_tail", ""),
                    },
                )

            # Safety: stop if we've exceeded the row cap
            if total_written >= MAX_ROWS_PER_RUN:
                log.warning(
                    "Row cap reached (%d >= %d). Stopping early.",
                    total_written, MAX_ROWS_PER_RUN,
                )
                break

        status = "succeeded" if failures == 0 else "partial_failure"
        if failures == len(SUB_SCRIPTS):
            status = "failed"

        agent_guard.log_run_end(
            sb, run_id,
            status=status,
            rows_read=total_read,
            rows_written=total_written,
            rows_flagged=failures,
            logs={
                "scripts": [
                    {k: v for k, v in r.items() if k != "output_tail"}
                    for r in script_results
                ],
                "max_rows_per_run": MAX_ROWS_PER_RUN,
            },
        )

        metrics = {
            "rows_read": total_read,
            "rows_written": total_written,
            "rows_flagged": failures,
            "tokens_used": 0,
            "cost_usd": 0.0,
            "scripts_run": len(script_results),
            "scripts_failed": failures,
        }
        print(json.dumps(metrics))
        sys.exit(0 if failures == 0 else 1)

    except Exception as e:
        agent_guard.log_run_end(
            sb, run_id,
            status="failed",
            error_message=str(e),
        )
        log.exception("Data ingestion agent failed")
        print(json.dumps({
            "rows_read": total_read,
            "rows_written": total_written,
            "rows_flagged": failures,
            "tokens_used": 0,
            "cost_usd": 0.0,
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
