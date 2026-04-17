#!/usr/bin/env bash
set -euo pipefail
url="${1:-http://localhost:3000/api/ask}"
body='{"q":"what does the latest bill do?"}'
curl -sS -H 'content-type: application/json' -d "$body" "$url" | jq -r '.answer' 2>/dev/null || true
