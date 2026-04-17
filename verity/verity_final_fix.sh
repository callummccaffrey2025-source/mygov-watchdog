#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }

[ -f package.json ] || fail "Run this in the project root."

###############################################################################
# 1) Ensure src/lib/search.ts exists (source of truth for /api/ask)
###############################################################################
say "Ensure src/lib/search.ts"
mkdir -p src/lib
cat > src/lib/search.ts <<'TS'
import { db } from "./db";

export async function search(q:string){
  const term = (q||"").trim();
  if(!term) return { mps:[], bills:[], news:[] };
  const [mps,bills,news] = await Promise.all([
    db.mP.findMany({ where:{ OR:[
      { name:{ contains:term, mode:"insensitive" } },
      { electorate:{ contains:term, mode:"insensitive" } },
      { party:{ contains:term, mode:"insensitive" } },
    ]}, take:10 }),
    db.bill.findMany({ where:{ OR:[
      { title:{ contains:term, mode:"insensitive" } },
      { summary:{ contains:term, mode:"insensitive" } },
    ]}, orderBy:{ introduced:"desc" }, take:10 }),
    db.news.findMany({ where:{ OR:[
      { title:{ contains:term, mode:"insensitive" } },
      { source:{ contains:term, mode:"insensitive" } },
    ]}, orderBy:{ published:"desc" }, take:10 }),
  ]);
  return { mps,bills,news };
}

export async function demoSearch(){
  const [mps,bills,news] = await Promise.all([
    db.mP.findMany({ take:3, orderBy:{ name:"asc" } }),
    db.bill.findMany({ take:3, orderBy:{ introduced:"desc" } }),
    db.news.findMany({ take:6, orderBy:{ published:"desc" } }),
  ]);
  return { mps,bills,news };
}
TS

###############################################################################
# 2) Patch /api/ask to use a RELATIVE import (sidesteps any alias/type resolution)
###############################################################################
say "Patch src/app/api/ask/route.ts to import search via relative path"
ASK_FILE="src/app/api/ask/route.ts"
if [ -f "$ASK_FILE" ]; then
  # Replace only the specific import line; keep everything else intact
  node <<'NODE'
  import fs from 'fs';
  const p = 'src/app/api/ask/route.ts';
  let s = fs.readFileSync(p,'utf8');
  // Replace any "@/lib/search" or "@\\lib\\search" with a relative import
  const before = s;
  s = s.replace(/from\s+["']@\/lib\/search["']/g, "from \"../../../lib/search\"");
  s = s.replace(/from\s+["']@\\lib\\search["']/g, "from \"../../../lib/search\"");
  if (s !== before) {
    fs.writeFileSync(p, s);
    console.log("patched:", p);
  } else {
    console.log("no-change:", p);
  }
NODE
else
  warn "Missing $ASK_FILE (skipping import patch)"
fi

###############################################################################
# 3) Keep alias for completeness (not relied upon by ask route anymore)
###############################################################################
say "Pin tsconfig alias @/* -> src/*"
if [ -f tsconfig.json ]; then
  node <<'NODE'
  import fs from 'fs';
  const p='tsconfig.json';
  const j=JSON.parse(fs.readFileSync(p,'utf8'));
  j.compilerOptions ||= {};
  j.compilerOptions.baseUrl = j.compilerOptions.baseUrl || ".";
  j.compilerOptions.paths ||= {};
  j.compilerOptions.paths["@/*"] = ["src/*"];
  j.compilerOptions.plugins = Array.isArray(j.compilerOptions.plugins) ? j.compilerOptions.plugins : [];
  if (!j.compilerOptions.plugins.find(x=>x && x.name==="next")) j.compilerOptions.plugins.push({ name:"next" });
  fs.writeFileSync(p, JSON.stringify(j,null,2));
  console.log("patched:", p);
NODE
fi

###############################################################################
# 4) Clean build and start prod server on :3000
###############################################################################
say "Clean Next cache & build"
rm -rf .next
pnpm build

say "Start production server (port 3000)"
# Stop any existing Next on 3000
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
say "Done. Open http://localhost:3000"
