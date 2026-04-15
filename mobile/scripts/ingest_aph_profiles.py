#!/usr/bin/env python3
"""
ingest_aph_profiles.py — Scrape APH (Australian Parliament House) profiles to enrich
member records with:
  - aph_id (MPID for linking to APH pages)
  - ministerial_role (most recent current ministerial/shadow appointment)
  - committee_memberships (current and historical)

Usage:
  python ingest_aph_profiles.py [--test] [--member "Last Name"]

  --test           Only process first 5 matched members
  --member NAME    Only process members whose last name contains NAME

APH profile URL: https://www.aph.gov.au/Senators_and_Members/Parliamentarian?MPID={MPID}
"""

import argparse
import logging
import os
import re
import sys
import time
from datetime import date
from difflib import SequenceMatcher
from typing import Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

APH_BASE = "https://www.aph.gov.au"
APH_SEARCH = f"{APH_BASE}/Senators_and_Members/Parliamentarian_Search_Results"
APH_PROFILE = f"{APH_BASE}/Senators_and_Members/Parliamentarian"

# Titles to strip before name matching
_TITLE_RE = re.compile(
    r"\b(hon|dr|mr|ms|mrs|prof|rev|senator|the)\b[.\s]*", re.IGNORECASE
)
_SUFFIX_RE = re.compile(r"\b(mp|oam|am|ao|obe|mbe|kbe|ac|asc|apm|qc|sc|phd|obe)\b[.\s]*", re.IGNORECASE)


def strip_titles(name: str) -> str:
    name = _TITLE_RE.sub("", name)
    name = _SUFFIX_RE.sub("", name)
    return re.sub(r"\s+", " ", name).strip()


def normalise(name: str) -> str:
    return re.sub(r"[^a-z ]", "", strip_titles(name).lower()).strip()


def name_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalise(a), normalise(b)).ratio()


def parse_aph_date(s: str) -> Optional[date]:
    """Parse APH date format: d.m.yyyy or dd.mm.yyyy"""
    s = s.strip().rstrip(".")
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", s)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    return None


def fetch(session: requests.Session, url: str, params: dict = None) -> BeautifulSoup:
    for attempt in range(4):
        try:
            resp = session.get(url, params=params, timeout=25)
            if resp.status_code in (502, 503, 504):
                wait = 3 * (attempt + 1)
                log.warning("  %s on attempt %d, retrying in %ds…", resp.status_code, attempt + 1, wait)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.exceptions.ConnectionError:
            time.sleep(5)
    raise RuntimeError(f"Failed to fetch {url} after 4 attempts")


def get_all_aph_members(session: requests.Session) -> list[dict]:
    """
    Scrape APH search results for all current House and Senate members.
    Returns list of {name, mpid, role_text, chamber}
    """
    results = []

    for chamber_param, chamber_label in [("mem=1", "house"), ("sen=1", "senate")]:
        page = 1
        while True:
            url = f"{APH_SEARCH}?q=&{chamber_param}&page={page}"
            log.info("Fetching APH search: %s", url)
            soup = fetch(session, url)

            # Member items
            items = soup.select(".search-result-item, .member-item, [class*='result']")
            if not items:
                # Try alternate selectors
                items = soup.find_all("h4") or soup.find_all("li", class_=lambda c: c and "result" in c)

            found_on_page = 0
            for item in items:
                link = item.find("a", href=re.compile(r"MPID=", re.I)) if hasattr(item, "find") else None
                if not link:
                    # Try finding link in parent context
                    if hasattr(item, "find_parent"):
                        container = item.find_parent(["li", "div", "article"])
                        if container:
                            link = container.find("a", href=re.compile(r"MPID=", re.I))
                if not link:
                    continue

                href = link.get("href", "")
                mpid_match = re.search(r"MPID=([^&\s]+)", href, re.I)
                if not mpid_match:
                    continue
                mpid = mpid_match.group(1)
                name = strip_titles(link.get_text(strip=True))

                # Try to grab role text from sibling/parent p tag
                role_text = ""
                if hasattr(item, "find_next"):
                    p = item.find_next("p")
                    if p:
                        role_text = p.get_text(separator="|", strip=True)

                results.append({"name": name, "mpid": mpid, "role_text": role_text, "chamber": chamber_label})
                found_on_page += 1

            log.info("  Found %d members on page %d", found_on_page, page)

            # Check for next page
            next_link = soup.find("a", string=re.compile(r"next", re.I)) or \
                        soup.find("a", rel="next") or \
                        soup.find("a", href=re.compile(rf"page={page+1}"))
            if not next_link or found_on_page == 0:
                break
            page += 1
            time.sleep(0.3)

    log.info("Total APH members scraped: %d", len(results))
    return results


def _find_dl_section(soup: BeautifulSoup, label: str):
    """Find a <dd> whose preceding <dt> matches label (case-insensitive)."""
    for dt in soup.find_all("dt"):
        if label.lower() in dt.get_text(strip=True).lower():
            dd = dt.find_next_sibling("dd")
            return dd
    return None


def parse_committee_service(profile_soup: BeautifulSoup) -> list[dict]:
    """
    Parse the 'Committee service' section of an APH profile.
    Structure: <dl><dt>Committee service</dt><dd><ul><li>...</li></ul></dd></dl>

    Each <li> looks like:
      "House of Representatives Standing: Economics served as Chair from 1.6.2022"
      "Joint Standing: Foreign Affairs, Defence and Trade served from 4.12.2013 to 24.6.2015"
    """
    memberships = []
    dd = _find_dl_section(profile_soup, "committee service")
    if not dd:
        return memberships

    ul = dd.find("ul")
    if not ul:
        return memberships

    for li in ul.find_all("li"):
        text = li.get_text(" ", strip=True)
        # Each li may contain multiple semicolon-separated entries
        entries = [e.strip() for e in text.split(";")]
        for entry in entries:
            entry = entry.strip()
            if not entry:
                continue

            # Parse: "{type}: {name} served [as {role}] from {date} [to {date}]"
            colon_idx = entry.find(":")
            if colon_idx == -1:
                continue
            committee_type_raw = entry[:colon_idx].strip()
            rest = entry[colon_idx + 1:].strip()

            # Determine committee type
            raw_lower = committee_type_raw.lower()
            if "joint" in raw_lower:
                committee_type = "joint"
            elif "senate" in raw_lower:
                committee_type = "senate"
            else:
                committee_type = "house"

            # Split on "served"
            served_match = re.search(r"\bserved\b", rest, re.I)
            if not served_match:
                continue
            committee_name = rest[:served_match.start()].strip()
            served_text = rest[served_match.end():].strip()

            # Parse role
            role = "member"
            role_match = re.match(r"^as\s+(.+?)\s+from\b", served_text, re.I)
            if role_match:
                role = role_match.group(1).strip().lower()
                served_text = served_text[role_match.end() - 4:].strip()  # keep "from..."

            # Parse dates
            from_match = re.search(r"\bfrom\s+([\d.]+)", served_text, re.I)
            to_match = re.search(r"\bto\s+([\d.]+)", served_text, re.I)

            start_date = parse_aph_date(from_match.group(1)) if from_match else None
            end_date = parse_aph_date(to_match.group(1)) if to_match else None

            if committee_name:
                memberships.append({
                    "committee_name": committee_name.rstrip("."),
                    "committee_type": committee_type,
                    "role": role,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                })

    return memberships


def parse_current_ministerial_role(profile_soup: BeautifulSoup) -> Optional[str]:
    """
    Parse 'Ministerial appointments' section and return the current role (no end date).
    Structure: <dl><dt>Ministerial appointments</dt><dd><ul><li>...</li></ul></dd></dl>

    Format: "Minister for X from d.m.yyyy." (trailing period = still current)
             "Minister for X from d.m.yyyy to d.m.yyyy." (historical)
    """
    dd = _find_dl_section(profile_soup, "ministerial appointment")
    if not dd:
        return None

    ul = dd.find("ul")
    if not ul:
        return None

    current_roles = []
    for li in ul.find_all("li"):
        text = li.get_text(" ", strip=True).rstrip(".")
        # Has "to" date → historical
        if re.search(r"\bto\s+\d{1,2}\.\d{1,2}\.\d{4}", text, re.I):
            continue
        # Has "from" date but no "to" → current
        from_match = re.search(r"\bfrom\s+\d{1,2}\.\d{1,2}\.\d{4}", text, re.I)
        if from_match:
            role = text[:from_match.start()].strip().rstrip(".")
            if role and "Cabinet Minister" not in role:
                current_roles.append((from_match.start(), role))

    if not current_roles:
        return None

    # Return the most specific current role (longest from_match.start() = most recent)
    current_roles.sort(key=lambda x: -x[0])
    return current_roles[0][1]


def parse_current_shadow_role(profile_soup: BeautifulSoup) -> Optional[str]:
    """
    Parse 'Parliamentary party positions' section for current shadow minister roles.
    Uses the same date-based logic as parse_current_ministerial_role.
    Filters out generic "Served: date to present" party membership entries.
    """
    dd = _find_dl_section(profile_soup, "parliamentary party positions")
    if not dd:
        return None
    text = dd.get_text(" ", strip=True)
    if not text:
        return None

    current_roles = []
    # Split on sentence boundaries to get individual role entries
    entries = re.split(r"\.\s+(?=[A-Z])", text)
    for entry in entries:
        entry = entry.strip().rstrip(".")
        # Skip generic party membership lines ("Liberal Party of Australia. Served: ...")
        if re.match(r"^(Liberal|Labor|Australian Labor|Nationals|Greens|LNP|Independent)", entry, re.I):
            continue
        if re.match(r"^Served\b", entry, re.I):
            continue
        # Must contain "from" and a date, but no "to" date → current
        if re.search(r"\bto\s+\d{1,2}\.\d{1,2}\.\d{4}", entry, re.I):
            continue  # historical
        from_match = re.search(r"\bfrom\s+(\d{1,2}\.\d{1,2}\.\d{4})", entry, re.I)
        if from_match:
            role = entry[:from_match.start()].strip().rstrip(".")
            if role and "Cabinet Minister" not in role:
                current_roles.append((from_match.start(), role))

    if not current_roles:
        return None
    # Most recent (latest start position in text = most recently added)
    current_roles.sort(key=lambda x: -x[0])
    return current_roles[0][1]


def parse_clean_position(profile_soup: BeautifulSoup) -> Optional[str]:
    """
    Parse the top-level 'Positions' dl entry for clean non-generic role titles.
    Returns titles like 'Leader of the Nationals', 'Speaker', 'Government Whip'.
    Rejects party membership text ('Australian Labor Party. Served: ...').
    """
    dd = _find_dl_section(profile_soup, "Positions")
    if not dd:
        return None
    text = dd.get_text(" ", strip=True).strip()
    if not text:
        return None
    # Reject if it starts with a party name or 'Served:'
    if re.match(r"^(Liberal|Labor|Australian Labor|Nationals|Greens|LNP|Independent|Served)\b", text, re.I):
        return None
    # Reject generic parliamentary position labels
    if re.match(r"^(member for|senator for|senator|mp)\b", text, re.I):
        return None
    return text


def scrape_profile(session: requests.Session, mpid: str) -> dict:
    """Fetch and parse one APH profile page."""
    soup = fetch(session, APH_PROFILE, params={"MPID": mpid})
    committees = parse_committee_service(soup)
    # Priority: government ministerial role → shadow role → clean position title
    ministerial_role = (
        parse_current_ministerial_role(soup)
        or parse_current_shadow_role(soup)
        or parse_clean_position(soup)
    )
    return {"committees": committees, "ministerial_role": ministerial_role}


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest APH profile data")
    parser.add_argument("--test", action="store_true", help="Only process first 5 members")
    parser.add_argument("--member", default=None, help="Filter by last name substring")
    args = parser.parse_args()

    from supabase import create_client
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")
        sys.exit(1)
    db = create_client(url, key)

    # Load our members
    members = db.table("members").select("id,first_name,last_name,chamber").execute().data or []
    log.info("Loaded %d members from Supabase", len(members))

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; Verity/1.0; research)",
        "Accept": "text/html,application/xhtml+xml",
    })

    # Step 1: Scrape APH search to get MPID for each member
    aph_members = get_all_aph_members(session)

    # Step 2: Bijective matching — each MPID assigned to at most one DB member.
    # Build (score, our_member, aph_member) for all pairs, then greedily assign
    # highest-score pairs first, ensuring no MPID or member_id is used twice.
    all_scores: list[tuple[float, dict, dict]] = []
    for our_m in members:
        if args.member and args.member.lower() not in our_m["last_name"].lower():
            continue
        our_name = f"{our_m['first_name']} {our_m['last_name']}"
        for aph_m in aph_members:
            if aph_m["chamber"] != our_m.get("chamber", "house"):
                continue
            score = name_similarity(our_name, aph_m["name"])
            if score >= 0.72:
                all_scores.append((score, our_m, aph_m))

    all_scores.sort(key=lambda x: -x[0])
    used_mpids: set[str] = set()
    used_member_ids: set[str] = set()
    matched_pairs: list[tuple[dict, str]] = []
    for score, our_m, aph_m in all_scores:
        if our_m["id"] in used_member_ids or aph_m["mpid"] in used_mpids:
            continue
        matched_pairs.append((our_m, aph_m["mpid"]))
        used_member_ids.add(our_m["id"])
        used_mpids.add(aph_m["mpid"])

    log.info("Matched %d/%d members to APH profiles", len(matched_pairs), len(members))

    if args.test:
        matched_pairs = matched_pairs[:5]

    # Step 3: For each matched member, scrape their profile
    committee_rows = []
    aph_id_updates: list[tuple[str, str, Optional[str]]] = []  # (member_id, aph_id, ministerial_role)

    for i, (our_m, mpid) in enumerate(matched_pairs):
        log.info("[%d/%d] Scraping %s %s (MPID=%s)…",
                 i + 1, len(matched_pairs), our_m["first_name"], our_m["last_name"], mpid)
        try:
            profile = scrape_profile(session, mpid)
        except Exception as e:
            log.warning("  Failed: %s", e)
            continue

        aph_id_updates.append((our_m["id"], mpid, profile["ministerial_role"]))

        for c in profile["committees"]:
            committee_rows.append({
                "member_id": our_m["id"],
                **c,
            })

        log.info("  → %d committees, role: %s",
                 len(profile["committees"]), profile["ministerial_role"] or "none")
        time.sleep(0.4)

    # Step 4: Save aph_id + ministerial_role to members table
    log.info("Saving APH IDs and ministerial roles…")
    for member_id, aph_id, ministerial_role in aph_id_updates:
        try:
            db.table("members").update({
                "aph_id": aph_id,
                "ministerial_role": ministerial_role,
            }).eq("id", member_id).execute()
        except Exception as e:
            log.warning("  Could not update member %s (aph_id=%s): %s", member_id, aph_id, e)

    # Step 5: Save committee memberships (truncate first for idempotency)
    if not args.test and not args.member:
        log.info("Truncating committee_memberships…")
        db.table("committee_memberships").delete().gte("created_at", "2000-01-01").execute()

    log.info("Inserting %d committee membership records…", len(committee_rows))
    BATCH = 200
    inserted = 0
    for i in range(0, len(committee_rows), BATCH):
        batch = committee_rows[i:i + BATCH]
        try:
            db.table("committee_memberships").insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            log.error("Insert error at batch %d: %s", i, e)

    log.info("Done. %d members updated, %d committee rows inserted.", len(aph_id_updates), inserted)

    # Summary of ministerial roles found
    roles = [(m, r) for m, _, r in aph_id_updates if r]
    if roles:
        log.info("\nCurrent ministerial roles found (%d):", len(roles))
        for mid, role in roles:
            m = next((x for x in members if x["id"] == mid), None)
            if m:
                log.info("  %s %s: %s", m["first_name"], m["last_name"], role)


if __name__ == "__main__":
    main()
