#!/usr/bin/env python3
"""
ops_alert.py — Lightweight alerting for Verity pipeline failures.

Checks pipeline_status.json and data freshness, then sends alerts via:
  1. macOS notification (osascript) — always
  2. Slack webhook — if SLACK_WEBHOOK_URL is set in .env
  3. Expo push notification to admin — if ADMIN_PUSH_TOKEN is set in .env

Usage:
  python scripts/ops_alert.py              # Check and alert if issues
  python scripts/ops_alert.py --force      # Always send status (even if healthy)
  python scripts/ops_alert.py --slack-test # Send a test message to Slack

Called automatically by orchestrate.py after pipeline runs.
"""

import json
import logging
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SLACK_WEBHOOK = os.environ.get("SLACK_WEBHOOK_URL")
ADMIN_PUSH_TOKEN = os.environ.get("ADMIN_PUSH_TOKEN")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
STATUS_FILE = Path(__file__).parent / "pipeline_status.json"


def check_pipeline_status() -> list[str]:
    """Check pipeline_status.json for failures."""
    issues = []
    if not STATUS_FILE.exists():
        issues.append("pipeline_status.json not found — pipeline may not have run")
        return issues

    try:
        data = json.loads(STATUS_FILE.read_text())
        overall = data.get("overall_status", "unknown")
        if overall != "success":
            failed = [
                s["script"] for s in data.get("stages", []) if s.get("status") != "success"
            ]
            issues.append(f"Pipeline {overall}: {', '.join(failed) if failed else 'unknown stage'}")

        # Check age of last run
        ts = data.get("timestamp")
        if ts:
            run_time = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            age_hours = (datetime.now(tz=timezone.utc) - run_time).total_seconds() / 3600
            if age_hours > 8:
                issues.append(f"Pipeline last ran {age_hours:.0f}h ago (threshold: 8h)")
    except (json.JSONDecodeError, KeyError) as e:
        issues.append(f"Corrupt pipeline_status.json: {e}")

    return issues


def check_data_freshness() -> list[str]:
    """Check Supabase for data freshness issues."""
    issues = []
    if not SUPABASE_URL or not SUPABASE_KEY:
        return ["SUPABASE credentials not set"]

    try:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Latest article age
        r = sb.table("news_articles").select("published_at").order(
            "published_at", desc=True
        ).limit(1).execute()
        if r.data:
            latest = datetime.fromisoformat(r.data[0]["published_at"].replace("Z", "+00:00"))
            age = (datetime.now(tz=timezone.utc) - latest).total_seconds() / 3600
            if age > 12:
                issues.append(f"News stale: latest article is {age:.0f}h old")
        else:
            issues.append("No articles in database")

        # Today's brief
        today = (datetime.now(tz=timezone.utc) + timedelta(hours=10)).date().isoformat()
        r2 = sb.table("daily_briefs").select("id").eq("date", today).limit(1).execute()
        if not r2.data:
            issues.append(f"No daily brief for {today}")

        # Member count
        r3 = sb.table("members").select("id", count="exact").eq("is_active", True).execute()
        count = r3.count if hasattr(r3, 'count') else len(r3.data or [])
        if count < 220:
            issues.append(f"Member count low: {count} (expected 225)")

    except Exception as e:
        issues.append(f"Supabase check failed: {e}")

    return issues


def send_mac_notification(title: str, body: str):
    """Send a macOS notification via osascript."""
    try:
        subprocess.run(
            ["osascript", "-e", f'display notification "{body}" with title "{title}"'],
            timeout=5,
            capture_output=True,
        )
    except Exception:
        pass


def send_slack(message: str):
    """Send a message to Slack via webhook."""
    if not SLACK_WEBHOOK:
        log.info("No SLACK_WEBHOOK_URL set — skipping Slack alert")
        return
    try:
        requests.post(SLACK_WEBHOOK, json={"text": message}, timeout=10)
        log.info("Slack alert sent")
    except Exception as e:
        log.warning("Slack alert failed: %s", e)


def send_push(title: str, body: str):
    """Send a push notification to admin via Expo Push API."""
    if not ADMIN_PUSH_TOKEN:
        return
    try:
        requests.post(
            "https://exp.host/--/api/v2/push/send",
            json={"to": ADMIN_PUSH_TOKEN, "title": title, "body": body, "sound": "default"},
            timeout=10,
        )
        log.info("Admin push sent")
    except Exception as e:
        log.warning("Admin push failed: %s", e)


def main():
    force = "--force" in sys.argv
    slack_test = "--slack-test" in sys.argv

    if slack_test:
        send_slack("🧪 Verity ops alert test — this is working!")
        return

    pipeline_issues = check_pipeline_status()
    data_issues = check_data_freshness()
    all_issues = pipeline_issues + data_issues

    if all_issues:
        title = "⚠️ Verity: Action Needed"
        body = "\n".join(f"• {i}" for i in all_issues)
        message = f"{title}\n{body}"

        log.warning("Issues found:\n%s", body)
        send_mac_notification(title, all_issues[0])  # macOS only shows first line well
        send_slack(message)
        send_push(title, all_issues[0])
        sys.exit(1)

    elif force:
        title = "✅ Verity: All Systems Green"
        body = "Pipeline healthy, data fresh, 225 members active."
        log.info(body)
        send_mac_notification(title, body)
        send_slack(f"{title}\n{body}")
        send_push(title, body)

    else:
        log.info("All checks passed — no alerts needed")


if __name__ == "__main__":
    main()
