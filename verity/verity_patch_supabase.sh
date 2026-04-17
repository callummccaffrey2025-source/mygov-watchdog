#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }

[ -f package.json ] || fail "Run this in the project root."

# 1) Stub out Supabase files referenced by the build so there are no duplicate identifiers.
say "Stubbing Supabase modules and auth components"

mkdir -p src/lib src/components src/app/auth/callback

# Minimal, conflict-free browser stub
cat > src/lib/supabaseBrowser.ts <<'TS'
/**
 * Minimal stub to satisfy imports without shipping Supabase auth.
 * Returns null; callers should guard if they exist.
 */
export function getSupabaseBrowser() {
  return null as unknown as { auth?: unknown };
}
export default getSupabaseBrowser;
TS

# Minimal, conflict-free server stub
cat > src/lib/supabaseServer.ts <<'TS'
/**
 * Minimal stub to satisfy imports without shipping Supabase auth.
 * Returns null; callers should guard if they exist.
 */
export function getSupabaseServer() {
  return null as unknown as { auth?: unknown };
}
export default getSupabaseServer;
TS

# Client component that renders nothing (avoids build errors if imported)
cat > src/components/AuthClient.tsx <<'TSX'
"use client";
export default function AuthClient(){ return null; }
TSX

# Auth callback route: no-op 204 responses
cat > src/app/auth/callback/route.ts <<'TS'
export async function GET(){ return new Response(null,{ status:204 }); }
export async function POST(){ return new Response(null,{ status:204 }); }
TS

# 2) Clean build artifacts, compile for production, and restart PM2-managed services.
say "Rebuilding production bundle"
rm -rf .next
pnpm build >/dev/null

say "Restarting PM2 services (app + cron)"
pnpm dlx pm2 delete verity-app  >/dev/null 2>&1 || true
pnpm dlx pm2 delete verity-cron >/dev/null 2>&1 || true
pnpm dlx pm2 start "pnpm start -p 3000" --name verity-app --time
pnpm dlx pm2 start "node scripts/ingest.mjs" --name verity-cron --time
pnpm dlx pm2 save >/dev/null

say "Done. Verity is live at http://localhost:3000  | Health: /api/health"
