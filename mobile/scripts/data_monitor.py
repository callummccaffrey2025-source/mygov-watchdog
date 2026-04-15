#!/usr/bin/env python3
"""
data_monitor.py — Daily health checks for the Verity data stack.

Verifies article freshness, story activity, brief presence, bias coverage,
and member completeness. Logs results to health_check_runs and exits non-zero
on failure so a scheduler can alert.
"""
import os
import sys
import logging
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

NOW = datetime.now(tz=timezone.utc)
ONE_DAY_AGO = NOW - timedelta(hours=24)
TODAY_AEST = (NOW + timedelta(hours=10)).date().isoformat()


def check_articles_fresh(sb) -> tuple[bool, str]:
    """Pass if the most recent article was published within the last 24h."""
    r = (
        sb.table("news_articles")
        .select("published_at")
        .order("published_at", desc=True)
        .limit(1)
        .execute()
    )
    if not r.data:
        return False, "no articles in DB"
    latest = r.data[0]["published_at"]
    latest_dt = datetime.fromisoformat(latest.replace("Z", "+00:00"))
    age_hours = (NOW - latest_dt).total_seconds() / 3600
    if age_hours <= 24:
        return True, f"latest article {age_hours:.1f}h old"
    return False, f"latest article {age_hours:.1f}h old (> 24h threshold)"


def check_stories_active(sb) -> tuple[bool, str]:
    """Pass if at least 5 stories were created in the last 24h."""
    r = (
        sb.table("news_stories")
        .select("id", count="exact")
        .gte("first_seen", ONE_DAY_AGO.isoformat())
        .execute()
    )
    count = r.count or 0
    if count >= 5:
        return True, f"{count} new stories in last 24h"
    return False, f"only {count} new stories in last 24h (< 5 threshold)"


def check_brief_present(sb) -> tuple[bool, str]:
    """Pass if today's national brief exists with ai_text populated."""
    r = (
        sb.table("daily_briefs")
        .select("id, ai_text")
        .eq("date", TODAY_AEST)
        .eq("electorate", "__national__")
        .limit(1)
        .execute()
    )
    if not r.data:
        # Fall back to any brief for today (electorate-specific is fine)
        r2 = (
            sb.table("daily_briefs")
            .select("id, ai_text, electorate")
            .eq("date", TODAY_AEST)
            .limit(1)
            .execute()
        )
        if not r2.data:
            return False, f"no brief for {TODAY_AEST}"
        if not r2.data[0].get("ai_text"):
            return False, f"brief for {TODAY_AEST} has no ai_text"
        return True, f"{r2.data[0]['electorate']} brief for {TODAY_AEST} present + AI"
    if not r.data[0].get("ai_text"):
        return False, f"national brief for {TODAY_AEST} has no ai_text"
    return True, f"national brief for {TODAY_AEST} present + AI"


def check_bias_coverage(sb) -> tuple[bool, str]:
    """Pass if >70% of recent articles map to a source with bias_score."""
    arts = (
        sb.table("news_articles")
        .select("source_id")
        .gte("published_at", ONE_DAY_AGO.isoformat())
        .execute()
    ).data or []
    if not arts:
        return True, "no recent articles to check"

    src_ids = list({a["source_id"] for a in arts if a.get("source_id")})
    if not src_ids:
        return False, "no recent articles linked to a source"

    sources = (
        sb.table("news_sources")
        .select("id, bias_score")
        .in_("id", src_ids)
        .execute()
    ).data or []
    biased_ids = {s["id"] for s in sources if s.get("bias_score") is not None}

    matched = sum(1 for a in arts if a.get("source_id") in biased_ids)
    pct = matched / len(arts)
    if pct >= 0.70:
        return True, f"{matched}/{len(arts)} ({pct:.0%}) recent articles have bias"
    return False, f"only {matched}/{len(arts)} ({pct:.0%}) recent articles have bias (< 70%)"


def check_members_active(sb) -> tuple[bool, str]:
    """Pass if there are 225 active federal members in the DB."""
    r = (
        sb.table("members")
        .select("id", count="exact")
        .eq("is_active", True)
        .eq("level", "federal")
        .execute()
    )
    count = r.count or 0
    if count >= 225:
        return True, f"{count} active federal members"
    return False, f"only {count} active federal members (< 225)"


CHECKS = [
    ("articles_fresh", check_articles_fresh),
    ("stories_active", check_stories_active),
    ("brief_present", check_brief_present),
    ("bias_coverage", check_bias_coverage),
    ("members_active", check_members_active),
]


def log_run(sb, status: str, details: str) -> None:
    """Log to pipeline_runs (reusing the existing table — health_check_runs not yet created)."""
    try:
        sb.table("pipeline_runs").insert({
            "pipeline": "data-monitor",
            "status": status,
            "started_at": NOW.isoformat(),
            "finished_at": NOW.isoformat(),
            "details": details if status == "success" else None,
            "error": details if status == "error" else None,
        }).execute()
    except Exception as e:
        log.warning("Could not log health check run: %s", e)


def main() -> None:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    print()
    print("═══════════════ VERITY HEALTH CHECK ═══════════════")
    print(f"  Run time (UTC): {NOW.isoformat()}")
    print(f"  AEST date:      {TODAY_AEST}")
    print()

    failures: list[str] = []
    summary_lines: list[str] = []

    for name, fn in CHECKS:
        try:
            ok, message = fn(sb)
        except Exception as e:
            ok, message = False, f"check threw exception: {e}"
        marker = "✓" if ok else "✗"
        line = f"  {marker}  {name:20s}  {message}"
        print(line)
        summary_lines.append(line)
        if not ok:
            failures.append(name)

    print()
    if failures:
        print(f"  FAILED: {len(failures)} of {len(CHECKS)} checks")
        print(f"  → {', '.join(failures)}")
    else:
        print(f"  ALL OK ({len(CHECKS)}/{len(CHECKS)})")
    print("════════════════════════════════════════════════════")

    log_run(sb, "error" if failures else "success", "\n".join(summary_lines))

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
