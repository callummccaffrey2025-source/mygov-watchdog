#!/bin/bash
# Quick commit + push for Verity
# Usage: ./scripts/commit.sh "your commit message"
# Example: ./scripts/commit.sh "feat: add bill lifecycle timeline"

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/commit.sh \"commit message\""
  exit 1
fi

cd "$(dirname "$0")/.."

# Type check first
echo "Running tsc..."
npx tsc --noEmit
echo "✓ TypeScript clean"

# Stage and commit
git add -A
git status --short
echo ""
echo "Committing: $1"
git commit -m "$1"

# Push
echo "Pushing to origin..."
git push origin main
echo "✓ Done"
