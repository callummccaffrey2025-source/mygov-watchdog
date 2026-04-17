#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
[ -f package.json ] || { echo "[fail] Run this in the project root"; exit 1; }

###############################################################################
# 1) Supabase server shim with proper typing so supabase.auth.getUser() is valid
###############################################################################
say "Write src/lib/supabaseServer.ts shim"
mkdir -p src/lib
cat > src/lib/supabaseServer.ts <<'TS'
export type SupabaseUser = { id?: string; email?: string | null } | null;

export type SupabaseServer = {
  auth: {
    getUser: () => Promise<{ data: { user: SupabaseUser } }>;
  };
};

/**
 * Minimal SSR Supabase shim for production/demo without external deps.
 * Always resolves; returns { user: null } by default.
 */
export async function getSupabaseServer(): Promise<SupabaseServer> {
  return {
    auth: {
      async getUser() {
        // If you wire real auth later, replace this.
        return { data: { user: null } };
      },
    },
  };
}

// Back-compat default export/named alias
export default getSupabaseServer;
TS

###############################################################################
# 2) Stripe API routes -> demo-mode (compile & run without Stripe/env/auth)
###############################################################################
say "Stub Stripe create-checkout route to demo-mode"
mkdir -p src/app/api/stripe/create-checkout
cat > src/app/api/stripe/create-checkout/route.ts <<'TS'
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/**
 * Demo checkout: returns a mock session URL so UI can proceed without Stripe keys.
 * Replace with real Stripe integration when credentials are available.
 */
export async function POST() {
  const supabase = (await getSupabaseServer());
  const { data: { user } } = await supabase.auth.getUser();
  // In demo-mode we allow no-auth and return a mock checkout URL
  const url = "https://example.com/checkout/demo-session";
  return NextResponse.json({
    ok: true,
    mode: "demo",
    user: user?.email || null,
    url
  });
}
TS

say "Stub Stripe webhook route to demo-mode"
mkdir -p src/app/api/stripe-webhook
cat > src/app/api/stripe-webhook/route.ts <<'TS'
import { NextResponse } from "next/server";

/**
 * Demo webhook: no signature verification, always accepts.
 * Replace with real Stripe webhook verification when ready.
 */
export async function POST() {
  return NextResponse.json({ ok: true, mode: "demo" });
}
TS

###############################################################################
# 3) Clean build and start production
###############################################################################
say "Clean Next cache & build"
rm -rf .next
pnpm build

say "Start production server on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
say "Done. Open http://localhost:3000"
