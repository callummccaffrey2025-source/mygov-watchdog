#!/usr/bin/env bash
set -euo pipefail

echo "== Node & PNPM =="
want_node="v20.19.4"
have_node="$(node -v || true)"
have_pnpm="$(pnpm -v || true)"
echo "Node: $have_node  (want $want_node)"
echo "pnpm: $have_pnpm"

if [ "$have_node" != "$want_node" ]; then
  echo "WARN: Node mismatch. Write '$want_node' to .nvmrc and use nvm to switch."
fi

echo "== Ensure next binary =="
if ! command -v next >/dev/null 2>&1; then
  echo "next not on PATH; verifying local install"
  if ! [ -d node_modules ]; then pnpm install; fi
  npx next --version >/dev/null || { echo "Installing next"; pnpm add -D next@15.5.4; }
fi

echo "== Required ENVs (non-secrets ok as placeholders) =="
req=(NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE POSTMARK_TOKEN EMAIL_FROM)
missing=0
for k in "${req[@]}"; do
  if [ -z "${!k:-}" ]; then echo "MISSING: $k"; missing=1; fi
done
if [ $missing -eq 1 ]; then
  echo "Populate .env.local from .env.example and 'source .env.local.sync.sh'"; exit 1;
fi

echo "== Supabase ping via supabase-js =="
node - <<'NODE'
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) { console.error("Supabase ENVs missing"); process.exit(1); }
const s = createClient(url, key, { auth: { persistSession: false }});
const start = Date.now();
s.from('ingest_events').select('count', { count: 'exact', head: true })
 .then(() => console.log(JSON.stringify({ ok:true, ms: Date.now()-start })))
 .catch(e => { console.error(e.message); process.exit(1); });
NODE
echo "== Done =="
