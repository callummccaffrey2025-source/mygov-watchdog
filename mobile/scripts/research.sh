#!/bin/bash
# Verity Research CLI — enriches the AI pipeline with public sentiment data.
#
# Usage:
#   ./scripts/research.sh story "housing affordability bill"
#   ./scripts/research.sh mp "Anthony Albanese"
#   ./scripts/research.sh brief "Australian politics today"
#   ./scripts/research.sh inject --story-id=42

set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-}"
TOPIC="${2:-}"

if [ -z "$MODE" ] || [ -z "$TOPIC" ]; then
  echo ""
  echo "  Verity Research CLI"
  echo "  ───────────────────"
  echo "  Usage:"
  echo "    ./scripts/research.sh story \"housing affordability\""
  echo "    ./scripts/research.sh mp \"Anthony Albanese\""
  echo "    ./scripts/research.sh brief \"Australian politics today\""
  echo "    ./scripts/research.sh inject --story-id=42"
  echo ""
  exit 1
fi

case "$MODE" in
  story)
    npx ts-node scripts/last30days-research.ts "$TOPIC"
    SLUG=$(echo "$TOPIC" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g' | cut -c1-60)
    echo ""
    echo "  Next steps:"
    echo "    1. Review: cat scripts/research-cache/${SLUG}-$(date +%Y-%m-%d).json"
    echo "    2. Inject: npx ts-node scripts/inject-research.ts --story-title=\"$TOPIC\""
    echo "    3. Regenerate summary: python scripts/generate_ai_summaries.py"
    echo ""
    ;;
  mp)
    npx ts-node scripts/mp-research.ts "$TOPIC"
    ;;
  brief)
    npx ts-node scripts/last30days-research.ts "$TOPIC" --for-brief
    echo ""
    echo "  Brief research cached. Will be picked up by next generate-daily-brief run."
    echo ""
    ;;
  inject)
    # TOPIC here is the --story-id=N flag
    npx ts-node scripts/inject-research.ts "$TOPIC"
    ;;
  *)
    echo "  Unknown mode: $MODE"
    echo "  Use: story | mp | brief | inject"
    exit 1
    ;;
esac
