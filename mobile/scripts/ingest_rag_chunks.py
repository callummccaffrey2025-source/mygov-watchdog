#!/usr/bin/env python3
"""
ingest_rag_chunks.py — Ingest all political data into RAG chunks for full-text search.

Pulls data from Supabase (bills, hansard, donations, contracts, interests,
policies, members), chunks it into paragraphs, and stores in the rag_chunks
table. PostgreSQL tsvector handles search indexing automatically via trigger.

No external embedding API needed — search uses PostgreSQL full-text search.

Usage:
  python scripts/ingest_rag_chunks.py                    # full ingest
  python scripts/ingest_rag_chunks.py --source bills     # single source
  python scripts/ingest_rag_chunks.py --test              # dry run, 5 per source
"""

import argparse
import logging
import os
import sys
import time
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
MAX_CHUNK_CHARS = 2000


def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """Split text into chunks at paragraph boundaries."""
    if not text or len(text) <= max_chars:
        return [text] if text else []

    paragraphs = text.split("\n\n")
    chunks = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chars and current:
            chunks.append(current.strip())
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para

    if current.strip():
        chunks.append(current.strip())

    return chunks


def ingest_bills(sb, limit: Optional[int] = None) -> int:
    """Chunk and store bills."""
    log.info("Ingesting bills...")
    query = sb.table("bills").select(
        "id, title, summary_plain, expanded_summary, current_status, "
        "sponsor, portfolio, categories, date_introduced"
    ).not_("summary_plain", "is", "null")

    if limit:
        query = query.limit(limit)

    data = query.execute().data or []
    count = 0

    for bill in data:
        text = f"Bill: {bill['title']}\n"
        if bill.get("current_status"):
            text += f"Status: {bill['current_status']}\n"
        if bill.get("sponsor"):
            text += f"Sponsor: {bill['sponsor']}\n"
        if bill.get("portfolio"):
            text += f"Portfolio: {bill['portfolio']}\n"
        if bill.get("date_introduced"):
            text += f"Introduced: {bill['date_introduced']}\n"
        text += f"\n{bill.get('summary_plain', '')}"
        if bill.get("expanded_summary"):
            text += f"\n\n{bill['expanded_summary']}"

        chunks = chunk_text(text)
        metadata = {
            "title": bill["title"],
            "status": bill.get("current_status"),
            "categories": bill.get("categories", []),
        }

        for i, chunk in enumerate(chunks):
            upsert_chunk(sb, "bill", str(bill["id"]), i, chunk, metadata)
            count += 1

    return count


def ingest_hansard(sb, limit: Optional[int] = None) -> int:
    """Chunk and store hansard speeches."""
    log.info("Ingesting hansard entries...")
    query = sb.table("hansard_entries").select(
        "id, member_id, date, debate_topic, excerpt, chamber"
    ).not_("excerpt", "is", "null")

    if limit:
        query = query.limit(limit)

    data = query.execute().data or []
    count = 0

    # Get member names for context
    members = {m["id"]: f"{m['first_name']} {m['last_name']}"
               for m in (sb.table("members").select("id, first_name, last_name").execute().data or [])}

    for entry in data:
        member_name = members.get(entry.get("member_id"), "Unknown MP")
        text = f"Parliamentary speech by {member_name}"
        if entry.get("debate_topic"):
            text += f" on '{entry['debate_topic']}'"
        text += f" ({entry.get('chamber', 'Parliament')}, {entry['date']})"
        text += f"\n\n{entry['excerpt']}"

        chunks = chunk_text(text)
        metadata = {
            "member_name": member_name,
            "member_id": entry.get("member_id"),
            "debate_topic": entry.get("debate_topic"),
            "date": entry["date"],
            "chamber": entry.get("chamber"),
        }

        for i, chunk in enumerate(chunks):
            upsert_chunk(sb, "hansard", str(entry["id"]), i, chunk, metadata)
            count += 1

    return count


def ingest_donations(sb, limit: Optional[int] = None) -> int:
    """Chunk and store donation records."""
    log.info("Ingesting donations...")
    query = sb.table("individual_donations").select(
        "id, member_id, donor_name, donor_type, amount, financial_year, recipient_name"
    )
    if limit:
        query = query.limit(limit)

    data = query.execute().data or []
    members = {m["id"]: f"{m['first_name']} {m['last_name']}"
               for m in (sb.table("members").select("id, first_name, last_name").execute().data or [])}

    count = 0
    for don in data:
        member_name = members.get(don.get("member_id"), don.get("recipient_name", "Unknown"))
        text = (
            f"Political donation: {don['donor_name']} donated ${don['amount']:,.2f} "
            f"to {member_name} in financial year {don['financial_year']}."
        )
        if don.get("donor_type"):
            text += f" Donor type: {don['donor_type']}."

        metadata = {
            "donor_name": don["donor_name"],
            "recipient": member_name,
            "amount": float(don["amount"]),
            "financial_year": don["financial_year"],
        }

        upsert_chunk(sb, "donation", str(don["id"]), 0, text, metadata)
        count += 1

    return count


def ingest_contracts(sb, limit: Optional[int] = None) -> int:
    """Chunk and store government contracts."""
    log.info("Ingesting government contracts...")
    query = sb.table("government_contracts").select(
        "id, cn_id, agency, description, value, supplier_name, "
        "procurement_method, category, start_date, end_date"
    )
    if limit:
        query = query.limit(limit)

    data = query.execute().data or []
    count = 0

    for contract in data:
        value_str = f"${contract['value']:,.2f}" if contract.get("value") else "undisclosed value"
        text = (
            f"Government contract (CN {contract.get('cn_id', 'N/A')}): "
            f"{contract.get('agency', 'Unknown agency')} awarded {value_str} "
            f"to {contract.get('supplier_name', 'unknown supplier')}."
        )
        if contract.get("description"):
            text += f" Description: {contract['description']}."
        if contract.get("procurement_method"):
            text += f" Method: {contract['procurement_method']}."
        if contract.get("start_date"):
            text += f" Period: {contract['start_date']} to {contract.get('end_date', 'ongoing')}."

        metadata = {
            "agency": contract.get("agency"),
            "supplier": contract.get("supplier_name"),
            "value": float(contract["value"]) if contract.get("value") else None,
            "cn_id": contract.get("cn_id"),
        }

        upsert_chunk(sb, "contract", str(contract["id"]), 0, text, metadata)
        count += 1

    return count


def ingest_interests(sb, limit: Optional[int] = None) -> int:
    """Chunk and store registered interests."""
    log.info("Ingesting registered interests...")
    query = sb.table("registered_interests").select(
        "id, member_id, category, description, date_registered"
    )
    if limit:
        query = query.limit(limit)

    data = query.execute().data or []
    members = {m["id"]: f"{m['first_name']} {m['last_name']}"
               for m in (sb.table("members").select("id, first_name, last_name").execute().data or [])}

    count = 0
    for interest in data:
        member_name = members.get(interest.get("member_id"), "Unknown MP")
        text = (
            f"Registered interest for {member_name}: "
            f"Category: {interest['category']}. "
            f"{interest['description']}"
        )
        if interest.get("date_registered"):
            text += f" (Registered: {interest['date_registered']})"

        metadata = {
            "member_name": member_name,
            "category": interest["category"],
        }

        upsert_chunk(sb, "interest", str(interest["id"]), 0, text, metadata)
        count += 1

    return count


def ingest_policies(sb, limit: Optional[int] = None) -> int:
    """Chunk and store party policies."""
    log.info("Ingesting party policies...")
    query = sb.table("party_policies").select(
        "id, party_id, category, summary_plain, source_url"
    )
    if limit:
        query = query.limit(limit)

    data = query.execute().data or []
    parties = {p["id"]: p["name"]
               for p in (sb.table("parties").select("id, name").execute().data or [])}

    count = 0
    for policy in data:
        party_name = parties.get(policy.get("party_id"), "Unknown party")
        text = f"{party_name} policy on {policy['category']}:\n\n{policy['summary_plain']}"

        metadata = {
            "party": party_name,
            "category": policy["category"],
        }

        upsert_chunk(sb, "policy", str(policy["id"]), 0, text, metadata)
        count += 1

    return count


def ingest_members(sb, limit: Optional[int] = None) -> int:
    """Chunk and store member profiles."""
    log.info("Ingesting member profiles...")
    query = sb.table("members").select(
        "id, first_name, last_name, chamber, ministerial_role, bio, "
        "party:parties(name), electorate:electorates(name, state)"
    ).eq("is_active", True)

    if limit:
        query = query.limit(limit)

    data = query.execute().data or []
    count = 0

    for m in data:
        name = f"{m['first_name']} {m['last_name']}"
        party = m.get("party", {}).get("name", "Independent") if m.get("party") else "Independent"
        electorate = m.get("electorate", {}).get("name", "") if m.get("electorate") else ""
        state = m.get("electorate", {}).get("state", "") if m.get("electorate") else ""

        text = f"{name}, Member for {electorate} ({state}), {party}."
        text += f" Chamber: {m.get('chamber', 'Unknown')}."
        if m.get("ministerial_role"):
            text += f" Role: {m['ministerial_role']}."
        if m.get("bio"):
            text += f"\n\n{m['bio']}"

        metadata = {
            "name": name,
            "party": party,
            "electorate": electorate,
            "state": state,
            "chamber": m.get("chamber"),
            "role": m.get("ministerial_role"),
        }

        upsert_chunk(sb, "member", str(m["id"]), 0, text, metadata)
        count += 1

    return count


def upsert_chunk(sb, source_type: str, source_id: str, chunk_index: int, content: str, metadata: dict):
    """Upsert a single chunk (without embedding — embeddings done in batch after)."""
    sb.table("rag_chunks").upsert({
        "source_type": source_type,
        "source_id": source_id,
        "chunk_index": chunk_index,
        "content": content,
        "metadata": metadata,
    }, on_conflict="source_type,source_id,chunk_index").execute()


SOURCES = {
    "bills": ingest_bills,
    "hansard": ingest_hansard,
    "donations": ingest_donations,
    "contracts": ingest_contracts,
    "interests": ingest_interests,
    "policies": ingest_policies,
    "members": ingest_members,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=list(SOURCES.keys()), help="Ingest single source")
    parser.add_argument("--test", action="store_true", help="Dry run — 5 records per source")
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    limit = 5 if args.test else None

    total_chunks = 0
    sources = {args.source: SOURCES[args.source]} if args.source else SOURCES

    for name, fn in sources.items():
        count = fn(sb, limit=limit)
        total_chunks += count
        log.info(f"  {name}: {count} chunks")

    log.info(f"\nTotal chunks created: {total_chunks}")
    log.info("PostgreSQL tsvector indexing handles search automatically via trigger.")
    log.info("Done.")


if __name__ == "__main__":
    main()
