#!/usr/bin/env python3
"""
verify_schema.py — Verify production Supabase schema matches expectations.

Run after any migration to confirm no drift.

Usage:
  python scripts/verify_schema.py
"""

import os
import sys
from dotenv import load_dotenv

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase not installed. Run: pip install supabase")
    sys.exit(1)

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY required in .env")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Expected tables (public schema, as of Prompt 4 baseline) ─────────────────

EXPECTED_TABLES = [
    # Core data
    "members", "parties", "electorates", "divisions", "division_votes",
    "bills", "bill_arguments", "bill_changes", "bill_personal_impact",
    "committee_memberships", "hansard_entries", "donations", "individual_donations",
    "registered_interests", "government_contracts", "electorate_demographics",
    "participation_index", "mp_contradictions", "promises",

    # News & intelligence
    "news_articles", "news_stories", "news_story_articles", "news_sources",
    "news_items", "media_releases", "source_documents", "source_ownership_groups",
    "verified_source_domains", "story_primary_sources", "story_coverage_analysis",
    "story_factchecks", "story_money_trails", "story_mp_context",
    "story_timelines", "story_verdicts", "timeline_events", "timeline_topics",

    # Polls
    "published_polls", "poll_aggregates",
    "daily_polls", "daily_poll_responses", "poll_admin_actions", "poll_reports",

    # User data
    "user_preferences", "user_profiles", "user_follows", "user_reads",
    "user_interactions", "user_engagement_stats", "user_notifications",
    "analytics_events", "push_tokens", "notification_preferences",
    "notification_log", "share_events", "mp_messages", "reactions",

    # Community
    "community_posts", "community_comments", "community_votes", "community_reports",

    # Verification
    "verification_audit_log", "phone_verifications",

    # Content & features
    "daily_briefs", "party_policies", "sitting_calendar",
    "representative_updates", "pipeline_runs", "pipeline_heartbeats",
    "morning_signals", "civic_quiz", "civic_quiz_answers",
    "local_announcements", "local_developments", "fun_facts",

    # Reference & mapping
    "issue_catalog", "issues", "state_members", "state_bills",
    "councils", "councillors", "election_cycles", "election_info",
    "electorate_mapping", "email_domain_blocklist",
    "data_limitations", "industry_topic_mapping",
    "relevance_cache", "bill_ingestion_log",
]

# Tables that MUST have RLS enabled
RLS_REQUIRED = [
    "user_preferences", "user_follows", "user_reads", "user_interactions",
    "user_engagement_stats", "user_notifications", "analytics_events",
    "push_tokens", "notification_preferences", "mp_messages",
    "community_posts", "community_comments", "community_votes",
    "community_reports", "bill_personal_impact", "verification_audit_log",
    "phone_verifications", "published_polls", "poll_aggregates",
    "share_events", "reactions",
]

# Tables that should NOT exist (dropped or archived in Prompt 4)
DROPPED_TABLES = [
    "politicians", "digest_log",
    "donor_influence", "bill_electorate_sentiment", "political_risk",
]

# Core columns that must exist on key tables
REQUIRED_COLUMNS = {
    "members": ["id", "first_name", "last_name", "party_id", "electorate_id", "chamber", "is_active", "photo_url"],
    "bills": ["id", "title", "current_status", "is_live", "narrative_status", "summary_plain"],
    "user_preferences": ["user_id", "verification_tier", "postcode"],
    "published_polls": ["id", "pollster", "tpp_alp", "tpp_lnp", "publish_date", "source_url"],
}

# ── Checks ───────────────────────────────────────────────────────────────────

def check_tables():
    """Check all expected tables exist by attempting a zero-row select."""
    missing = []
    for table in EXPECTED_TABLES:
        try:
            client.table(table).select("*", count="exact").limit(0).execute()
        except Exception:
            missing.append(table)
    return missing


def check_rls():
    """Check RLS is enabled on required tables (requires service role)."""
    # This check requires pg_tables access which the anon key may not have
    # Just report which tables we expect RLS on
    return RLS_REQUIRED


def check_columns():
    """Check required columns exist on key tables."""
    issues = []
    for table, columns in REQUIRED_COLUMNS.items():
        try:
            # Select just the required columns — if any is missing, it'll error
            cols = ",".join(columns)
            client.table(table).select(cols).limit(1).execute()
        except Exception as e:
            issues.append(f"{table}: {e}")
    return issues


def check_dropped():
    """Check that dropped/archived tables no longer exist in public schema."""
    zombies = []
    for table in DROPPED_TABLES:
        try:
            result = client.table(table).select("*", count="exact").limit(0).execute()
            zombies.append(table)
        except Exception:
            pass
    return zombies


def main():
    print("Verity Schema Verification")
    print("=" * 50)

    # Check tables
    print("\n1. Checking expected tables exist...")
    missing = check_tables()
    if missing:
        print(f"  FAIL: {len(missing)} missing tables:")
        for t in missing:
            print(f"    - {t}")
    else:
        print(f"  PASS: All {len(EXPECTED_TABLES)} expected tables exist")

    # Check columns
    print("\n2. Checking required columns on key tables...")
    col_issues = check_columns()
    if col_issues:
        print(f"  FAIL: {len(col_issues)} column issues:")
        for issue in col_issues:
            print(f"    - {issue}")
    else:
        print(f"  PASS: All required columns present on {len(REQUIRED_COLUMNS)} key tables")

    # Check dropped tables aren't back
    print("\n3. Checking dropped tables are gone...")
    zombies = check_dropped()
    if zombies:
        print(f"  WARN: {len(zombies)} dropped tables still accessible:")
        for t in zombies:
            print(f"    - {t}")
    else:
        print(f"  PASS: All {len(DROPPED_TABLES)} dropped tables confirmed gone")

    # Summary
    print("\n" + "=" * 50)
    total_issues = len(missing) + len(col_issues)
    if total_issues == 0 and not zombies:
        print("RESULT: PASS — schema matches expectations")
    else:
        print(f"RESULT: FAIL — {total_issues} issues, {len(zombies)} zombie tables")
        sys.exit(1)


if __name__ == "__main__":
    main()
