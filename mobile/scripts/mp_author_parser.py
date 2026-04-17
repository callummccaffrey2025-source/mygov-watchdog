#!/usr/bin/env python3
"""
mp_author_parser.py — Shared byline parser for Australian ministerial
media releases. Consumed by:

  - scripts/reattribute_treasury_posts.py (one-shot cleanup of
    mis-attributed official_posts rows)
  - scripts/scrape_real_media_releases.py (every new scrape, before insert)

Design principles:
  1. Parse conservatively. It's better to leave a release unattributed
     than to assign it to the wrong MP.
  2. Prefer the first byline in the release — Australian convention is
     that the lead minister signs first on joint releases.
  3. Match on first + last name together. Surname alone is ambiguous
     ("Smith" matches many MPs; "Dutton" alone is fine but the rule
     is blanket to keep the heuristic uniform).
  4. Honorifics are stripped before name capture: "The Hon", "Dr",
     "Senator", "Minister" all qualify the following name.
"""
from __future__ import annotations

import re


# Primary patterns, tried in order. First match wins.
_BYLINE_PATTERNS: list[re.Pattern] = [
    # "The Hon Jim Chalmers MP" / "The Honourable Catherine King MP"
    # Optional "Dr" after The Hon. Surname allows hyphen / apostrophe.
    re.compile(
        r"\bthe\s+hon(?:ourable)?\s+(?:dr\s+)?"
        r"(?P<first>[A-Z][a-z]+(?:\-[A-Z][a-z]+)?)\s+"
        r"(?P<last>[A-Z][a-zA-Z'\-]+)\s+MP\b",
        re.IGNORECASE,
    ),
    # "Senator the Hon Penny Wong" / "Senator the Honourable Katy Gallagher"
    re.compile(
        r"\bsenator\s+the\s+hon(?:ourable)?\s+(?:dr\s+)?"
        r"(?P<first>[A-Z][a-z]+)\s+"
        r"(?P<last>[A-Z][a-zA-Z'\-]+)\b",
        re.IGNORECASE,
    ),
    # "Senator Andrew Bragg" (non-minister senator)
    re.compile(
        r"\bsenator\s+(?:dr\s+)?"
        r"(?P<first>[A-Z][a-z]+)\s+"
        r"(?P<last>[A-Z][a-zA-Z'\-]+)\b",
        re.IGNORECASE,
    ),
    # "Dr Andrew Leigh MP" (assistant minister / backbencher with Dr)
    re.compile(
        r"\bdr\s+(?P<first>[A-Z][a-z]+)\s+(?P<last>[A-Z][a-zA-Z'\-]+)\s+MP\b",
        re.IGNORECASE,
    ),
    # Plain "Catherine King MP" — least specific, last resort
    re.compile(
        r"\b(?P<first>[A-Z][a-z]+)\s+(?P<last>[A-Z][a-zA-Z'\-]+)\s+MP\b",
    ),
]

# Words that look capitalised but aren't names.
_NAME_STOPWORDS: set[str] = {
    "The", "A", "An", "This", "That", "Our", "Your", "Their", "His", "Her",
    "Today", "Yesterday", "Tomorrow", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday", "Sunday",
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
    "Australia", "Australian", "Minister", "Treasurer", "Prime",
    "Parliament", "Government", "Federal", "State",
    "Senator", "Honourable", "Hon",
}


def extract_authors_from_content(text: str) -> list[tuple[str, str]]:
    """
    Return ordered (first_name, last_name) tuples found in the text.
    Duplicates preserved — caller can dedupe if desired. Order matches
    appearance in the source (first byline first).
    """
    if not text:
        return []
    matches: list[tuple[int, str, str]] = []  # (position, first, last)
    for pat in _BYLINE_PATTERNS:
        for m in pat.finditer(text):
            first = m.group("first").strip()
            last = m.group("last").strip()
            if not first or not last:
                continue
            if first in _NAME_STOPWORDS or last in _NAME_STOPWORDS:
                continue
            matches.append((m.start(), first, last))
    # Order by position so first byline wins
    matches.sort(key=lambda t: t[0])
    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str]] = []
    for _, first, last in matches:
        key = (first.lower(), last.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append((first, last))
    return out


def build_members_index(sb) -> dict[tuple[str, str], dict]:
    """
    Load every member (active + inactive) into a {(first_lower, last_lower): row}
    map. Historical releases reference former ministers so we must not filter
    on is_active.
    """
    try:
        resp = (
            sb.table("members")
            .select("id, first_name, last_name, is_active")
            .execute()
        )
        rows = resp.data or []
    except Exception:
        return {}
    idx: dict[tuple[str, str], dict] = {}
    for row in rows:
        fn = (row.get("first_name") or "").strip().lower()
        ln = (row.get("last_name") or "").strip().lower()
        if not fn or not ln:
            continue
        idx[(fn, ln)] = row
    return idx


def resolve_primary_author(
    text: str, members_index: dict[tuple[str, str], dict]
) -> tuple[dict | None, str | None]:
    """
    Resolve the primary author from `text`.

    Returns (matched_member_row, matched_name_string) or (None, None).
    Tries each parsed byline in order; returns the first that matches a member.
    """
    candidates = extract_authors_from_content(text)
    for first, last in candidates:
        key = (first.lower(), last.lower())
        member = members_index.get(key)
        if member:
            return member, f"{first} {last}"
    return None, None
