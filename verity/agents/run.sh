#!/usr/bin/env bash
set -euo pipefail
pnpm -s tsc --noEmit || true
pnpm -s next build || true
pnpm dev
