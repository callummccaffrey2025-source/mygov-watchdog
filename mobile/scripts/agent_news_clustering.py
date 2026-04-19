#!/usr/bin/env python3
"""
agent_news_clustering.py — News Clustering Agent (Agent 2)

Runs the existing news ingestion pipeline as a subprocess:
  1. ingest_news.py --fresh  (fetches articles, clusters into stories)
  2. generate_ai_summaries.py  (if it exists — adds AI summaries to stories)

The underlying ingest_news.py handles story clustering with cosine similarity.
Stories are only merged when similarity >= 0.85 — this agent does NOT override
that threshold.

Creates alerts if zero articles are ingested (pipeline may be broken).
Outputs JSON metrics on last line for orchestrator.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import agent_guard

AGENT_NAME = "news_clustering"
SCRIPTS_DIR = Path(__file__).parent

log = agent_guard.log


def _parse_article_count(output: str) -> int:
    """Extract article count from ingest_news.py output."""
    # Look for patterns like "275 articles", "inserted 42", "42 new articles"
    for pattern in [
        r"(\d+)\s+(?:new\s+)?articles?",
        r"(?:inserted|added|fetched|ingested)\s+(\d+)",
        r"(\d+)\s+(?:inserted|added|fetched|ingested)",
    ]:
        matches = re.findall(pattern, output, re.IGNORECASE)
        if matches:
            return max(int(m) for m in matches)
    return 0


def _parse_story_count(output: str) -> int:
    """Extract story count from ingest_news.py output."""
    for pattern in [
        r"(\d+)\s+(?:new\s+)?stories?",
        r"stories?[:\s]+(\d+)",
    ]:
        matches = re.findall(pattern, output, re.IGNORECASE)
        if matches:
            return max(int(m) for m in matches)
    return 0


def _parse_summary_count(output: str) -> int:
    """Extract summary count from generate_ai_summaries.py output."""
    for pattern in [
        r"(\d+)\s+summar",
        r"summar\w+\s+(\d+)",
        r"generated\s+(\d+)",
    ]:
        matches = re.findall(pattern, output, re.IGNORECASE)
        if matches:
            return max(int(m) for m in matches)
    return 0


def run_news_ingestion() -> dict:
    """Run ingest_news.py --fresh."""
    script_path = SCRIPTS_DIR / "ingest_news.py"
    result = {
        "step": "ingest_news",
        "success": False,
        "articles": 0,
        "stories": 0,
        "error": None,
        "output_tail": "",
    }

    if not script_path.exists():
        result["error"] = f"Script not found: {script_path}"
        return result

    try:
        proc = subprocess.run(
            [sys.executable, str(script_path), "--fresh"],
            capture_output=True,
            text=True,
            timeout=600,
            cwd=str(SCRIPTS_DIR.parent),
        )

        combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
        result["output_tail"] = combined[-500:]
        result["articles"] = _parse_article_count(combined)
        result["stories"] = _parse_story_count(combined)

        if proc.returncode == 0:
            result["success"] = True
        else:
            result["error"] = f"Exit code {proc.returncode}"

    except subprocess.TimeoutExpired:
        result["error"] = "Timed out after 600s"
    except Exception as e:
        result["error"] = str(e)

    return result


def run_ai_summaries() -> dict:
    """Run generate_ai_summaries.py if it exists."""
    script_path = SCRIPTS_DIR / "generate_ai_summaries.py"
    result = {
        "step": "generate_ai_summaries",
        "success": False,
        "summaries_generated": 0,
        "error": None,
        "output_tail": "",
    }

    if not script_path.exists():
        result["error"] = "Script not found (skipped)"
        result["success"] = True  # Not a failure — optional step
        return result

    try:
        proc = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=str(SCRIPTS_DIR.parent),
        )

        combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
        result["output_tail"] = combined[-500:]
        result["summaries_generated"] = _parse_summary_count(combined)

        if proc.returncode == 0:
            result["success"] = True
        else:
            result["error"] = f"Exit code {proc.returncode}"

    except subprocess.TimeoutExpired:
        result["error"] = "Timed out after 300s"
    except Exception as e:
        result["error"] = str(e)

    return result


def main():
    sb = agent_guard.init(AGENT_NAME)
    run_id = agent_guard.log_run_start(sb, AGENT_NAME)

    total_read = 0
    total_written = 0
    tokens_used = 0
    cost_usd = 0.0

    try:
        # Step 1: News ingestion
        log.info("Running ingest_news.py --fresh ...")
        news_result = run_news_ingestion()

        if news_result["success"]:
            log.info(
                "News ingestion succeeded: %d articles, %d stories",
                news_result["articles"], news_result["stories"],
            )
            total_read += news_result["articles"]
            total_written += news_result["stories"]
        else:
            log.error("News ingestion failed: %s", news_result["error"])
            agent_guard.create_alert(
                sb, AGENT_NAME,
                severity="error",
                alert_type="ingestion_failure",
                subject="News ingestion script failed",
                body=news_result.get("error", "Unknown error"),
                context={"output_tail": news_result.get("output_tail", "")},
            )

        # Alert if zero articles ingested (even on success — pipeline may be stale)
        if news_result["success"] and news_result["articles"] == 0:
            agent_guard.create_alert(
                sb, AGENT_NAME,
                severity="warning",
                alert_type="zero_articles",
                subject="Zero articles ingested — pipeline may be broken",
                body="ingest_news.py --fresh completed successfully but no articles were found.",
            )

        # Step 2: AI summaries (only if news ingestion succeeded)
        summaries_result = {"step": "generate_ai_summaries", "success": True, "summaries_generated": 0}
        if news_result["success"]:
            log.info("Running generate_ai_summaries.py ...")
            summaries_result = run_ai_summaries()

            if summaries_result["success"]:
                log.info(
                    "AI summaries: %d generated", summaries_result["summaries_generated"],
                )
                total_written += summaries_result["summaries_generated"]
            else:
                log.error("AI summaries failed: %s", summaries_result["error"])
                agent_guard.create_alert(
                    sb, AGENT_NAME,
                    severity="warning",
                    alert_type="summary_failure",
                    subject="AI summary generation failed",
                    body=summaries_result.get("error", "Unknown error"),
                    context={"output_tail": summaries_result.get("output_tail", "")},
                )

        # Determine overall status
        if news_result["success"]:
            status = "succeeded"
        else:
            status = "failed"

        agent_guard.log_run_end(
            sb, run_id,
            status=status,
            rows_read=total_read,
            rows_written=total_written,
            tokens_used=tokens_used,
            cost_usd=cost_usd,
            logs={
                "news_ingestion": {k: v for k, v in news_result.items() if k != "output_tail"},
                "ai_summaries": {k: v for k, v in summaries_result.items() if k != "output_tail"},
                "cosine_similarity_threshold": 0.85,
            },
        )

        metrics = {
            "rows_read": total_read,
            "rows_written": total_written,
            "rows_flagged": 0,
            "tokens_used": tokens_used,
            "cost_usd": cost_usd,
            "articles_ingested": news_result["articles"],
            "stories_created": news_result["stories"],
            "summaries_generated": summaries_result.get("summaries_generated", 0),
        }
        print(json.dumps(metrics))
        sys.exit(0 if news_result["success"] else 1)

    except Exception as e:
        agent_guard.log_run_end(
            sb, run_id,
            status="failed",
            error_message=str(e),
        )
        log.exception("News clustering agent failed")
        print(json.dumps({
            "rows_read": total_read,
            "rows_written": total_written,
            "rows_flagged": 0,
            "tokens_used": 0,
            "cost_usd": 0.0,
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
