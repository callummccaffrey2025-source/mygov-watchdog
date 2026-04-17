#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
[ -f package.json ] || { echo "[fail] run in project root"; exit 1; }

###############################################################################
# 0) Remove any capitalised UI files that can cause webpack case-collision
###############################################################################
say "Remove capitalised UI sources"
rm -f src/components/ui/Button.tsx 2>/dev/null || true
rm -f src/components/ui/Card.tsx   2>/dev/null || true

###############################################################################
# 1) Ensure lowercase UI primitives exist (single source of truth)
###############################################################################
say "Ensure lowercase UI primitives exist"
mkdir -p src/components/ui
cat > src/components/ui/atoms.tsx <<'TSX'
import React from "react";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"outline" };
export function UIButton({ variant="primary", className="", ...props }: ButtonProps){
  const base="btn rounded-xl px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald/60";
  const v = variant==="primary" ? "bg-emerald text-[#0b0f14]" :
            variant==="ghost"   ? "bg-transparent hover:bg-white/5" :
                                  "border border-white/10 hover:bg-white/5";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
export type CardProps = { className?: string; children: React.ReactNode };
export function UICard({ className="", children }: CardProps){
  return <div className={`card rounded-2xl border border-white/10 bg-white/5 ${className}`}>{children}</div>;
}
TSX
cat > src/components/ui/button.tsx <<'TSX'
"use client";
export { UIButton as default, UIButton as Button } from "./atoms";
TSX
cat > src/components/ui/card.tsx <<'TSX'
export { UICard as default, UICard as Card } from "./atoms";
TSX

###############################################################################
# 2) Rewrite imports across the codebase via Node (handles huge trees safely)
###############################################################################
say "Rewrite all imports to lowercase ui paths via Node walker"
node <<'NODE'
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const exts = new Set(['.ts','.tsx','.mts','.cts','.js','.jsx']);
const targets = [];

function walk(d){
  for(const e of fs.readdirSync(d, { withFileTypes:true })){
    if(e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.git')) continue;
    const p = path.join(d,e.name);
    if(e.isDirectory()) walk(p);
    else if(exts.has(path.extname(p))) targets.push(p);
  }
}

walk(path.join(ROOT,'src'));

const re = [
  // alias imports
  [/@\/components\/ui\/Button\b/g, '@/components/ui/button'],
  [/@\/components\/ui\/Card\b/g,   '@/components/ui/card'],
  // relative path imports (../../components/ui/Button etc.)
  [/(['"\(])(\.{1,2}\/[^'")]*components\/ui\/)Button\b/g, (_m,prefix,base)=> `${prefix}${base}button`],
  [/(['"\(])(\.{1,2}\/[^'")]*components\/ui\/)Card\b/g,   (_m,prefix,base)=> `${prefix}${base}card`],
];

let changed=0;
for(const file of targets){
  let s = fs.readFileSync(file,'utf8');
  let t = s;
  for(const [rx,rep] of re) t = t.replace(rx, rep);
  if(t !== s){
    fs.writeFileSync(file,t);
    changed++;
  }
}
console.log(`rewritten files: ${changed}`);
NODE

###############################################################################
# 3) tsconfig aliases (belt & braces)
###############################################################################
say "Pin tsconfig aliases so both casings resolve to lowercase"
node <<'NODE'
import fs from 'fs';
const p='tsconfig.json';
const j = JSON.parse(fs.readFileSync(p,'utf8'));
j.compilerOptions ||= {};
j.compilerOptions.baseUrl = j.compilerOptions.baseUrl || ".";
j.compilerOptions.paths ||= {};
j.compilerOptions.paths["@/*"] = ["src/*"];
j.compilerOptions.paths["@/components/ui/Button"] = ["src/components/ui/button.tsx"];
j.compilerOptions.paths["@/components/ui/Card"]   = ["src/components/ui/card.tsx"];
j.compilerOptions.paths["@/components/ui/button"] = ["src/components/ui/button.tsx"];
j.compilerOptions.paths["@/components/ui/card"]   = ["src/components/ui/card.tsx"];
j.compilerOptions.plugins = Array.isArray(j.compilerOptions.plugins) ? j.compilerOptions.plugins : [];
if (!j.compilerOptions.plugins.find(p=>p && p.name==="next")) j.compilerOptions.plugins.push({ name:"next" });
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log("patched:", p);
NODE

###############################################################################
# 4) Ensure lib/search.ts exists (api/ask depends on it)
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
# 5) Clean build (no PM2 changes—just compile clean)
###############################################################################
say "Clean Next cache & build"
rm -rf .next
pnpm build
