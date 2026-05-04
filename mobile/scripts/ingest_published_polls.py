#!/usr/bin/env python3
"""
ingest_published_polls.py — Ingest Australian federal polling data from Wikipedia.

Source: "Opinion polling for the next Australian federal election" Wikipedia page.
License: CC-BY-SA. We attribute Wikipedia in the app.

Run:
  python scripts/ingest_published_polls.py              # dry-run: print parsed polls
  python scripts/ingest_published_polls.py --write      # write to Supabase
  python scripts/ingest_published_polls.py --write --aggregate  # write + compute aggregates
"""

import argparse
import json
import logging
import os
import re
import sys
from datetime import date, datetime
from typing import Any

import requests
from dotenv import load_dotenv

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase not installed. Run: pip install supabase")
    sys.exit(1)

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_PAGE = "Opinion polling for the next Australian federal election"
HEADERS = {"User-Agent": "VerityApp/1.0 (civic data aggregator; contact@verity.au)"}

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

METHODOLOGY_MAP = {
    "Newspoll": "online panel",
    "Roy Morgan": "mixed (online + phone)",
    "Resolve": "online panel",
    "Essential Research": "online panel",
    "Freshwater Strategy": "online panel",
    "YouGov": "online panel",
    "Redbridge": "online panel",
    "Ipsos": "online panel",
    "DemosAU": "online panel",
}


def strip_wiki(s: str) -> str:
    """Strip wikitext formatting, refs, templates from a string."""
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.DOTALL)
    s = re.sub(r"<ref[^/]*/?>", "", s)
    s = re.sub(r"\[\[([^|\]]*\|)?([^\]]*)\]\]", r"\2", s)
    s = re.sub(r"\{\{n/a\}\}", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"'''?", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&nbsp;", " ")
    return s.strip()


def parse_date_range(s: str) -> tuple[date | None, date | None]:
    """Parse a date range like '20–26 Apr' or '13-16 Apr' from Wikipedia row."""
    s = strip_wiki(s).replace("–", "-").replace("—", "-")

    # "DD-DD Mon YYYY" or "DD-DD Mon"
    m = re.match(r"(\d{1,2})\s*-\s*(\d{1,2})\s+(\w+)\s*(\d{4})?", s)
    if m:
        day1, day2, month, year = m.group(1), m.group(2), m.group(3), m.group(4)
        year = year or "2026"  # current cycle
        for fmt in ("%d %B %Y", "%d %b %Y"):
            try:
                d1 = datetime.strptime(f"{day1} {month} {year}", fmt).date()
                d2 = datetime.strptime(f"{day2} {month} {year}", fmt).date()
                return d1, d2
            except ValueError:
                continue

    # "DD Mon - DD Mon YYYY"
    m = re.match(r"(\d{1,2})\s+(\w+)\s*-\s*(\d{1,2})\s+(\w+)\s*(\d{4})?", s)
    if m:
        day1, mon1, day2, mon2, year = m.groups()
        year = year or "2026"
        for fmt in ("%d %B %Y", "%d %b %Y"):
            try:
                d1 = datetime.strptime(f"{day1} {mon1} {year}", fmt).date()
                d2 = datetime.strptime(f"{day2} {mon2} {year}", fmt).date()
                return d1, d2
            except ValueError:
                continue

    # Single date "DD Mon YYYY"
    m = re.match(r"(\d{1,2})\s+(\w+)\s+(\d{4})", s)
    if m:
        for fmt in ("%d %B %Y", "%d %b %Y"):
            try:
                d = datetime.strptime(s.strip(), fmt).date()
                return d, d
            except ValueError:
                continue

    return None, None


def parse_pct(s: str) -> float | None:
    """Parse a percentage value like '30%' or '30.5'."""
    s = strip_wiki(s).replace("%", "").replace(",", "").strip()
    if not s or s in ("—", "-", "?"):
        return None
    try:
        v = float(s)
        return v if 0 < v < 100 else None
    except ValueError:
        return None


def parse_sample(s: str) -> int | None:
    """Parse sample size like '1,587'."""
    s = strip_wiki(s).replace(",", "").strip()
    try:
        v = int(s)
        return v if 500 <= v <= 100000 else None
    except ValueError:
        return None


def extract_pollster(s: str) -> tuple[str, str | None]:
    """Extract pollster name and source URL from a wiki cell."""
    # Extract first URL from <ref> before stripping
    url_match = re.search(r"url\s*=\s*([^\s|}<]+)", s)
    source_url = url_match.group(1) if url_match else None

    # Remove refs FIRST (they contain | which confuses cell_value)
    name = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.DOTALL)
    name = re.sub(r"<ref[^/]*/?>", "", name)

    # Now strip formatting prefixes
    name = cell_value(name)
    name = strip_wiki(name).strip()
    name = re.sub(r"^align=\w+\s*", "", name, flags=re.IGNORECASE).strip()
    name = re.sub(r"rowspan=\S+\s*", "", name, flags=re.IGNORECASE).strip()
    name = re.sub(r'style="[^"]*"\s*', "", name, flags=re.IGNORECASE).strip()
    name = name.strip("|").strip()

    return name, source_url


def cell_value(raw: str) -> str:
    """Extract the display value from a wiki cell, stripping style/colspan prefixes."""
    # Cells often look like: 'style="..." | value' or 'colspan="2" | value' or 'align=left | value'
    if "|" in raw:
        raw = raw.split("|", 1)[-1]
    return raw.strip()


def fetch_and_parse() -> tuple[list[dict[str, Any]], str]:
    """Fetch Wikipedia page and parse the main TPP polling table."""
    params = {
        "action": "parse",
        "page": WIKI_PAGE,
        "prop": "wikitext|revid",
        "format": "json",
    }
    resp = requests.get(WIKI_API, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()["parse"]
    wikitext = data["wikitext"]["*"]
    revid = data["revid"]
    revision_url = f"https://en.wikipedia.org/w/index.php?oldid={revid}"

    # Find the main polling table (first large wikitable)
    tables = re.findall(r"\{\|[^\n]*wikitable.*?\|\}", wikitext, re.DOTALL)
    if not tables:
        log.error("No wikitables found")
        return [], revision_url

    main_table = tables[0]
    rows = main_table.split("|-")

    polls = []
    for row in rows:
        # Split row into cells on newline followed by | or !
        cells_raw = re.split(r"\n[|!]\s*", row)
        cells_raw = [c for c in cells_raw if c.strip()]

        if len(cells_raw) < 10:
            continue

        # Cell 0: date (after style prefix)
        date_text = cell_value(cells_raw[0])
        field_start, field_end = parse_date_range(date_text)
        if not field_end:
            continue

        # Cell 1: pollster (skip rowspan continuation rows)
        if "rowspan" in cells_raw[1].lower():
            # Multi-row entry — skip continuation rows
            if len(cells_raw) < 10:
                continue
        pollster_raw = cells_raw[1]
        pollster_name, source_url = extract_pollster(pollster_raw)
        if not pollster_name or len(pollster_name) < 3:
            continue

        # Cell 2: client, Cell 3: mode, Cell 4: sample
        sample = parse_sample(cell_value(cells_raw[4])) if len(cells_raw) > 4 else None
        mode_text = strip_wiki(cell_value(cells_raw[3])).lower() if len(cells_raw) > 3 else ""

        # Cells 5+: primary votes then TPP
        # Collect all percentage values with colspan awareness
        pct_cells = cells_raw[5:]
        pct_values: list[float | None] = []
        for c in pct_cells:
            colspan_match = re.search(r'colspan="?(\d+)"?', c)
            span = int(colspan_match.group(1)) if colspan_match else 1
            val = parse_pct(cell_value(c))
            for _ in range(span):
                pct_values.append(val)

        # Expected column order (after expanding colspan):
        # [0] ALP primary
        # [1] LIB primary  \
        # [2] LNP primary   } often colspan="2" or "3" for combined L/NP
        # [3] NAT primary  /
        # [4] GRN primary
        # [5] ONP primary
        # [6] IND primary
        # [7] OTH primary
        # [8] TPP ALP
        # [9] TPP LNP
        # [10] TPP ONP (sometimes)

        primary_alp = pct_values[0] if len(pct_values) > 0 else None
        primary_lnp = pct_values[1] if len(pct_values) > 1 else None  # combined L/NP (colspan)
        primary_grn = pct_values[4] if len(pct_values) > 4 else None
        primary_onp = pct_values[5] if len(pct_values) > 5 else None

        # Find TPP: scan from the end for two values summing to ~100
        tpp_alp = None
        tpp_lnp = None
        for i in range(len(pct_values) - 1, 0, -1):
            a, b = pct_values[i - 1], pct_values[i]
            if a is not None and b is not None and abs(a + b - 100) <= 2:
                tpp_alp = a
                tpp_lnp = b
                break

        if not tpp_alp or not tpp_lnp:
            continue

        if not source_url:
            source_url = f"https://en.wikipedia.org/wiki/{WIKI_PAGE.replace(' ', '_')}"

        poll = {
            "pollster": pollster_name,
            "poll_type": "federal_voting_intention",
            "scope": "federal",
            "field_start_date": field_start.isoformat(),
            "field_end_date": field_end.isoformat(),
            "publish_date": field_end.isoformat(),
            "sample_size": sample,
            "methodology": METHODOLOGY_MAP.get(pollster_name, mode_text if mode_text in ("online", "phone", "mixed") else "unknown"),
            "primary_alp": primary_alp,
            "primary_lnp": primary_lnp,
            "primary_grn": primary_grn,
            "primary_one_nation": primary_onp,
            "tpp_alp": tpp_alp,
            "tpp_lnp": tpp_lnp,
            "source_url": source_url,
            "wikipedia_revision_url": revision_url,
            "verified_by_human": False,
        }
        polls.append(poll)

    return polls, revision_url


def write_polls(polls: list[dict], dry_run: bool = True) -> int:
    if dry_run:
        log.info("DRY RUN — not writing to Supabase")
        for p in polls:
            log.info(f"  {p['pollster']:25s} {p['field_end_date']}  TPP: ALP {p['tpp_alp']}  LNP {p['tpp_lnp']}  primary ALP={p['primary_alp']} LNP={p['primary_lnp']} GRN={p['primary_grn']}  n={p['sample_size']}")
        return len(polls)

    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL and SUPABASE_KEY required for --write")
        return 0

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    written = 0
    for poll in polls:
        try:
            client.table("published_polls").upsert(
                poll, on_conflict="pollster,field_end_date,poll_type,scope"
            ).execute()
            written += 1
        except Exception as e:
            log.warning(f"Failed to upsert {poll['pollster']} {poll['field_end_date']}: {e}")
    log.info(f"Wrote {written}/{len(polls)} polls")
    return written


def compute_aggregates():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    for window in [30, 60, 90]:
        try:
            client.rpc("calculate_poll_aggregate", {
                "p_scope": "federal", "p_window_days": window,
                "p_as_of_date": date.today().isoformat(),
            }).execute()
            log.info(f"Computed {window}-day aggregate")
        except Exception as e:
            log.warning(f"Failed {window}-day aggregate: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--aggregate", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    log.info(f"Fetching Wikipedia: {WIKI_PAGE}")
    polls, revision_url = fetch_and_parse()
    log.info(f"Parsed {len(polls)} polls (revision: {revision_url})")

    if args.limit > 0:
        polls = polls[:args.limit]

    if not polls:
        log.warning("No polls parsed")
        return

    log.info("=== First 5 polls ===")
    for p in polls[:5]:
        log.info(json.dumps(p, indent=2, default=str))

    write_polls(polls, dry_run=not args.write)

    if args.aggregate and args.write:
        compute_aggregates()


if __name__ == "__main__":
    main()
