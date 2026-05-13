#!/usr/bin/env python3
"""
scrape_state_parliaments.py — State parliament data ingestion via APIs and data feeds.

Uses real machine-readable sources (JSON APIs, XLSX downloads) instead of
scraping JS-rendered SPAs. ScrapeGraphAI failed on all state parliament sites.

Sources:
  WA — Lotus Notes JSON endpoint (no auth, live)
  SA — Hansard Public API (no auth, live)
  TAS — XLSX mail merge download (no auth)
  QLD — Open Data API (requires registration)
  VIC — No working data source found

Writes to: state_members, state_bills tables

Run:
  python scripts/scrape_state_parliaments.py [--dry-run] [--state WA]
"""
import os
import sys
import re
import json
import logging
import tempfile

import requests
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s  %(message)s")
log = logging.getLogger(__name__)


# ── WA: Lotus Notes JSON ─────────────────────────────────────────────────────

WA_MEMBERS_URL = "https://www.parliament.wa.gov.au/parliament/memblist.nsf/WAllMembers?ReadViewEntries&outputformat=JSON"

def parse_wa_html_field(html: str) -> dict:
    """Parse the embedded HTML in WA Lotus Notes JSON entries."""
    result = {}

    # Full name: e.g. ">Hon  Klara <b>ANDRIC</b></a>  MLC"
    # or ">Mr Stuart <b>AUBREY</b></a>  MLA"
    name_match = re.search(
        r">(?:Hon|Mr|Mrs|Ms|Dr)?\s*(\w[\w\s\-]*?)\s*<b>(\w+)</b></a>\s*(ML[AC])",
        html, re.I
    )
    if name_match:
        first = name_match.group(1).strip().title()
        last = name_match.group(2).strip().title()
        result["name"] = f"{first} {last}"
        result["first_name"] = first
        result["last_name"] = last
        chamber_code = name_match.group(3).upper()
        result["chamber"] = "Legislative Assembly" if chamber_code == "MLA" else "Legislative Council"

    # Party: "Party: ALP"
    party_match = re.search(r"Party:\s*(ALP|LIB|NAT|GRN|IND|SFF|ON|LNP|ONWA)", html)
    if party_match:
        party_map = {
            "ALP": "Australian Labor Party", "LIB": "Liberal Party",
            "NAT": "Nationals WA", "GRN": "The Greens (WA)",
            "IND": "Independent", "SFF": "Shooters, Fishers and Farmers",
            "ON": "One Nation", "ONWA": "One Nation", "LNP": "Liberal National Party",
        }
        result["party"] = party_map.get(party_match.group(1), party_match.group(1))

    # Electorate: in the third <td>, inside an <a> tag
    # Pattern: profiles-2025-scarborough-2025" >Scarborough</a>
    electorate_match = re.search(r'electorate-profiles[^"]*"\s*>([^<]+)</a>', html)
    if electorate_match:
        result["electorate"] = electorate_match.group(1).strip()

    # Photo URL
    photo_match = re.search(r'src\s*=\s*"(/parliament/memblist\.nsf/[^"]+)"', html)
    if photo_match:
        result["photo_url"] = f"https://www.parliament.wa.gov.au{photo_match.group(1)}"

    # Email
    email_match = re.search(r'mailto:([^"]+)', html)
    if email_match:
        result["email"] = email_match.group(1).strip()

    # Phone
    phone_match = re.search(r"Ph:\s*([\d\s\(\)]+)", html)
    if phone_match:
        result["phone"] = phone_match.group(1).strip()

    return result


def fetch_wa_members() -> list[dict]:
    """Fetch WA parliament members from Lotus Notes JSON endpoint."""
    try:
        resp = requests.get(WA_MEMBERS_URL, timeout=30, headers={
            "User-Agent": "VerityBot/1.0 (+https://verity.run/bot)"
        })
        resp.raise_for_status()
        text = resp.text

        # Lotus Notes JSON can be malformed — try to fix common issues
        # Remove BOM if present
        if text.startswith('\ufeff'):
            text = text[1:]

        data = json.loads(text)
        entries = data.get("viewentry", [])

        members = []
        for entry in entries:
            # Each entry has entrydata with embedded HTML
            entry_data = entry.get("entrydata", [])
            if not entry_data:
                continue

            html = ""
            for ed in entry_data:
                if "text" in ed:
                    val = ed["text"]
                    if isinstance(val, dict) and "0" in val:
                        html += val["0"]
                    elif isinstance(val, str):
                        html += val

            if not html:
                continue

            parsed = parse_wa_html_field(html)
            if parsed.get("name"):
                # Determine chamber from entry position or default
                members.append(parsed)

        return members
    except Exception as e:
        log.error("WA fetch failed: %s", e)
        return []


# ── SA: Hansard Public API ────────────────────────────────────────────────────

SA_HANSARD_BASE = "https://hansardsearch.parliament.sa.gov.au"

def fetch_sa_members() -> list[dict]:
    """Fetch SA parliament members from Hansard API.

    The indices/members endpoint only has data for parliaments with hansard
    records. We try the most recent parliaments until we find one with data.
    """
    members = []

    # Find the latest parliament with hansard data
    try:
        resp = requests.get(f"{SA_HANSARD_BASE}/api/hansard/parliaments", timeout=15)
        resp.raise_for_status()
        all_parls = resp.json()
        # Sort by number descending to find the latest
        all_parls.sort(key=lambda p: p.get("number", 0), reverse=True)
    except Exception as e:
        log.error("SA parliaments list failed: %s", e)
        return []

    for parl in all_parls[:5]:  # Try the 5 most recent
        parl_num = parl["number"]
        sessions = parl.get("sessions", [])
        if not sessions:
            continue
        latest_sess = max(sessions, key=lambda s: s.get("number", 0))
        sess_num = latest_sess["number"]

        for house_code, chamber in [("lh", "House of Assembly"), ("uh", "Legislative Council")]:
            try:
                url = f"{SA_HANSARD_BASE}/api/hansard/indicies/{house_code}/{parl_num}/{sess_num}/members"
                resp = requests.get(url, timeout=10)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                if not isinstance(data, list) or len(data) < 5:
                    continue

                log.info("SA P%d/S%d/%s: %d members", parl_num, sess_num, house_code, len(data))

                for item in data:
                    name = item.get("name", "").strip()
                    if not name:
                        continue
                    # Parse "LASTNAME, Firstname" format
                    parts = name.split(",", 1)
                    if len(parts) == 2:
                        last = parts[0].strip().title()
                        first = parts[1].strip().title()
                        display_name = f"{first} {last}"
                    else:
                        display_name = name.title()
                        first, last = "", ""

                    members.append({
                        "name": display_name,
                        "first_name": first,
                        "last_name": last,
                        "chamber": chamber,
                        "party": item.get("party", ""),
                        "electorate": item.get("electorate", ""),
                    })
            except Exception:
                continue

        if members:
            break  # Found a parliament with data

    return members


# ── TAS: XLSX download ────────────────────────────────────────────────────────

TAS_LC_XLSX = "https://www.parliament.tas.gov.au/__data/assets/excel_doc/0015/94002/Mail-Merge-as-at-13-October-2025.xlsx"

def fetch_tas_members() -> list[dict]:
    """Fetch TAS Legislative Council members from XLSX download."""
    try:
        import openpyxl
    except ImportError:
        log.warning("openpyxl not installed — skipping TAS. Run: pip install openpyxl")
        return []

    try:
        resp = requests.get(TAS_LC_XLSX, timeout=30, headers={
            "User-Agent": "VerityBot/1.0 (+https://verity.run/bot)"
        })
        resp.raise_for_status()

        tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        tmp.write(resp.content)
        tmp.close()

        wb = openpyxl.load_workbook(tmp.name, read_only=True)
        ws = wb.active

        members = []
        headers = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0:
                headers = [str(c).lower().strip() if c else "" for c in row]
                continue

            row_dict = dict(zip(headers, row))
            first = str(row_dict.get("first", "") or "").strip()
            last = str(row_dict.get("last", "") or "").strip()
            if not first and not last:
                continue

            # Clean up name suffixes and electorate prefixes
            clean_name = f"{first} {last}".replace(" MLC", "").replace(" MHA", "").strip()
            electorate = str(row_dict.get("electorate", "") or "").strip()
            electorate = re.sub(r"^Member for\s+", "", electorate)

            members.append({
                "name": clean_name,
                "first_name": first.replace(" MLC", "").replace(" MHA", ""),
                "last_name": last,
                "chamber": "Legislative Council",
                "party": str(row_dict.get("party", "") or "").strip(),
                "electorate": electorate,
                "email": str(row_dict.get("email address", "") or "").strip(),
            })

        wb.close()
        os.unlink(tmp.name)
        return members
    except Exception as e:
        log.error("TAS fetch failed: %s", e)
        return []


# ── Main ──────────────────────────────────────────────────────────────────────

FETCHERS = {
    "WA": {"name": "Western Australia", "fetch": fetch_wa_members},
    "SA": {"name": "South Australia", "fetch": fetch_sa_members},
    "TAS": {"name": "Tasmania", "fetch": fetch_tas_members},
}


def main():
    dry_run = "--dry-run" in sys.argv
    target_state = None
    for i, arg in enumerate(sys.argv):
        if arg == "--state" and i + 1 < len(sys.argv):
            target_state = sys.argv[i + 1].upper()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    states_to_run = {target_state: FETCHERS[target_state]} if target_state and target_state in FETCHERS else FETCHERS

    print(f"\n═══════════════ STATE PARLIAMENT INGESTION ═══════════════")
    print(f"States: {', '.join(states_to_run.keys())}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    total_members = 0

    for state_code, state_info in states_to_run.items():
        print(f"\n{'─' * 50}")
        print(f"→ {state_info['name']} ({state_code})")

        members = state_info["fetch"]()
        print(f"  Fetched {len(members)} members")

        for member in members:
            name = member.get("name", "").strip()
            if not name:
                continue

            # Split name if not already split
            first = member.get("first_name", "")
            last = member.get("last_name", "")
            if not first and not last:
                parts = name.split(None, 1)
                first = parts[0] if parts else ""
                last = parts[1] if len(parts) > 1 else ""

            row = {
                "name": name,
                "first_name": first,
                "last_name": last,
                "state": state_code,
                "party": member.get("party", ""),
                "electorate": member.get("electorate", ""),
                "chamber": member.get("chamber", ""),
                "email": member.get("email", ""),
                "phone": member.get("phone", ""),
            }
            # Remove empty strings
            row = {k: v for k, v in row.items() if v}
            row["state"] = state_code  # always include

            if dry_run:
                if total_members < 5:
                    print(f"    [DRY] {name} ({row.get('party', '?')}) — {row.get('electorate', '?')} [{row.get('chamber', '?')}]")
                total_members += 1
            else:
                try:
                    sb.table("state_members").upsert(
                        row, on_conflict="name,state"
                    ).execute()
                    total_members += 1
                except Exception as e:
                    log.warning("Upsert failed for %s: %s", name, e)

        if len(members) > 5 and dry_run:
            print(f"    ... and {len(members) - 5} more")

    print(f"\n═══════════════ SUMMARY ═══════════════")
    print(f"  Members ingested: {total_members}")
    print(f"════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
