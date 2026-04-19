#!/usr/bin/env python3
"""
agent_guard.py — Production safety guard and shared utilities for Verity agents.

Every agent script imports this module. It:
1. Loads .env.agents (not .env) by default
2. Aborts if the URL points to production and ENV != 'production'
3. Provides a configured Supabase client and logging helpers
"""
import os
import sys
import logging
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

PRODUCTION_REF = "zmmglikiryuftqmoprqm"
AGENTS_ENV = Path(__file__).parent.parent / ".env.agents"
PROD_ENV = Path(__file__).parent.parent / ".env"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("agent_guard")


def init(agent_name: str, *, use_production: bool = False) -> Client:
    """
    Initialise the Supabase client for an agent run.

    - Loads .env.agents by default (branch DB)
    - If use_production=True AND ENV=production, loads .env (prod DB)
    - Aborts with error if production ref detected without explicit opt-in
    """
    if use_production:
        if os.environ.get("ENV") != "production":
            log.critical(
                "use_production=True but ENV != 'production'. "
                "Set ENV=production to confirm. Aborting."
            )
            sys.exit(1)
        load_dotenv(PROD_ENV, override=True)
        log.warning(">>> PRODUCTION MODE — agent %s targeting live database <<<", agent_name)
    else:
        if not AGENTS_ENV.exists():
            log.critical(".env.agents not found at %s — create it first.", AGENTS_ENV)
            sys.exit(1)
        load_dotenv(AGENTS_ENV, override=True)

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")

    # Safety check: block production access unless explicitly opted in
    if PRODUCTION_REF in url and not use_production:
        log.critical(
            "SUPABASE_URL contains production ref '%s' but use_production=False. "
            "Check .env.agents — it must point to the dev branch. Aborting.",
            PRODUCTION_REF,
        )
        sys.exit(1)

    if not url or not key or key == "REPLACE_ME_FROM_DASHBOARD":
        log.critical("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.agents")
        sys.exit(1)

    client = create_client(url, key)
    log.info("Agent '%s' connected to %s", agent_name, url)
    return client


def log_run_start(sb: Client, agent_name: str) -> str:
    """Insert a new agent_runs row with status='running'. Returns the run ID."""
    result = sb.table("agent_runs").insert({
        "agent_name": agent_name,
        "status": "running",
    }).execute()
    run_id = result.data[0]["id"]
    log.info("Run %s started for agent '%s'", run_id, agent_name)
    return run_id


def log_run_end(
    sb: Client,
    run_id: str,
    *,
    status: str = "succeeded",
    rows_read: int = 0,
    rows_written: int = 0,
    rows_flagged: int = 0,
    tokens_used: int = 0,
    cost_usd: float = 0.0,
    error_message: str | None = None,
    logs: dict | None = None,
):
    """Update the agent_runs row with final stats."""
    sb.table("agent_runs").update({
        "completed_at": datetime.now(tz=timezone.utc).isoformat(),
        "status": status,
        "rows_read": rows_read,
        "rows_written": rows_written,
        "rows_flagged": rows_flagged,
        "tokens_used": tokens_used,
        "cost_usd": cost_usd,
        "error_message": error_message,
        "logs": logs,
    }).eq("id", run_id).execute()
    log.info("Run %s completed: %s (read=%d, written=%d, flagged=%d)",
             run_id, status, rows_read, rows_written, rows_flagged)


def create_alert(
    sb: Client,
    agent_name: str,
    *,
    severity: str = "warning",
    alert_type: str,
    subject: str,
    body: str | None = None,
    context: dict | None = None,
):
    """Insert a row into agent_alerts."""
    sb.table("agent_alerts").insert({
        "agent_name": agent_name,
        "severity": severity,
        "alert_type": alert_type,
        "subject": subject,
        "body": body,
        "context": context,
    }).execute()
    log.info("Alert [%s] %s: %s", severity.upper(), agent_name, subject)


def queue_content(
    sb: Client,
    agent_name: str,
    *,
    content_type: str,
    proposed_content: dict,
) -> str:
    """Insert into content_approval_queue. Returns the queue entry ID."""
    result = sb.table("content_approval_queue").insert({
        "agent_name": agent_name,
        "content_type": content_type,
        "proposed_content": proposed_content,
        "status": "pending_review",
    }).execute()
    entry_id = result.data[0]["id"]
    log.info("Queued %s content from %s (id=%s)", content_type, agent_name, entry_id)
    return entry_id


def check_cost_ceiling(sb: Client, daily_limit: float = 20.0) -> bool:
    """Return True if today's total cost is under the daily limit."""
    today = datetime.now(tz=timezone.utc).date().isoformat()
    runs = (
        sb.table("agent_runs")
        .select("cost_usd")
        .gte("started_at", today)
        .execute()
    )
    total = sum(r.get("cost_usd", 0) or 0 for r in (runs.data or []))
    if total >= daily_limit:
        log.warning("Daily cost ceiling reached: $%.2f >= $%.2f", total, daily_limit)
        return False
    log.info("Daily cost so far: $%.2f / $%.2f", total, daily_limit)
    return True
