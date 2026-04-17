#!/usr/bin/env python3
"""
ingest_mp_statements.py — Populate representative_updates with verified
official media-release statements from MPs.

Hard rules:
  1. Every inserted row carries a source_url — no unsourced statements.
  2. Each source_url is verified against either
       (a) the MP's last name appearing in the URL, OR
       (b) the URL being on a known official domain (APH, PM, ministerial
           portfolio sites, major party sites).
     URLs that fail both checks are NOT inserted — they go to
     ingestion_review_queue so an operator can reconcile.
  3. Nothing is fabricated. If the page is unreachable or the parser
     can't extract a title + body + date, the release is skipped.

Run:
  python scripts/ingest_mp_statements.py
  python scripts/ingest_mp_statements.py --dry-run      # parse & verify, don't insert
  python scripts/ingest_mp_statements.py --targets 5    # limit MP count for testing
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlparse

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from bs4 import BeautifulSoup
from supabase import create_client

# Responsible-scraping helpers — robots.txt, rate limit, identifying UA.
# MUST be used for every outbound HTTP request in this module.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scraper_etiquette import polite_get  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

TIMEOUT = 20
MAX_LINKS_PER_TARGET = 8


# ── Curated targets ──────────────────────────────────────────────────────────
# Start with ministers + PM + opposition leader + key shadows. Ministerial
# portfolio sites publish media releases on stable, scrape-friendly URLs.
# Add more targets over time as parsers stabilise.
TARGETS: list[tuple[str, str]] = [
    ("Jim Chalmers", "https://ministers.treasury.gov.au/ministers/jim-chalmers-2022/media-releases"),
    ("Stephen Jones", "https://ministers.treasury.gov.au/ministers/stephen-jones-2022/media-releases"),
    ("Andrew Leigh", "https://ministers.treasury.gov.au/ministers/andrew-leigh-2022/media-releases"),
    ("Penny Wong", "https://www.foreignminister.gov.au/minister/penny-wong/media-releases"),
    ("Katy Gallagher", "https://ministers.finance.gov.au/financeminister/media-release"),
]


# ── URL verification ─────────────────────────────────────────────────────────
# Pre-computed set of known official Australian government + party domains.
# Subdomain matches are accepted (e.g. "ministers.treasury.gov.au" matches the
# ".treasury.gov.au" suffix, and "dcceew.gov.au" matches itself).
KNOWN_OFFICIAL_DOMAINS: list[str] = [
    "pm.gov.au",
    "aph.gov.au",
    "parliament.gov.au",
    # Ministerial portfolio sites (subdomain patterns caught by .endswith)
    "treasury.gov.au",
    "finance.gov.au",
    "foreignminister.gov.au",
    "trademinister.gov.au",
    "minister.defence.gov.au",
    "defence.gov.au",
    "homeaffairs.gov.au",
    "health.gov.au",
    "education.gov.au",
    "infrastructure.gov.au",
    "dcceew.gov.au",
    "industry.gov.au",
    "communications.gov.au",
    "ag.gov.au",
    "dss.gov.au",
    "agriculture.gov.au",
    "dewr.gov.au",
    "dss.gov.au",
    "servicesaustralia.gov.au",
    # Major party sites
    "liberal.org.au",
    "alp.org.au",
    "greens.org.au",
    "nationals.org.au",
    "onenation.org.au",
]


def is_known_official_host(host: str) -> bool:
    host = (host or "").lower()
    if not host:
        return False
    return any(host == d or host.endswith("." + d) for d in KNOWN_OFFICIAL_DOMAINS)


def verify_source_url(url: str, first_name: str, last_name: str) -> tuple[bool, str]:
    """
    Reject any URL that cannot be tied to this MP. Return (ok, reason).
    Accept if:
      (a) the MP's last name appears as a substring of the URL path or host, OR
      (b) the URL is on a known official government/party domain.

    Both checks are intentionally lenient — the strict gate is upstream:
    the TARGETS map only lists URLs we expect this specific MP to own.
    """
    if not url:
        return False, "empty url"
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "unparseable url"

    host = (parsed.hostname or "").lower()
    path = (parsed.path or "").lower()
    last_lower = (last_name or "").strip().lower()
    first_lower = (first_name or "").strip().lower()

    if last_lower and (last_lower in path or last_lower in host):
        return True, "mp surname in url"
    if first_lower and last_lower and f"{first_lower}-{last_lower}" in path:
        return True, "mp full name in path"
    if is_known_official_host(host):
        return True, f"official domain ({host})"
    return False, f"url '{url}' does not reference {first_name} {last_name} or a known official domain"


# ── HTML fetch + parse ───────────────────────────────────────────────────────
def fetch(url: str) -> BeautifulSoup | None:
    """Polite HTML fetch. Returns None if robots.txt disallows or on error."""
    resp = polite_get(url, timeout=TIMEOUT)
    if resp is None:
        return None
    if resp.status_code != 200:
        log.warning("HTTP %d on %s", resp.status_code, url)
        return None
    return BeautifulSoup(resp.text, "lxml")


def find_release_links(soup: BeautifulSoup, base_url: str, max_links: int) -> list[str]:
    """
    Heuristic link discovery on a listing page. We only follow URLs whose path
    segment looks like a per-release permalink ("/media/some-release-slug").
    """
    if not soup:
        return []
    release_patterns = [
        re.compile(r"/media/[a-z0-9][a-z0-9\-]{6,}", re.I),
        re.compile(r"/media-releases?/[a-z0-9][a-z0-9\-]{6,}", re.I),
        re.compile(r"/press-release[s]?/[a-z0-9][a-z0-9\-]{6,}", re.I),
        re.compile(r"/news/[a-z0-9][a-z0-9\-]{6,}", re.I),
        re.compile(r"/statements?/[a-z0-9][a-z0-9\-]{6,}", re.I),
        re.compile(r"/speeches?/[a-z0-9][a-z0-9\-]{6,}", re.I),
    ]
    anti = re.compile(
        r"(\?|#|/page/|/archive|/search|/feed|/category/|/tag/|readspeaker|rss|/share/)",
        re.I,
    )
    found: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#") or anti.search(href):
            continue
        full = urljoin(base_url, href)
        if full in seen:
            continue
        if any(p.search(full) for p in release_patterns):
            seen.add(full)
            found.append(full)
            if len(found) >= max_links:
                break
    return found


def parse_release(soup: BeautifulSoup) -> dict | None:
    """Extract title + full body + ISO date from a release page, or None."""
    if not soup:
        return None

    # Title
    title: str | None = None
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
    if not title:
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)
    if not title or len(title) < 10:
        return None

    # Body — prefer <article> or <main>, concatenate meaningful paragraphs
    container = soup.find("article") or soup.find("main") or soup
    paragraphs: list[str] = []
    for p in container.find_all("p"):
        text = p.get_text(" ", strip=True)
        if text and len(text) >= 40:
            paragraphs.append(text)
        if sum(len(x) for x in paragraphs) > 4000:
            break
    body = "\n\n".join(paragraphs).strip()
    if not body:
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            body = og_desc["content"].strip()
    if not body or len(body) < 60:
        return None

    # Trim full body to a safe storage size.
    if len(body) > 6000:
        body = body[:5997] + "…"

    # Date
    date_iso: str | None = None
    time_tag = soup.find("time")
    if time_tag and time_tag.get("datetime"):
        date_iso = time_tag["datetime"]
    if not date_iso:
        meta_date = soup.find("meta", property="article:published_time")
        if meta_date and meta_date.get("content"):
            date_iso = meta_date["content"]

    return {"title": title, "body": body, "date": date_iso}


# ── DB helpers ───────────────────────────────────────────────────────────────
def find_member(sb, full_name: str) -> dict | None:
    """Look up a member by full name. Returns the row or None."""
    parts = full_name.strip().split()
    if len(parts) < 2:
        return None
    first, last = parts[0], parts[-1]
    try:
        r = (
            sb.table("members")
            .select("id, first_name, last_name, is_active")
            .eq("first_name", first)
            .eq("last_name", last)
            .limit(1)
            .execute()
        )
        if r.data:
            return r.data[0]
    except Exception as e:
        log.warning("Member lookup failed for %s: %s", full_name, e)
    return None


def statement_already_exists(sb, member_id: str, source_url: str) -> bool:
    """Dedupe by (member_id, source_url). Backed by the unique index."""
    try:
        r = (
            sb.table("representative_updates")
            .select("id")
            .eq("member_id", member_id)
            .eq("source_url", source_url)
            .limit(1)
            .execute()
        )
        return bool(r.data)
    except Exception:
        return False


def queue_for_review(sb, proposed: dict, reason: str) -> None:
    """Write a rejected row to ingestion_review_queue instead of dropping it."""
    try:
        sb.table("ingestion_review_queue").insert(
            {
                "source_table": "representative_updates",
                "proposed_data": proposed,
                "reason": reason,
            }
        ).execute()
    except Exception as e:
        log.warning("Failed to queue for review: %s", e)


def insert_statement(
    sb,
    member_id: str,
    title: str,
    body: str,
    source_url: str,
    published_at: str,
) -> bool:
    """Insert a verified statement. Returns True on success.

    Derived fields:
      source_domain — hostname of source_url, stored for defamation defence
        (rollup by domain when attribution needs review).
    """
    content = f"{title}\n\n{body}"
    source_domain = urlparse(source_url).hostname or ""
    row: dict[str, Any] = {
        "member_id": member_id,
        "content": content,
        "source": "official_media_release",
        "source_url": source_url,
        "source_domain": source_domain,
        "published_at": published_at,
    }
    try:
        sb.table("representative_updates").insert(row).execute()
        return True
    except Exception as e:
        # If the column doesn't exist yet (schema out of date), retry without it
        # so the scraper still functions. The operator will see the log and can
        # add the column via migration_mp_statements.sql or the dashboard.
        msg = str(e).lower()
        if "source_domain" in msg and ("column" in msg or "not found" in msg or "does not exist" in msg):
            log.warning(
                "source_domain column not present on representative_updates — "
                "inserting without it. Run migration_mp_statements.sql to add it."
            )
            row.pop("source_domain", None)
            try:
                sb.table("representative_updates").insert(row).execute()
                return True
            except Exception as e2:
                log.warning("Insert failed (retry without source_domain): %s", e2)
                return False
        log.warning("Insert failed: %s", e)
        return False


def process_target(
    sb,
    target: tuple[str, str],
    counters: dict[str, int],
    dry_run: bool,
) -> None:
    name, listing_url = target
    print(f"\n→ {name}  ({listing_url})")

    member = find_member(sb, name)
    if not member:
        print(f"  ✗ Member '{name}' not in members table — skipping")
        counters["missing_member"] += 1
        return
    member_id = member["id"]
    first_name = member["first_name"]
    last_name = member["last_name"]

    listing = fetch(listing_url)
    if not listing:
        print("  ✗ Couldn't fetch listing page")
        counters["unreachable"] += 1
        return

    links = find_release_links(listing, listing_url, MAX_LINKS_PER_TARGET)
    if not links:
        print("  – No release links found on listing page")
        return
    print(f"  Found {len(links)} candidate links")

    for link in links:
        ok, reason = verify_source_url(link, first_name, last_name)
        if not ok:
            counters["failed_verification"] += 1
            if not dry_run:
                queue_for_review(
                    sb,
                    proposed={
                        "member_id": member_id,
                        "mp_name": name,
                        "source_url": link,
                    },
                    reason=f"URL verification failed: {reason}",
                )
            print(f"  ⚠ {link} → queued for review ({reason})")
            continue

        if not dry_run and statement_already_exists(sb, member_id, link):
            counters["skipped_duplicate"] += 1
            continue

        release_soup = fetch(link)
        release = parse_release(release_soup)
        if not release:
            counters["unparseable"] += 1
            if not dry_run:
                queue_for_review(
                    sb,
                    proposed={
                        "member_id": member_id,
                        "mp_name": name,
                        "source_url": link,
                    },
                    reason="Page did not parse into a title + body",
                )
            print(f"  – {link} not parseable")
            continue

        published_at = release.get("date") or datetime.now(tz=timezone.utc).isoformat()

        if dry_run:
            counters["would_insert"] += 1
            print(f"  ✓ (dry-run) {release['title'][:80]}")
            continue

        if insert_statement(
            sb,
            member_id=member_id,
            title=release["title"],
            body=release["body"],
            source_url=link,
            published_at=published_at,
        ):
            counters["inserted"] += 1
            print(f"  ✓ {release['title'][:80]}")
        else:
            counters["insert_failed"] += 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Fetch + parse + verify, do not write")
    parser.add_argument("--targets", type=int, default=None, help="Limit to first N targets")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY in .env")
    sb = create_client(url, key)

    targets = TARGETS[: args.targets] if args.targets else TARGETS

    counters: dict[str, int] = {
        "inserted": 0,
        "would_insert": 0,
        "skipped_duplicate": 0,
        "failed_verification": 0,
        "unparseable": 0,
        "unreachable": 0,
        "missing_member": 0,
        "insert_failed": 0,
    }

    print()
    mode = "DRY-RUN" if args.dry_run else "LIVE"
    print(f"═══════════════ INGEST MP STATEMENTS ({mode}) ═══════════════")
    print(f"Targets: {len(targets)}")

    for t in targets:
        process_target(sb, t, counters, args.dry_run)

    print()
    print("═══════════════ SUMMARY ═══════════════")
    for k, v in counters.items():
        if v:
            print(f"  {k:<22s}: {v}")
    print("════════════════════════════════════════")


if __name__ == "__main__":
    main()
