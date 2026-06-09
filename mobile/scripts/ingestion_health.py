#!/usr/bin/env python3
"""
ingestion_health.py — Weekly ingestion pipeline health audit.

Queries Supabase for current data metrics, compares against previous run,
and generates a markdown health report.

Checks:
  A. Core counts (articles, stories, members, bills) — flag if dropped >5%
  B. Bias DB coverage — target >= 80% of sources have bias data
  C. Source freshness — flag sources with no article in past 48h
  D. Division votes freshness — flag if no new vote in past 14 days

Usage:
  python ingestion_health.py              # writes report + state
  python ingestion_health.py --dry-run    # prints report only

Environment:
  SUPABASE_URL  — Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY  — service_role or anon key

Exit codes:
  0 = all checks passed
  1 = one or more checks failed
  2 = config error
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from supabase import create_client

SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
)
SUPABASE_SERVICE_ROLE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
)

STATE_PATH = Path("docs/ingestion-health/_state.json")
REPORT_DIR = Path("docs/ingestion-health")

# Thresholds
BIAS_TARGET_PCT = 80
STALE_SOURCE_HOURS = 48
VOTE_STALE_DAYS = 14
COUNT_DROP_PCT = 5


def count_rows(sb, table, **filters):
    """Exact row count using PostgREST count header."""
    q = sb.table(table).select("id", count="exact")
    for k, v in filters.items():
        q = q.eq(k, v)
    return q.limit(1).execute().count or 0


def run_checks(sb):
    """Run all health checks. Returns (checks[], metrics{})."""
    now = datetime.now(tz=timezone.utc)
    checks = []

    # Load previous state
    prev = {}
    if STATE_PATH.exists():
        try:
            prev = json.loads(STATE_PATH.read_text())
        except Exception:
            pass

    # ── A. Core counts ───────────────────────────────────────────────────
    counts = {
        "articles": count_rows(sb, "news_articles"),
        "stories": count_rows(sb, "news_stories"),
        "members": count_rows(sb, "members", is_active=True),
        "bills": count_rows(sb, "bills"),
    }

    for key, curr in counts.items():
        prev_val = prev.get(key, 0)
        if prev_val > 0:
            delta = curr - prev_val
            drop = max(0, (prev_val - curr) / prev_val * 100)
            status = "FAIL" if drop > COUNT_DROP_PCT else "PASS"
            sign = "+" if delta >= 0 else ""
            msg = f"{curr:,} ({sign}{delta:,})"
            if status == "FAIL":
                msg += f" — **{drop:.1f}% drop**"
            checks.append({"name": f"{key}_count", "status": status, "message": msg})
        else:
            checks.append({
                "name": f"{key}_count",
                "status": "PASS",
                "message": f"{curr:,} (baseline)",
            })

    # ── B. Bias DB coverage ──────────────────────────────────────────────
    # Measure by articles: what % of articles come from sources with bias data.
    # This reflects user-facing coverage, not raw source count.
    src_resp = sb.table("news_sources").select("id,bias_score").execute()
    all_src = src_resp.data or []
    bias_source_ids = set(s["id"] for s in all_src if s.get("bias_score") is not None)

    art_resp = sb.table("news_articles").select("source_id").limit(5000).execute()
    all_articles = art_resp.data or []
    covered_articles = sum(1 for a in all_articles if a.get("source_id") in bias_source_ids)
    total_articles_sample = len(all_articles)
    coverage = round(covered_articles / total_articles_sample * 100, 1) if total_articles_sample else 0

    checks.append({
        "name": "bias_coverage",
        "status": "PASS" if coverage >= BIAS_TARGET_PCT else "FAIL",
        "message": f"{coverage}% of articles have bias-tagged sources ({covered_articles}/{total_articles_sample}) — target {BIAS_TARGET_PCT}%",
    })

    # ── C. Source freshness ──────────────────────────────────────────────
    # Only check sources that have actually produced articles (not empty DB rows).
    cutoff = (now - timedelta(hours=STALE_SOURCE_HOURS)).isoformat()
    recent = (
        sb.table("news_articles")
        .select("source_id")
        .gte("published_at", cutoff)
        .limit(5000)
        .execute()
    )
    fresh_ids = set(r["source_id"] for r in (recent.data or []))

    # Get source IDs that have ever had articles
    all_article_sources = set(a.get("source_id") for a in all_articles)

    src_names = sb.table("news_sources").select("id,name").execute()
    active_sources = {
        s["id"]: s["name"] for s in (src_names.data or [])
        if s["id"] in all_article_sources
    }

    stale = sorted([name for sid, name in active_sources.items() if sid not in fresh_ids])
    stale_pct = round(len(stale) / len(active_sources) * 100) if active_sources else 0

    checks.append({
        "name": "source_freshness",
        "status": "WARN" if stale_pct > 50 else "PASS",
        "message": f"{len(stale)}/{len(active_sources)} active sources stale (>{STALE_SOURCE_HOURS}h)",
        "detail": stale[:30],
    })

    # ── D. Vote freshness ────────────────────────────────────────────────
    div_resp = (
        sb.table("divisions")
        .select("date")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    latest_raw = (div_resp.data or [{}])[0].get("date")
    if latest_raw:
        latest_date = datetime.strptime(str(latest_raw)[:10], "%Y-%m-%d").date()
        days_ago = (now.date() - latest_date).days
        msg = f"Latest division {latest_date} ({days_ago}d ago)"
        if days_ago > VOTE_STALE_DAYS:
            msg += f" — **>{VOTE_STALE_DAYS}d stale**"
        checks.append({
            "name": "vote_freshness",
            "status": "WARN" if days_ago > VOTE_STALE_DAYS else "PASS",
            "message": msg,
        })
    else:
        checks.append({
            "name": "vote_freshness",
            "status": "WARN",
            "message": "No divisions found",
        })

    metrics = {
        **counts,
        "bias_coverage": coverage,
        "stale_sources": len(stale),
        "stale_source_names": stale[:20],
        "latest_division": str(latest_raw)[:10] if latest_raw else None,
        "days_since_division": days_ago if latest_raw else None,
        "timestamp": now.isoformat(),
    }

    return checks, metrics


def build_report(checks, metrics):
    """Generate markdown report from check results."""
    now = datetime.now(tz=timezone.utc)
    today = now.strftime("%Y-%m-%d")

    failed = [c for c in checks if c["status"] == "FAIL"]
    warned = [c for c in checks if c["status"] == "WARN"]
    passed = [c for c in checks if c["status"] == "PASS"]

    if failed:
        verdict, icon = "FAILED", "🔴"
    elif warned:
        verdict, icon = "WARNINGS", "🟡"
    else:
        verdict, icon = "HEALTHY", "🟢"

    status_icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️"}

    lines = [
        f"# Ingestion Health — {today}",
        "",
        f"**{icon} {verdict}** — {len(failed)} failed, {len(warned)} warnings, {len(passed)} passed",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
    ]
    for c in checks:
        lines.append(f"| {c['name']} | {status_icon[c['status']]} | {c['message']} |")

    # Stale sources detail
    stale_detail = next(
        (c.get("detail") for c in checks
         if c["name"] == "source_freshness" and c.get("detail")),
        None,
    )
    if stale_detail:
        lines += ["", "### Stale Sources", ""]
        for s in stale_detail:
            lines.append(f"- {s}")

    # Metrics snapshot
    lines += [
        "",
        "### Metrics Snapshot",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Articles | {metrics.get('articles', '?'):,} |",
        f"| Stories | {metrics.get('stories', '?'):,} |",
        f"| Active Members | {metrics.get('members', '?'):,} |",
        f"| Bills | {metrics.get('bills', '?'):,} |",
        f"| Bias Coverage | {metrics.get('bias_coverage', '?')}% |",
        f"| Latest Division | {metrics.get('latest_division', '?')} |",
        f"| Stale Sources | {metrics.get('stale_sources', '?')} |",
    ]

    # Footer
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    if repo and run_id:
        lines += ["", f"---", f"*{now.strftime('%H:%M UTC %Y-%m-%d')} · [workflow run]({server}/{repo}/actions/runs/{run_id})*"]
    else:
        lines += ["", "---", f"*{now.strftime('%H:%M UTC %Y-%m-%d')}*"]

    return "\n".join(lines)


def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(2)

    dry_run = "--dry-run" in sys.argv
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    now = datetime.now(tz=timezone.utc)
    today = now.strftime("%Y-%m-%d")

    print(f"Running ingestion health checks at {now.strftime('%Y-%m-%d %H:%M UTC')} ...")

    checks, metrics = run_checks(sb)
    report = build_report(checks, metrics)
    failed = [c for c in checks if c["status"] == "FAIL"]

    if dry_run:
        print(report)
        print(f"\n{'❌ FAILED' if failed else '✅ PASSED'}")
        sys.exit(1 if failed else 0)

    # Write report
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORT_DIR / f"{today}.md"
    report_path.write_text(report)
    print(f"Report → {report_path}")

    # Update state
    STATE_PATH.write_text(json.dumps(metrics, indent=2))
    print(f"State  → {STATE_PATH}")

    # GitHub Actions: step summary
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(report + "\n")

    # GitHub Actions: outputs for downstream steps
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a") as f:
            f.write(f"failed={'true' if failed else 'false'}\n")
            f.write(f"verdict={'FAIL' if failed else 'PASS'}\n")
            f.write(f"report_date={today}\n")

    if failed:
        print(f"\n❌ {len(failed)} check(s) FAILED:")
        for c in failed:
            print(f"   {c['name']}: {c['message']}")
        sys.exit(1)
    else:
        print(f"\n✅ All checks passed")
        sys.exit(0)


if __name__ == "__main__":
    main()
