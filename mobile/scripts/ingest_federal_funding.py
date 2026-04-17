#!/usr/bin/env python3
"""
ingest_federal_funding.py — populate local_announcements with verified
federal funding announcements.

Three sources, in order of data quality:
  1. investment.infrastructure.gov.au project database
     — HTML scrape of the public project listing + each detail page.
  2. grants.gov.au RSS feed
     — best-effort; GrantConnect's public surfaces are JavaScript-heavy and
       the RSS endpoint may shift. Failures go to ingestion_review_queue.
  3. representative_updates content scan
     — re-use of the verified ministerial media-release pipeline: any
       statement whose content matches the funding-announcement pattern
       (mentions "$X million"/"$X billion" + funding/invest/grant) becomes
       a local_announcement tied back to the quoting minister.

Hard rules:
  1. source_url is mandatory. No row inserted without one.
  2. source_url must be on a known Australian government domain, or an
     MP's personal/ministerial site via the known-domain whitelist.
  3. Every dollar amount inserted is extracted from the source text — no
     guessing, no padding, no rounding beyond what the source quotes.
  4. Electorate resolution: postcode match first, then electorate-name
     word-boundary match. Unresolved rows go to ingestion_review_queue
     rather than being assigned a guessed electorate.

Run:
  python scripts/ingest_federal_funding.py
  python scripts/ingest_federal_funding.py --dry-run
  python scripts/ingest_federal_funding.py --source infra|grants|statements
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
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scraper_etiquette import polite_get, polite_feed_parse  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

TIMEOUT = 20

# URL whitelist — anything matching is considered a verified official source.
KNOWN_GOV_DOMAINS: list[str] = [
    # Core .gov.au
    "gov.au",                       # any subdomain of .gov.au is government
    # Explicit portals
    "investment.infrastructure.gov.au",
    "infrastructure.gov.au",
    "grants.gov.au",
    "business.gov.au",
    "pm.gov.au",
    "aph.gov.au",
    "treasury.gov.au",
    # Ministerial portfolios
    "ministers.treasury.gov.au",
    "ministers.finance.gov.au",
    "foreignminister.gov.au",
    "trademinister.gov.au",
    "minister.defence.gov.au",
    "minister.homeaffairs.gov.au",
    "health.gov.au",
    "education.gov.au",
    "dcceew.gov.au",
    "industry.gov.au",
    "communications.gov.au",
    "ag.gov.au",
    "dss.gov.au",
    "agriculture.gov.au",
    "dewr.gov.au",
]

STATE_MARKERS: dict[str, str] = {
    "new south wales": "NSW",
    "nsw": "NSW",
    "victoria": "VIC",
    "victorian": "VIC",
    " vic ": "VIC",
    "queensland": "QLD",
    "qld": "QLD",
    "western australia": "WA",
    " wa ": "WA",
    "south australia": "SA",
    " sa ": "SA",
    "tasmania": "TAS",
    "tasmanian": "TAS",
    " tas ": "TAS",
    "australian capital territory": "ACT",
    " act ": "ACT",
    "northern territory": "NT",
    " nt ": "NT",
}

CATEGORY_PATTERNS: list[tuple[list[str], str]] = [
    (["road", "rail", "highway", "bridge", "transport", "port ", "airport", "infrastructure"], "infrastructure"),
    (["hospital", "medical", "health centre", "medicare"], "health"),
    (["school", "university", "tafe", "education"], "education"),
    (["housing", "homeless", "rent", "social housing"], "housing"),
    (["environment", "climate", "renewable", "solar", "wind"], "environment"),
    (["community centre", "library", "sports ground"], "community"),
    (["jobs", "economy", "manufacturing", "industry"], "economy"),
]

MIN_AMOUNT_AUD = 10_000       # skip sub-$10k line items; not "announcement-scale"


# ── Shared helpers ───────────────────────────────────────────────────────────
def is_known_gov_host(host: str) -> bool:
    host = (host or "").lower()
    if not host:
        return False
    return any(host == d or host.endswith("." + d) for d in KNOWN_GOV_DOMAINS)


def verify_source_url(url: str) -> tuple[bool, str]:
    if not url:
        return False, "empty url"
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "unparseable url"
    host = (parsed.hostname or "").lower()
    if is_known_gov_host(host):
        return True, f"official domain ({host})"
    return False, f"not a recognised .gov.au or ministerial domain: {host}"


def fetch(url: str) -> BeautifulSoup | None:
    """Polite HTML fetch. Returns None if robots.txt disallows or on error."""
    resp = polite_get(url, timeout=TIMEOUT)
    if resp is None:
        return None
    if resp.status_code != 200:
        log.warning("HTTP %d on %s", resp.status_code, url)
        return None
    return BeautifulSoup(resp.text, "lxml")


def extract_budget_aud(text: str) -> int | None:
    """
    Parse AUD amounts from announcement text.
    Returns the largest dollar amount found, or None.
    Matches: "$X million", "$X.Y billion", "$X,XXX,XXX", "$X,XXX".
    """
    if not text:
        return None
    candidates: list[int] = []

    # $X million / $X billion variations
    for match in re.finditer(
        r"\$\s*([0-9]+(?:\.[0-9]+)?)\s*(million|billion|thousand|m\b|b\b)",
        text,
        re.IGNORECASE,
    ):
        num = float(match.group(1))
        unit = match.group(2).lower()
        if unit.startswith("b"):
            candidates.append(int(num * 1_000_000_000))
        elif unit.startswith("m"):
            candidates.append(int(num * 1_000_000))
        elif unit.startswith("t"):
            candidates.append(int(num * 1_000))

    # $X,XXX,XXX / $X,XXX
    for match in re.finditer(r"\$\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?)", text):
        try:
            candidates.append(int(float(match.group(1).replace(",", ""))))
        except ValueError:
            pass

    if not candidates:
        return None
    largest = max(candidates)
    return largest if largest >= MIN_AMOUNT_AUD else None


def guess_category(text: str) -> str:
    lower = (text or "").lower()
    for keywords, cat in CATEGORY_PATTERNS:
        if any(k in lower for k in keywords):
            return cat
    return "infrastructure"  # default for transport-heavy funding corpus


def extract_state(text: str) -> str | None:
    lower = f" {(text or '').lower()} "
    for marker, code in STATE_MARKERS.items():
        if marker in lower:
            return code
    return None


# ── Electorate resolution ────────────────────────────────────────────────────
def load_electorates(sb) -> list[dict]:
    """Fetch all federal electorates once; re-use for every resolution."""
    try:
        r = (
            sb.table("electorates")
            .select("id, name, state, postcodes")
            .eq("level", "federal")
            .execute()
        )
        return r.data or []
    except Exception as e:
        log.warning("Failed to load electorates: %s", e)
        return []


def resolve_electorate(
    text: str, electorates: list[dict]
) -> tuple[str | None, str | None]:
    """Return (electorate_id, state) using postcode then name match."""
    if not text:
        return None, None

    # Pass 1: postcodes (most reliable — unambiguous 4-digit match).
    postcodes = {pc for pc in re.findall(r"\b\d{4}\b", text) if 1000 <= int(pc) <= 9999}
    if postcodes:
        for e in electorates:
            ep = e.get("postcodes") or []
            for pc in postcodes:
                if pc in ep:
                    return e["id"], e["state"]

    # Pass 2: electorate name at a word boundary. Skip names that collide with
    # generic place words (capital-city names like "Sydney" and "Melbourne" are
    # also electorates — we require the whole phrase "Electorate of X" or
    # explicit quote to avoid false positives).
    lower = text.lower()
    for e in electorates:
        name = (e.get("name") or "").strip()
        if not name or len(name) < 4:
            continue
        # Very generic single-word names need stricter context.
        strict = name.lower() in {"sydney", "melbourne", "brisbane", "perth", "adelaide", "hobart", "darwin"}
        if strict:
            if f"division of {name.lower()}" in lower or f"electorate of {name.lower()}" in lower:
                return e["id"], e["state"]
        else:
            if re.search(r"\b" + re.escape(name.lower()) + r"\b", lower):
                return e["id"], e["state"]

    return None, None


# ── DB helpers ───────────────────────────────────────────────────────────────
def announcement_already_exists(sb, source_url: str) -> bool:
    try:
        r = (
            sb.table("local_announcements")
            .select("id")
            .eq("source_url", source_url)
            .limit(1)
            .execute()
        )
        return bool(r.data)
    except Exception:
        return False


def queue_for_review(sb, proposed: dict, reason: str) -> None:
    try:
        sb.table("ingestion_review_queue").insert(
            {
                "source_table": "local_announcements",
                "proposed_data": proposed,
                "reason": reason,
            }
        ).execute()
    except Exception as e:
        log.warning("Failed to queue for review: %s", e)


def insert_announcement(
    sb,
    *,
    title: str,
    body: str | None,
    category: str,
    state: str | None,
    electorate_id: str | None,
    member_id: str | None,
    budget_amount: int | None,
    announced_at: str,
    source_url: str,
    source: str,
) -> bool:
    try:
        sb.table("local_announcements").insert(
            {
                "title": title,
                "body": body,
                "category": category,
                "state": state,
                "electorate_id": electorate_id,
                "member_id": member_id,
                # local_announcements.budget_amount is text per existing hook — stringify here.
                "budget_amount": str(budget_amount) if budget_amount is not None else None,
                "announced_at": announced_at,
                "source_url": source_url,
                "source": source,
            }
        ).execute()
        return True
    except Exception as e:
        log.warning("Insert failed (%s): %s", source_url, e)
        return False


# ── Source 1: Investment Infrastructure ──────────────────────────────────────
INFRA_LISTING_URL = "https://investment.infrastructure.gov.au/projects"
INFRA_MAX_PROJECTS = 40


def fetch_infra(sb, electorates: list[dict], counters: dict, dry_run: bool) -> None:
    print(f"\n→ Department of Infrastructure ({INFRA_LISTING_URL})")
    listing = fetch(INFRA_LISTING_URL)
    if not listing:
        print("  ✗ Could not reach listing")
        counters["infra_unreachable"] += 1
        return

    # Heuristic: project detail links contain /project/<slug> or similar.
    project_links: list[str] = []
    seen: set[str] = set()
    pattern = re.compile(r"/projects?/[a-z0-9][a-z0-9\-]{6,}", re.I)
    for a in listing.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#"):
            continue
        full = urljoin(INFRA_LISTING_URL, href)
        if full in seen:
            continue
        if pattern.search(full):
            seen.add(full)
            project_links.append(full)
        if len(project_links) >= INFRA_MAX_PROJECTS:
            break

    print(f"  Found {len(project_links)} candidate project pages")

    for link in project_links:
        ok, reason = verify_source_url(link)
        if not ok:
            counters["infra_failed_verification"] += 1
            if not dry_run:
                queue_for_review(
                    sb,
                    proposed={"source": "infrastructure", "source_url": link},
                    reason=f"URL verification failed: {reason}",
                )
            continue

        if not dry_run and announcement_already_exists(sb, link):
            counters["infra_duplicate"] += 1
            continue

        soup = fetch(link)
        if not soup:
            counters["infra_unparseable"] += 1
            continue

        # Title
        title = None
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            title = og_title["content"].strip()
        if not title:
            h1 = soup.find("h1")
            if h1:
                title = h1.get_text(strip=True)
        if not title or len(title) < 10:
            counters["infra_unparseable"] += 1
            continue

        # Body
        body_parts: list[str] = []
        container = soup.find("article") or soup.find("main") or soup
        for p in container.find_all("p"):
            t = p.get_text(" ", strip=True)
            if t and len(t) >= 40:
                body_parts.append(t)
            if sum(len(x) for x in body_parts) > 4000:
                break
        body = "\n\n".join(body_parts).strip() or None

        combined = f"{title}\n\n{body or ''}"
        budget_amount = extract_budget_aud(combined)
        category = guess_category(combined)
        state = extract_state(combined)
        electorate_id, resolved_state = resolve_electorate(combined, electorates)
        if resolved_state and not state:
            state = resolved_state

        # Announced date — fall back to today if none findable.
        announced_at = datetime.now(tz=timezone.utc).isoformat()
        time_tag = soup.find("time")
        if time_tag and time_tag.get("datetime"):
            announced_at = time_tag["datetime"]

        if not electorate_id and not state:
            counters["infra_no_location"] += 1
            if not dry_run:
                queue_for_review(
                    sb,
                    proposed={
                        "source": "infrastructure",
                        "source_url": link,
                        "title": title,
                        "budget_amount": budget_amount,
                    },
                    reason="Could not resolve electorate or state from project text",
                )
            continue

        if dry_run:
            counters["infra_would_insert"] += 1
            print(f"  ✓ (dry-run) {title[:70]} [{state or 'unknown'}] ${budget_amount or 0:,}")
            continue

        if insert_announcement(
            sb,
            title=title,
            body=body,
            category=category,
            state=state,
            electorate_id=electorate_id,
            member_id=None,
            budget_amount=budget_amount,
            announced_at=announced_at,
            source_url=link,
            source="infrastructure",
        ):
            counters["infra_inserted"] += 1
            print(f"  ✓ {title[:70]}")


# ── Source 2: GrantConnect ──────────────────────────────────────────────────
# The public RSS endpoint intermittently changes. This is a BEST-EFFORT
# implementation — every failure path funnels to the review queue so an
# operator can see what broke and adjust the parser.
GRANTS_RSS_CANDIDATES: list[str] = [
    "https://www.grants.gov.au/Go/RssFeed/PublishedGA",
    "https://www.grants.gov.au/Go/RssFeed/PublishedGO",
]


def fetch_grants(sb, electorates: list[dict], counters: dict, dry_run: bool) -> None:
    print("\n→ GrantConnect RSS (best-effort)")
    entries: list[Any] = []
    for feed_url in GRANTS_RSS_CANDIDATES:
        try:
            parsed = polite_feed_parse(feed_url)
            if parsed and parsed.entries:
                entries = parsed.entries
                print(f"  Using {feed_url} ({len(entries)} entries)")
                break
        except Exception as e:
            log.warning("GrantConnect RSS %s failed: %s", feed_url, e)

    if not entries:
        print("  ⚠ No GrantConnect entries retrievable — parser needs tuning.")
        counters["grants_unreachable"] += 1
        if not dry_run:
            queue_for_review(
                sb,
                proposed={"source": "grants", "attempted_urls": GRANTS_RSS_CANDIDATES},
                reason="GrantConnect RSS endpoints did not return entries",
            )
        return

    for entry in entries[:50]:
        title = (getattr(entry, "title", "") or "").strip()
        link = (getattr(entry, "link", "") or "").strip()
        summary = (getattr(entry, "summary", "") or getattr(entry, "description", "") or "").strip()
        if not title or not link:
            continue

        ok, reason = verify_source_url(link)
        if not ok:
            counters["grants_failed_verification"] += 1
            if not dry_run:
                queue_for_review(
                    sb,
                    proposed={"source": "grants", "source_url": link, "title": title},
                    reason=f"URL verification failed: {reason}",
                )
            continue

        if not dry_run and announcement_already_exists(sb, link):
            counters["grants_duplicate"] += 1
            continue

        combined = f"{title}\n\n{summary}"
        budget_amount = extract_budget_aud(combined)
        category = guess_category(combined)
        state = extract_state(combined)
        electorate_id, resolved_state = resolve_electorate(combined, electorates)
        if resolved_state and not state:
            state = resolved_state

        if not electorate_id and not state:
            counters["grants_no_location"] += 1
            if not dry_run:
                queue_for_review(
                    sb,
                    proposed={"source": "grants", "source_url": link, "title": title},
                    reason="Could not resolve electorate or state from grant text",
                )
            continue

        announced_at = datetime.now(tz=timezone.utc).isoformat()
        if getattr(entry, "published_parsed", None):
            import calendar
            try:
                announced_at = datetime.fromtimestamp(
                    calendar.timegm(entry.published_parsed), tz=timezone.utc
                ).isoformat()
            except Exception:
                pass

        if dry_run:
            counters["grants_would_insert"] += 1
            print(f"  ✓ (dry-run) {title[:70]}")
            continue

        if insert_announcement(
            sb,
            title=title,
            body=summary or None,
            category=category,
            state=state,
            electorate_id=electorate_id,
            member_id=None,
            budget_amount=budget_amount,
            announced_at=announced_at,
            source_url=link,
            source="grants",
        ):
            counters["grants_inserted"] += 1
            print(f"  ✓ {title[:70]}")


# ── Source 3: representative_updates scan ────────────────────────────────────
FUNDING_KEYWORDS = ["funding", "invest", "invest in", "grant", "announce", "package"]


def fetch_from_statements(sb, electorates: list[dict], counters: dict, dry_run: bool) -> None:
    print("\n→ representative_updates — funding pattern scan")
    try:
        r = (
            sb.table("representative_updates")
            .select("id, content, source, source_url, published_at, member_id")
            .not_.is_("source_url", "null")
            .order("published_at", desc=True)
            .limit(200)
            .execute()
        )
        rows = r.data or []
    except Exception as e:
        log.warning("Failed to read representative_updates: %s", e)
        return

    print(f"  Scanning {len(rows)} recent statements")

    for row in rows:
        content = (row.get("content") or "").strip()
        source_url = (row.get("source_url") or "").strip()
        if not content or not source_url:
            continue

        lower = content.lower()
        if not any(k in lower for k in FUNDING_KEYWORDS):
            continue

        budget_amount = extract_budget_aud(content)
        if not budget_amount:
            continue  # Funding-shaped post without a dollar amount — skip.

        ok, reason = verify_source_url(source_url)
        if not ok:
            counters["stmts_failed_verification"] += 1
            continue

        if not dry_run and announcement_already_exists(sb, source_url):
            counters["stmts_duplicate"] += 1
            continue

        title = content.split("\n\n", 1)[0].strip()[:250]
        if len(title) < 10:
            continue
        body = content[:4000]

        category = guess_category(content)
        state = extract_state(content)
        electorate_id, resolved_state = resolve_electorate(content, electorates)
        if resolved_state and not state:
            state = resolved_state

        if not electorate_id and not state:
            counters["stmts_no_location"] += 1
            continue

        announced_at = row.get("published_at") or datetime.now(tz=timezone.utc).isoformat()

        if dry_run:
            counters["stmts_would_insert"] += 1
            print(f"  ✓ (dry-run) {title[:70]} ${budget_amount:,}")
            continue

        if insert_announcement(
            sb,
            title=title,
            body=body,
            category=category,
            state=state,
            electorate_id=electorate_id,
            member_id=row.get("member_id"),
            budget_amount=budget_amount,
            announced_at=announced_at,
            source_url=source_url,
            source="ministerial_statement",
        ):
            counters["stmts_inserted"] += 1
            print(f"  ✓ {title[:70]}")


# ── Entry ────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Fetch + parse, do not write")
    parser.add_argument(
        "--source",
        choices=["infra", "grants", "statements", "all"],
        default="all",
        help="Limit to a single source for testing",
    )
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_KEY in .env")
    sb = create_client(url, key)

    electorates = load_electorates(sb)
    if not electorates:
        log.warning("No federal electorates loaded — electorate resolution will fail")

    counters: dict[str, int] = {
        k: 0
        for k in (
            "infra_unreachable", "infra_inserted", "infra_duplicate",
            "infra_failed_verification", "infra_unparseable", "infra_no_location",
            "infra_would_insert",
            "grants_unreachable", "grants_inserted", "grants_duplicate",
            "grants_failed_verification", "grants_no_location", "grants_would_insert",
            "stmts_inserted", "stmts_duplicate",
            "stmts_failed_verification", "stmts_no_location", "stmts_would_insert",
        )
    }

    print()
    mode = "DRY-RUN" if args.dry_run else "LIVE"
    print(f"═══════════════ INGEST FEDERAL FUNDING ({mode}) ═══════════════")
    print(f"Electorates loaded: {len(electorates)}")

    if args.source in ("infra", "all"):
        fetch_infra(sb, electorates, counters, args.dry_run)
    if args.source in ("grants", "all"):
        fetch_grants(sb, electorates, counters, args.dry_run)
    if args.source in ("statements", "all"):
        fetch_from_statements(sb, electorates, counters, args.dry_run)

    print()
    print("═══════════════ SUMMARY ═══════════════")
    for k, v in counters.items():
        if v:
            print(f"  {k:<32s}: {v}")
    print("════════════════════════════════════════")


if __name__ == "__main__":
    main()
