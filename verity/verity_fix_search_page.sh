#!/usr/bin/env bash
set -euo pipefail

say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
[ -f package.json ] || { echo "[fail] Run from project root"; exit 1; }

FILE="src/app/search/page.tsx"
[ -f "$FILE" ] || { echo "[fail] $FILE not found"; exit 1; }

say "Patch $FILE to use search(q) and correct imports"
node <<'NODE'
const fs = require('fs');
const p = 'src/app/search/page.tsx';
let s = fs.readFileSync(p, 'utf8');

// 1) Replace import of demoSearch with search, retain types
s = s.replace(
  /import\s*\{\s*demoSearch\s*,\s*type\s+BillHit\s*,\s*type\s+MPHit\s*,\s*type\s+ArticleHit\s*\}\s*from\s*["']@\/lib\/search["'];?/,
  'import { search, type BillHit, type MPHit, type ArticleHit } from "@/lib/search";'
);

// Fallback: if there was no types list, just swap demoSearch->search in import
s = s.replace(
  /import\s*\{\s*demoSearch\s*\}\s*from\s*["']@\/lib\/search["'];?/,
  'import { search } from "@/lib/search";'
);

// 2) Replace call to demoSearch(q) with await search(q)
s = s.replace(/(\bconst\s+results\s*=\s*)demoSearch\s*\(\s*q\s*\)\s*;/, '$1await search(q);');

// 3) If it was calling demoSearch() with no args, keep behavior but use search("")
s = s.replace(/(\bconst\s+results\s*=\s*)demoSearch\s*\(\s*\)\s*;/, '$1await search(q || "");');

// Ensure "await" is present; if not matched earlier, force a sensible default:
if (!/await\s+search\(/.test(s) && /search\(/.test(s)) {
  s = s.replace(/(\bconst\s+results\s*=\s*)search\s*\(/, '$1await search(');
}

// 4) Make sure the page function is async (it already is in your file, but belt & braces)
s = s.replace(/export\s+default\s+function\s+Page\s*\(/, 'export default async function Page(');

// Write back
fs.writeFileSync(p, s);
console.log("patched:", p);
NODE

say "Clean Next cache & build"
rm -rf .next
pnpm build

say "Start production server on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
say "Open http://localhost:3000"
