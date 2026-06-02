#!/usr/bin/env python3
"""
Verity Receipt Generator — branded vote cards for social media.

Generates 1080×1350 (4:5 Instagram) receipt images showing how an MP voted on
a specific division. Outputs to receipts/ directory.

Usage:
  python scripts/generate_receipts.py                    # latest week, all notable divisions
  python scripts/generate_receipts.py --member "Laxale"  # specific MP
  python scripts/generate_receipts.py --days 7           # last N days
  python scripts/generate_receipts.py --division-id 10178  # specific division
  python scripts/generate_receipts.py --top 10           # top N most notable

Requires: pip install Pillow requests supabase
"""

import argparse
import io
import os
import sys
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont
import requests

# ── Supabase connection ──────────────────────────────────────────────────────

sys.path.insert(0, os.path.dirname(__file__))
from supabase import create_client

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "https://zmmglikiryuftqmoprqm.supabase.co")
SUPABASE_KEY = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")

# Try to load from .env if not set
if not SUPABASE_KEY:
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        for line in open(env_path):
            if line.startswith('EXPO_PUBLIC_SUPABASE_ANON_KEY='):
                SUPABASE_KEY = line.split('=', 1)[1].strip().strip('"').strip("'")

if not SUPABASE_KEY:
    print("ERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY not set")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Card design constants ────────────────────────────────────────────────────

W, H = 1080, 1350  # 4:5 Instagram
GREEN = (0, 132, 61)       # #00843D
DARK = (26, 35, 50)        # #1a2332
WHITE = (255, 255, 255)
GREY = (154, 171, 184)     # #9aabb8
LIGHT_BG = (248, 249, 250) # #F8F9FA
AYE_GREEN = (0, 132, 61)
AYE_BG = (232, 245, 238)
NO_RED = (220, 53, 69)     # #DC3545
NO_BG = (253, 236, 234)

OUTPUT_DIR = Path(__file__).parent.parent / "receipts"
PHOTO_CACHE = Path(__file__).parent / ".photo_cache"

# Fonts
def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    if bold:
        paths = [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
    else:
        paths = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

FONT_HERO = load_font(72, bold=True)
FONT_TITLE = load_font(36, bold=True)
FONT_SUBTITLE = load_font(28, bold=True)
FONT_BODY = load_font(26)
FONT_BODY_BOLD = load_font(26, bold=True)
FONT_SMALL = load_font(22)
FONT_SMALL_BOLD = load_font(22, bold=True)
FONT_TINY = load_font(18)
FONT_TINY_BOLD = load_font(18, bold=True)
FONT_LOGO = load_font(32, bold=True)
FONT_LOGO_V = load_font(42, bold=True)

# ── Helper functions ─────────────────────────────────────────────────────────

def hex_to_rgb(h: str) -> tuple:
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def fetch_photo(url: str) -> Optional[Image.Image]:
    """Download and cache MP photo, return as circular PIL Image."""
    if not url or url == 'NA':
        return None
    PHOTO_CACHE.mkdir(exist_ok=True)
    cache_key = hashlib.md5(url.encode()).hexdigest() + ".png"
    cache_path = PHOTO_CACHE / cache_key

    if cache_path.exists():
        return Image.open(cache_path).convert("RGBA")

    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return None
        img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
        # Make circular
        size = min(img.size)
        img = img.crop(((img.width - size) // 2, (img.height - size) // 2,
                        (img.width + size) // 2, (img.height + size) // 2))
        img = img.resize((200, 200), Image.LANCZOS)

        # Circular mask
        mask = Image.new("L", (200, 200), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 199, 199), fill=255)
        img.putalpha(mask)

        img.save(cache_path)
        return img
    except Exception:
        return None

def wrap_text(draw: ImageDraw.Draw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Word-wrap text to fit within max_width."""
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines

def clean_division_name(name: str) -> str:
    """Strip procedural prefixes from division names."""
    prefixes = [
        "Bills — ", "Bills — ", "Bills - ",
        "Motions — ", "Motions - ",
        "Documents — ", "Documents - ",
    ]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
    # Strip "Limitation of Debate - " suffix stuff
    if " - Limitation of Debate" in name:
        name = name.split(" - Limitation of Debate")[0]
    # Strip "; Second Reading" etc for cleaner display
    for suffix in ["; Second Reading", "; Third Reading", "; Consideration in Detail",
                   "; Consideration of Senate Message"]:
        name = name.replace(suffix, "")
    return name.strip()

def format_date(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.strftime("%-d %B %Y")

# ── Card renderer ────────────────────────────────────────────────────────────

def render_receipt(
    mp_name: str,
    party_name: str,
    party_colour: str,
    electorate: str,
    division_name: str,
    vote_cast: str,
    date: str,
    aye_votes: int,
    no_votes: int,
    issue_name: Optional[str],
    photo: Optional[Image.Image],
) -> Image.Image:
    """Render a single Receipt card."""
    img = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)
    pc = hex_to_rgb(party_colour) if party_colour else GREY

    # ── Green header bar ─────────────────────────────────────────────────
    draw.rectangle([(0, 0), (W, 120)], fill=GREEN)

    # Logo
    draw.text((40, 32), "V", font=FONT_LOGO_V, fill=WHITE)
    draw.text((82, 42), "VERITY", font=FONT_SMALL_BOLD, fill=WHITE)

    # "THE RECEIPT" label
    draw.text((W - 40, 46), "THE RECEIPT", font=FONT_SMALL_BOLD, fill=(255, 255, 255, 200), anchor="ra")

    # ── MP identity section ──────────────────────────────────────────────
    y = 160

    # Photo
    photo_x = 60
    if photo:
        # Draw party-colour ring behind the photo
        draw.ellipse(
            (photo_x - 6, y - 6, photo_x + 206, y + 206),
            fill=pc
        )
        draw.ellipse(
            (photo_x - 2, y - 2, photo_x + 202, y + 202),
            fill=WHITE
        )
        img.paste(photo, (photo_x, y), photo)
    else:
        # Initials circle
        draw.ellipse((photo_x, y, photo_x + 200, y + 200), fill=(*pc, 50), outline=pc, width=4)
        initials = "".join(w[0] for w in mp_name.split()[:2])
        draw.text((photo_x + 100, y + 100), initials, font=FONT_TITLE, fill=pc, anchor="mm")

    # Name + party + electorate
    text_x = 300
    draw.text((text_x, y + 20), mp_name, font=FONT_TITLE, fill=DARK)

    # Party badge
    badge_text = party_name
    bbox = draw.textbbox((0, 0), badge_text, font=FONT_SMALL)
    badge_w = bbox[2] - bbox[0] + 24
    badge_h = bbox[3] - bbox[1] + 16
    badge_y = y + 75
    # Use a lighter tint that contrasts with the text
    badge_bg = tuple(min(255, c + 180) for c in pc)  # lighten the party colour
    draw.rounded_rectangle(
        [(text_x, badge_y), (text_x + badge_w, badge_y + badge_h)],
        radius=8, fill=badge_bg
    )
    draw.text((text_x + 12, badge_y + 6), badge_text, font=FONT_SMALL, fill=pc)

    # Electorate
    draw.text((text_x, badge_y + badge_h + 16), electorate, font=FONT_SMALL, fill=GREY)

    # ── "YOUR MP VOTED" label ────────────────────────────────────────────
    y = 420
    draw.text((60, y), "YOUR MP VOTED", font=FONT_SMALL_BOLD, fill=GREY)

    # ── Big vote badge ───────────────────────────────────────────────────
    y = 480
    is_aye = vote_cast.lower() == "aye"
    vote_label = "FOR" if is_aye else "AGAINST"
    vote_color = AYE_GREEN if is_aye else NO_RED
    vote_bg = AYE_BG if is_aye else NO_BG

    badge_rect = [(W // 2 - 220, y), (W // 2 + 220, y + 120)]
    draw.rounded_rectangle(badge_rect, radius=24, fill=vote_bg)
    draw.text((W // 2, y + 60), vote_label, font=FONT_HERO, fill=vote_color, anchor="mm")

    # ── Division name box ────────────────────────────────────────────────
    y = 640
    clean_name = clean_division_name(division_name)

    # Issue tag
    if issue_name:
        tag_text = issue_name.upper()
        tag_bbox = draw.textbbox((0, 0), tag_text, font=FONT_TINY_BOLD)
        tag_w = tag_bbox[2] - tag_bbox[0] + 24
        tag_h = tag_bbox[3] - tag_bbox[1] + 16
        draw.rounded_rectangle(
            [(60, y), (60 + tag_w, y + tag_h)],
            radius=6, fill=(232, 245, 238)  # light green bg
        )
        draw.text((72, y + 6), tag_text, font=FONT_TINY_BOLD, fill=AYE_GREEN)
        y += tag_h + 12

    # Bill name in grey box
    box_top = y
    name_lines = wrap_text(draw, clean_name, FONT_BODY_BOLD, W - 160)
    box_h = max(len(name_lines) * 38 + 40, 100)
    draw.rounded_rectangle(
        [(60, box_top), (W - 60, box_top + box_h)],
        radius=16, fill=LIGHT_BG
    )
    for i, line in enumerate(name_lines[:4]):
        draw.text((84, box_top + 20 + i * 38), line, font=FONT_BODY_BOLD, fill=DARK)

    y = box_top + box_h + 24

    # ── Date ─────────────────────────────────────────────────────────────
    draw.text((W // 2, y), format_date(date), font=FONT_SMALL, fill=GREY, anchor="mt")
    y += 40

    # ── Vote tally bar ───────────────────────────────────────────────────
    y += 20
    total = aye_votes + no_votes
    if total > 0:
        draw.text((60, y), "HOW PARLIAMENT VOTED", font=FONT_TINY_BOLD, fill=GREY)
        y += 36

        bar_w = W - 120
        bar_h = 20
        aye_w = int(bar_w * aye_votes / total)

        draw.rounded_rectangle([(60, y), (60 + bar_w, y + bar_h)], radius=10, fill=(*NO_RED, 40))
        if aye_w > 0:
            draw.rounded_rectangle([(60, y), (60 + aye_w, y + bar_h)], radius=10, fill=AYE_GREEN)

        y += bar_h + 12
        draw.text((60, y), f"Aye {aye_votes}", font=FONT_TINY_BOLD, fill=AYE_GREEN)
        draw.text((W - 60, y), f"No {no_votes}", font=FONT_TINY_BOLD, fill=NO_RED, anchor="ra")

    # ── Green footer ─────────────────────────────────────────────────────
    footer_h = 120
    footer_y = H - footer_h
    draw.rectangle([(0, footer_y), (W, H)], fill=GREEN)
    draw.text((40, footer_y + 24), "Every vote recorded. Every MP accountable.", font=FONT_SMALL, fill=(255, 255, 255, 220))
    draw.text((40, footer_y + 60), "verity.run", font=FONT_SUBTITLE, fill=WHITE)

    # Source attribution
    draw.text((W - 40, footer_y + 68), "Source: TheyVoteForYou", font=FONT_TINY, fill=(255, 255, 255, 160), anchor="ra")

    return img

# ── Data fetching ────────────────────────────────────────────────────────────

def fetch_receipts(days: int = 7, member_name: Optional[str] = None,
                   division_id: Optional[str] = None, top_n: int = 20) -> list[dict]:
    """Fetch notable division votes for receipt generation."""

    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    # Get substantive divisions (skip procedural)
    query = sb.table("divisions").select(
        "id, name, date, chamber, aye_votes, no_votes"
    ).gte("date", cutoff).order("date", desc=True)

    if division_id:
        query = sb.table("divisions").select(
            "id, name, date, chamber, aye_votes, no_votes"
        ).eq("id", division_id)

    divisions = query.execute().data or []

    # Filter out purely procedural votes — keep substantive bills
    substantive = []
    for d in divisions:
        name = d["name"]
        if any(skip in name for skip in [
            "Limitation of Debate", "Adjournment",
            "Procedural", "Leave of Absence",
            "Business — Consideration of Legislation",
            "Business — Rearrangement",
        ]):
            continue
        substantive.append(d)

    if not substantive:
        print("No substantive divisions found in the date range.")
        return []

    # Resolve member ID upfront if filtering by name
    target_member_id = None
    if member_name:
        member_resp = sb.table("members").select("id").ilike(
            "last_name", f"%{member_name}%"
        ).eq("is_active", True).limit(1).execute()
        if member_resp.data:
            target_member_id = member_resp.data[0]["id"]
        else:
            print(f"Member '{member_name}' not found.")
            return []

    results = []
    for div in substantive[:top_n * 3]:  # fetch more, filter down
        if len(results) >= top_n:
            break

        # Get votes for this division
        vote_query = sb.table("division_votes").select(
            "vote_cast, member_id"
        ).eq("division_id", div["id"])

        if target_member_id:
            vote_query = vote_query.eq("member_id", target_member_id)

        votes = vote_query.limit(1).execute().data or []
        if not votes:
            continue

        for vote in votes:
            if not vote.get("member_id"):
                continue
            # Get member details
            member = sb.table("members").select(
                "id, first_name, last_name, photo_url, party_id, "
                "party:parties!members_party_id_fkey(name, short_name, colour), "
                "electorate:electorates!members_electorate_id_fkey(name)"
            ).eq("id", vote["member_id"]).single().execute().data

            if not member:
                continue

            party = member.get("party") or {}
            if isinstance(party, list):
                party = party[0] if party else {}
            electorate = member.get("electorate") or {}
            if isinstance(electorate, list):
                electorate = electorate[0] if electorate else {}

            # Get issue tag if available
            tag_resp = sb.table("division_issue_tags").select(
                "policy_issues(name)"
            ).eq("division_id", div["id"]).gte("confidence", 0.6).limit(1).execute()

            issue_name = None
            if tag_resp.data:
                pi = tag_resp.data[0].get("policy_issues") or {}
                if isinstance(pi, list):
                    pi = pi[0] if pi else {}
                issue_name = pi.get("name")

            results.append({
                "mp_name": f"{member['first_name']} {member['last_name']}",
                "party_name": party.get("short_name") or party.get("name") or "Independent",
                "party_colour": party.get("colour") or "#6B7280",
                "electorate": electorate.get("name") or "",
                "division_name": div["name"],
                "vote_cast": vote["vote_cast"],
                "date": div["date"],
                "aye_votes": div["aye_votes"] or 0,
                "no_votes": div["no_votes"] or 0,
                "issue_name": issue_name,
                "photo_url": member.get("photo_url"),
                "division_id": div["id"],
                "member_id": member["id"],
            })

    return results

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate Verity Receipt cards")
    parser.add_argument("--member", help="Filter by MP last name")
    parser.add_argument("--days", type=int, default=7, help="Look back N days (default 7)")
    parser.add_argument("--division-id", help="Specific division ID")
    parser.add_argument("--top", type=int, default=20, help="Max receipts to generate")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(exist_ok=True)

    print(f"Fetching votes (last {args.days} days)...")
    receipts = fetch_receipts(
        days=args.days,
        member_name=args.member,
        division_id=args.division_id,
        top_n=args.top,
    )

    if not receipts:
        print("No receipts to generate.")
        return

    print(f"Generating {len(receipts)} receipt(s)...")

    for i, r in enumerate(receipts):
        photo = fetch_photo(r["photo_url"])

        img = render_receipt(
            mp_name=r["mp_name"],
            party_name=r["party_name"],
            party_colour=r["party_colour"],
            electorate=r["electorate"],
            division_name=r["division_name"],
            vote_cast=r["vote_cast"],
            date=r["date"],
            aye_votes=r["aye_votes"],
            no_votes=r["no_votes"],
            issue_name=r["issue_name"],
            photo=photo,
        )

        # Filename: date_mpname_divisionid.png
        safe_name = r["mp_name"].replace(" ", "_").lower()
        filename = f"{r['date']}_{safe_name}_{r['division_id']}.png"
        path = OUTPUT_DIR / filename
        img.save(path, "PNG", optimize=True)

        vote_label = "FOR" if r["vote_cast"] == "aye" else "AGAINST"
        print(f"  [{i+1}/{len(receipts)}] {r['mp_name']} voted {vote_label}: {clean_division_name(r['division_name'])[:60]}...")

    print(f"\nDone. {len(receipts)} receipts saved to {OUTPUT_DIR}/")

if __name__ == "__main__":
    main()
