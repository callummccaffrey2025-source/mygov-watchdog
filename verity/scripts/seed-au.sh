#!/usr/bin/env bash
set -euo pipefail

# Safe default for TODAY_AU even under `set -u`
TODAY_AU="${TODAY_AU:-2025-09-16}"

echo "▶ Seeding AU data for Verity on $TODAY_AU…"
mkdir -p data/au/{news,mp,bills,ownership}

# News clusters
cat > "data/au/news/${TODAY_AU}.json" <<'JSON'
[
  {
    "id": "cluster-netzero-2025-09-16",
    "title": "Coalition splits over net-zero after national climate risk report",
    "time_aest": "2025-09-16T12:00:00+10:00",
    "bias_mix": {"left": 38, "center": 34, "right": 28},
    "receipts": [
      {
        "outlet": "The Australian",
        "owner": "News Corp Australia",
        "ts": "2025-09-16T08:10:00+10:00",
        "url": "https://REPLACE-WITH-ACTUAL-ARTICLE",
        "note": "Hastie prepared to quit frontbench"
      },
      {
        "outlet": "Guardian Australia (live)",
        "owner": "Guardian Media Group",
        "ts": "2025-09-16T10:30:00+10:00",
        "url": "https://REPLACE-WITH-ACTUAL-LIVE-BLOG-ENTRY",
        "note": "Climate politics updates"
      }
    ]
  },
  {
    "id": "cluster-png-2025-09-16",
    "title": "Australia gifts PNG Parliament House extension for 50th independence",
    "time_aest": "2025-09-16T09:45:00+10:00",
    "receipts": [
      {
        "outlet": "AP News",
        "owner": "The Associated Press",
        "ts": "2025-09-16T07:00:00+10:00",
        "url": "https://REPLACE-WITH-ACTUAL-AP-ARTICLE",
        "note": "Albanese attends; defence treaty context"
      }
    ]
  }
]
JSON

# MP example
cat > data/au/mp/andrew-hastie.json <<'JSON'
{
  "slug": "andrew-hastie",
  "name": "Andrew Hastie",
  "electorate": "Canning, WA",
  "party": "Liberal Party",
  "transparency_score": 0.86,
  "recent_votes": [
    {"bill": "Housing Reform Bill", "issue": "Housing", "chamber": "House", "date": "2025-08-05", "position": "For"},
    {"bill": "Climate Target Act", "issue": "Climate", "chamber": "House", "date": "2025-07-12", "position": "Against"}
  ]
}
JSON

# Bill example
cat > data/au/bills/gfl-rules-2025.json <<'JSON'
{
  "bill_id": "gfl-rules-2025",
  "title": "Federal Circuit and Family Court (Division 2) General Federal Law Rules 2025",
  "stage": "Commenced",
  "commenced_on": "2025-09-01",
  "register_url": "https://legislation.gov.au/Details/REPLACE-WITH-DETAILS-ID",
  "notes": "Practice/procedure rules; link EM; show redline vs 2024 rules."
}
JSON

# Ownership snapshot
cat > data/au/ownership/snapshot-2025-08.json <<'JSON'
[
  {"outlet": "The Australian", "parent": "News Corp Australia", "last_reviewed": "2025-08"},
  {"outlet": "The Sydney Morning Herald", "parent": "Nine Entertainment", "last_reviewed": "2025-08"},
  {"outlet": "The Age", "parent": "Nine Entertainment", "last_reviewed": "2025-08"}
]
JSON

echo "✅ Seed complete. Update the REPLACE-WITH URLs when ready."
