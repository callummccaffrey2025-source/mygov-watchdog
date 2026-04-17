#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
. agents/.lib.sh

: "${AIDER_MODEL:=gpt-4o-mini}"     # fast default; change if you like
: "${AIDER_BIN:=.venv/bin/aider}"   # or system aider
if ! [ -x "$AIDER_BIN" ]; then
  AIDER_BIN="$(command -v aider || true)"
fi
[ -x "$AIDER_BIN" ] || { echo "aider not found. Install: python -m pip install 'aider-chat==0.86.*'"; exit 1; }

# load OPENAI_API_KEY from env or .env.local if present (optional)
if [ -z "${OPENAI_API_KEY:-}" ] && [ -f .env.local ]; then
  export OPENAI_API_KEY="$(read_env OPENAI_API_KEY || true)"
fi

exec "$AIDER_BIN" \
  --yes \
  --no-gitignore \
  --cache-prompts \
  --weak-model "$AIDER_MODEL" \
  "$@"
