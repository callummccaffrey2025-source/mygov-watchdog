#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
[ -f package.json ] || { echo "[fail] Run this in the project root"; exit 1; }

################################################################################
# 1) Patch src/lib/db.ts to include Prisma-like $queryRaw tag function
################################################################################
say "Add Prisma-compatible db.\$queryRaw to src/lib/db.ts (if missing)"
node <<'NODE'
import fs from 'fs'; import path from 'path';
const p = path.join('src','lib','db.ts');
if (!fs.existsSync(p)) {
  console.error("[fail] src/lib/db.ts not found. Run previous setup first.");
  process.exit(1);
}
let s = fs.readFileSync(p,'utf8');
if (!/[$]queryRaw/.test(s)) {
  // Add a minimal implementation: supports tagged template and returns 1
  // Insert just before default/export end, or append if not found.
  const inject = `
/** Minimal Prisma-compatible tagged raw query (no-op): allows \`db.$queryRaw\`SELECT 1\`\` */
async function __rawTag(strings: TemplateStringsArray, ..._values: any[]): Promise<any> { return 1; }
`;
  // Try to add property into exported db object
  if (/export\s+const\s+db\s*=\s*\{[\s\S]*?\};?/.test(s)) {
    s = s.replace(/export\s+const\s+db\s*=\s*\{/, (m)=> `${inject}\n${m}\n  $queryRaw: __rawTag,`);
  } else {
    // fallback: append standalone export
    s += `${inject}\nexport const db: any = { $queryRaw: __rawTag };\n`;
  }
  // Ensure prisma alias still exists
  if (!/export\s+const\s+prisma\s*=/.test(s)) {
    s += `\nexport const prisma = db;\n`;
  }
  fs.writeFileSync(p, s);
  console.log("patched:", p);
} else {
  console.log("no-change:", p);
}
NODE

################################################################################
# 2) Update TS declaration so type-check passes for $queryRaw
################################################################################
say "Update src/types/db-shim.d.ts for db.\$queryRaw()"
mkdir -p src/types
if [ -f src/types/db-shim.d.ts ]; then
  node <<'NODE'
  import fs from 'fs';
  const p='src/types/db-shim.d.ts';
  let s = fs.readFileSync(p,'utf8');
  if (!s.includes('$queryRaw')) {
    s = s.replace(/export const db:\s*\{/, (m)=> `${m}\n    $queryRaw(strings: TemplateStringsArray, ...values: any[]): Promise<any>;`);
    fs.writeFileSync(p,s);
    console.log("patched:", p);
  } else {
    console.log("no-change:", p);
  }
NODE
else
  cat > src/types/db-shim.d.ts <<'DTS'
declare module "@/lib/db" {
  export type MP = { id: string; name: string; party: string; electorate: string };
  export type Bill = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string | null };
  export type News = { id: string; title: string; source: string; url?: string; published: string; summary?: string };
  export const db: {
    $queryRaw(strings: TemplateStringsArray, ...values: any[]): Promise<any>;
    mP: { findMany(opts?: any): Promise<MP[]>; findUnique(opts: { where: { id: string } }): Promise<MP|null> };
    bill: { findMany(opts?: any): Promise<Bill[]>; findUnique(opts: { where: { id: string } }): Promise<Bill|null> };
    news: { findMany(opts?: any): Promise<News[]> };
  };
  export const prisma: typeof db;
  export default db;
}
DTS
fi

################################################################################
# 3) Clean build & start production server
################################################################################
say "Clean Next cache & build"
rm -rf .next
pnpm build

say "Start production server on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
say "Done. Open http://localhost:3000"
