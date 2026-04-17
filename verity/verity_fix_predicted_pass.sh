#!/usr/bin/env bash
set -euo pipefail

ok(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m!!\033[0m %s\n" "$*"; exit 1; }

[ -f package.json ] || fail "Run from project root"
[ -f src/lib/search.ts ] || fail "src/lib/search.ts not found"

ok "Patch src/lib/search.ts (BillHit.predictedPass & normalize outputs)"
node <<'NODE'
const fs = require('fs');
const p = 'src/lib/search.ts';
let s = fs.readFileSync(p, 'utf8');

// 1) Make BillHit include predictedPass?: number
if (/export\s+type\s+BillHit\s*=\s*\{[^}]*\}/s.test(s)) {
  s = s.replace(
    /export\s+type\s+BillHit\s*=\s*\{([\s\S]*?)\}/,
    (m, body) => {
      if (/predictedPass\?:\s*number/.test(body)) return m; // already has it
      // insert just before the closing brace
      const trimmed = body.trimEnd().replace(/\s*$/, '');
      const sep = trimmed && !trimmed.endsWith('\n') ? '\n' : '';
      return `export type BillHit = {${body}${sep}  predictedPass?: number\n}`;
    }
  );
}

// 2) Ensure search() maps bills to include predictedPass (default 0)
function ensureNormalize(fnName){
  const re = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  if (!re.test(s)) return;
  s = s.replace(re, (m, body) => {
    // if body already normalises, keep it
    if (/predictedPass/.test(body)) return m;
    // Try to add a post-processing normalization for "results"
    // Look for a return results; or return { bills: ... }
    if (/return\s+results\s*;/.test(body)) {
      body = body.replace(
        /return\s+results\s*;/,
        `if (results && Array.isArray(results.bills)) {
  results.bills = results.bills.map((b:any)=> ({ ...b, predictedPass: (b?.predictedPass ?? 0) }));
}
return results;`
      );
    } else if (/return\s*\{\s*bills\s*:\s*/.test(body)) {
      body = body.replace(
        /return\s*\{\s*bills\s*:\s*([^\n]+)\n/,
        (mm, arrExpr) =>
`const __bills = ${arrExpr};
return { bills: (__bills || []).map((b:any)=> ({ ...b, predictedPass: (b?.predictedPass ?? 0) })),`
      );
    }
    return `export async function ${fnName}(${(m.match(/\(([^)]*)\)/)||[])[1]||''}) {\n${body}\n}`;
  });
}
ensureNormalize('search');
ensureNormalize('demoSearch');

fs.writeFileSync(p, s);
console.log("patched:", p);
NODE

ok "Clean Next cache & build"
rm -rf .next
pnpm build

ok "Start production on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
ok "Open http://localhost:3000"
