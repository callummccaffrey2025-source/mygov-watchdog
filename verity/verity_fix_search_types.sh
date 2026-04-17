#!/usr/bin/env bash
set -euo pipefail

say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
[ -f package.json ] || { echo "[fail] run from project root"; exit 1; }

say "Patch src/lib/search.ts to export BillHit/MPHit/ArticleHit + keep functions"
mkdir -p src/lib
node <<'NODE'
const fs = require('fs'), p='src/lib/search.ts';
if (!fs.existsSync(p)) {
  console.error("[fail] src/lib/search.ts not found");
  process.exit(1);
}
let s = fs.readFileSync(p,'utf8');

// Ensure our types exist and are exported
const typeBlock = `
export type MPHit = { id: string; name: string; party: string; electorate: string };
export type BillHit = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string | null };
export type ArticleHit = { id: string; title: string; source: string; url?: string; published: string; summary?: string };
`.trim();

if (!/export\s+type\s+MPHit\b/.test(s) || !/export\s+type\s+BillHit\b/.test(s) || !/export\s+type\s+ArticleHit\b/.test(s)) {
  // Try to place types near the top (after first import)
  if (/^import[\s\S]*?$/m.test(s)) {
    s = s.replace(/(^import[\s\S]*?\n)/, `$1\n${typeBlock}\n\n`);
  } else {
    s = `${typeBlock}\n\n${s}`;
  }
}

// Ensure search() and demoSearch() are exported (they likely are)
if (!/export\s+async\s+function\s+search\(/.test(s)) {
  s = s.replace(/async\s+function\s+search\(/, 'export async function search(');
}
if (!/export\s+async\s+function\s+demoSearch\(/.test(s)) {
  s = s.replace(/async\s+function\s+demoSearch\(/, 'export async function demoSearch(');
}

fs.writeFileSync(p,s);
console.log("patched:", p);
NODE

say "Clean Next cache & build"
rm -rf .next
pnpm build

say "Start production on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
say "Open http://localhost:3000"
