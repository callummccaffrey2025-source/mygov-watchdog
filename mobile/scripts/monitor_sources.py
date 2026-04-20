#!/usr/bin/env python3
"""
monitor_sources.py — External data source availability monitor for Verity.

Checks every critical upstream API and alerts when something breaks.
Prevents silent failures like the APH OpenData 404 incident.

Crontab (every 15 minutes):
# */15 * * * * python ~/verity/mobile/scripts/monitor_sources.py
"""
import os
import sys
import time
import subprocess
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

import requests
from supabase import create_client

NOW = datetime.now(tz=timezone.utc)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
ANON_KEY = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_KEY)
TVFY_KEY = os.environ.get("THEYVOTEFORYOU_API_KEY", "")
OA_KEY = os.environ.get("OPENAUSTRALIA_API_KEY", "")
NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "")

TIMEOUT = 10  # seconds

ENDPOINTS = [
    {
        "name": "Supabase API",
        "url": f"{SUPABASE_URL}/rest/v1/members?select=id&limit=1",
        "headers": {
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
        },
        "accept_codes": {200},
    },
    {
        "name": "TheyVoteForYou API",
        "url": f"https://theyvoteforyou.org.au/api/v1/people.json?key={TVFY_KEY}",
        "headers": {},
        "accept_codes": {200},
    },
    {
        "name": "OpenAustralia API",
        "url": f"https://www.openaustralia.org.au/api/getDivisions?key={OA_KEY}&output=json&date=2026-01-01",
        "headers": {},
        "accept_codes": {200},
    },
    {
        "name": "NewsAPI",
        "url": f"https://newsapi.org/v2/everything?q=australia+politics&pageSize=1&apiKey={NEWSAPI_KEY}",
        "headers": {},
        "accept_codes": {200},
    },
    {
        "name": "APH OpenData",
        "url": "https://data.aph.gov.au/",
        "headers": {},
        "accept_codes": {200},
    },
    {
        "name": "Supabase Edge Functions",
        "url": f"{SUPABASE_URL}/functions/v1/verify-claim",
        "headers": {},
        "accept_codes": {200, 401, 400},  # anything except 500/503 is acceptable
    },
    {
        "name": "Google News RSS",
        "url": "https://news.google.com/rss/search?q=australian+politics&hl=en-AU",
        "headers": {},
        "accept_codes": {200},
    },
]


# ---------------------------------------------------------------------------
# Check logic
# ---------------------------------------------------------------------------

def check_endpoint(ep: dict) -> dict:
    """Hit a single endpoint and return result dict."""
    result = {
        "name": ep["name"],
        "url": ep["url"].split("?")[0],  # strip query params from display
        "status_code": None,
        "response_time_ms": None,
        "passed": False,
        "error": None,
    }

    try:
        start = time.monotonic()
        resp = requests.get(ep["url"], headers=ep.get("headers", {}), timeout=TIMEOUT)
        elapsed_ms = round((time.monotonic() - start) * 1000)

        result["status_code"] = resp.status_code
        result["response_time_ms"] = elapsed_ms

        if resp.status_code in ep["accept_codes"]:
            result["passed"] = True
        else:
            result["error"] = f"HTTP {resp.status_code} (expected {ep['accept_codes']})"

    except requests.exceptions.Timeout:
        result["error"] = f"Timeout after {TIMEOUT}s"
    except requests.exceptions.ConnectionError as e:
        result["error"] = f"Connection error: {e}"
    except Exception as e:
        result["error"] = f"Unexpected error: {e}"

    return result


# ---------------------------------------------------------------------------
# Alert helpers
# ---------------------------------------------------------------------------

def alert_supabase(sb, failures: list[dict]) -> None:
    """Write critical alerts to agent_alerts table."""
    for f in failures:
        try:
            sb.table("agent_alerts").insert({
                "severity": "critical",
                "alert_type": "source_down",
                "subject": f"{f['name']} is down",
                "details": f.get("error", "unknown"),
                "created_at": NOW.isoformat(),
            }).execute()
        except Exception as e:
            print(f"  [warn] Could not write alert to Supabase: {e}")


def alert_macos(failures: list[dict]) -> None:
    """Send a macOS notification for failed sources."""
    if sys.platform != "darwin":
        return
    names = ", ".join(f["name"] for f in failures)
    try:
        subprocess.run(
            [
                "osascript", "-e",
                f'display notification "{names}" with title "Verity Source Monitor" subtitle "{len(failures)} source(s) down"'
            ],
            timeout=5,
            capture_output=True,
        )
    except Exception:
        pass  # best-effort


def log_run(sb, status: str, details: str) -> None:
    """Log run to pipeline_runs."""
    try:
        sb.table("pipeline_runs").insert({
            "pipeline": "source-monitor",
            "status": status,
            "started_at": NOW.isoformat(),
            "finished_at": datetime.now(tz=timezone.utc).isoformat(),
            "details": details if status == "success" else None,
            "error": details if status == "error" else None,
        }).execute()
    except Exception as e:
        print(f"  [warn] Could not log run: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    results = [check_endpoint(ep) for ep in ENDPOINTS]

    # Print summary table
    print()
    print("═══════════════ VERITY SOURCE MONITOR ═══════════════")
    print(f"  Run time (UTC): {NOW.isoformat()}")
    print()
    print(f"  {'Source':<28s} {'Status':>6s} {'Time':>8s}  Result")
    print(f"  {'─' * 28} {'─' * 6} {'─' * 8}  {'─' * 30}")

    failures = []
    for r in results:
        code_str = str(r["status_code"]) if r["status_code"] else "---"
        time_str = f"{r['response_time_ms']}ms" if r["response_time_ms"] is not None else "---"
        marker = "PASS" if r["passed"] else "FAIL"
        detail = "" if r["passed"] else f"  {r['error']}"
        print(f"  {r['name']:<28s} {code_str:>6s} {time_str:>8s}  {marker}{detail}")
        if not r["passed"]:
            failures.append(r)

    print()
    passed_count = len(results) - len(failures)
    if failures:
        print(f"  FAILED: {len(failures)} of {len(results)} sources down")
        for f in failures:
            print(f"    - {f['name']}: {f['error']}")
    else:
        print(f"  ALL OK ({passed_count}/{len(results)} sources reachable)")
    print("═════════════════════════════════════════════════════")

    # Build summary string for logging
    summary = "; ".join(
        f"{r['name']}={'OK' if r['passed'] else 'FAIL'}"
        for r in results
    )

    if failures:
        alert_supabase(sb, failures)
        alert_macos(failures)
        log_run(sb, "error", summary)
        sys.exit(1)
    else:
        log_run(sb, "success", summary)


if __name__ == "__main__":
    main()
