#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
fail(){ printf "\n\033[1;31m[fail]\033[0m %s\n" "$*"; exit 1; }
[ -f package.json ] || fail "Run this in the project root."

###############################################################################
# 1) UI compatibility: exports for both capitalized & lowercase import paths
###############################################################################
say "UI shims for Card/Button (support default and named imports at lowercase paths)"
mkdir -p src/components/ui

# Capitalized implementations (kept as-is if present)
if [ ! -f src/components/ui/Card.tsx ]; then
  cat > src/components/ui/Card.tsx <<'TSX'
import React from "react";
export default function Card({children,className=""}:{children:React.ReactNode; className?:string}){
  return <div className={`card ${className}`}>{children}</div>;
}
TSX
fi
if [ ! -f src/components/ui/Button.tsx ]; then
  cat > src/components/ui/Button.tsx <<'TSX'
import React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"outline" };
export default function Button({variant="primary", className="", ...props}: Props){
  const base="btn";
  const v = variant==="primary" ? "btn-primary" : variant==="ghost" ? "btn-ghost" : "border border-white/10 hover:bg-white/5";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
TSX
fi

# Lowercase proxies that export BOTH default and named identifiers
cat > src/components/ui/card.tsx <<'TSX'
import CardImpl from "./Card";
export const Card = CardImpl;
export default CardImpl;
TSX
cat > src/components/ui/button.tsx <<'TSX'
import ButtonImpl from "./Button";
export const Button = ButtonImpl;
export default ButtonImpl;
TSX

###############################################################################
# 2) DB compatibility: export {db} along with prisma + default
###############################################################################
say "DB shim: export { db } from '@/lib/db'"
mkdir -p src/lib
cat > src/lib/db.ts <<'TS'
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  g.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query","error","warn"] : ["error"],
  });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

// Back-compat named export expected by legacy code
export const db = prisma;

// Default export (optional consumers)
export default prisma;
TS

###############################################################################
# 3) Provide minimal working versions of referenced libs/components/pages
###############################################################################
say "Provide JoinForm and personalise page that use the shims cleanly"
cat > src/components/JoinForm.tsx <<'TSX'
"use client";
import { Button } from "@/components/ui/button";
import React from "react";
export default function JoinForm(){
  const [email,setEmail] = React.useState("");
  const [msg,setMsg] = React.useState<string|null>(null);
  const [loading,setLoading] = React.useState(false);
  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setMsg(null); setLoading(true);
    try{
      const r = await fetch("/api/subscribe",{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error || "Failed");
      setMsg("You're in — thanks for joining Verity!"); setEmail("");
    }catch(e:any){ setMsg(e?.message || "Could not subscribe"); }
    finally{ setLoading(false); }
  }
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-3">
      <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none placeholder:text-white/50"
             placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required type="email" />
      <Button disabled={loading} className="w-full">{loading?"Working...":"Get started"}</Button>
      {msg && <div className="text-sm text-white/80">{msg}</div>}
    </form>
  );
}
TSX

mkdir -p src/app/personalise
cat > src/app/personalise/page.tsx <<'TSX'
import { Card } from "@/components/ui/card";

export const metadata = { title: "Personalise — Verity" };

export default function Page(){
  const prefs = [
    { key:"economy",   label:"Economy" },
    { key:"climate",   label:"Climate & Energy" },
    { key:"integrity", label:"Integrity & Governance" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="h1">Personalise</h1>
      <p className="lead">Select topics to emphasise in your briefing (saved locally; future accounts can sync).</p>
      <div className="grid gap-4 md:grid-cols-3">
        {prefs.map(p=>(
          <Card key={p.key} className="p-5">
            <div className="font-medium">{p.label}</div>
            <div className="mt-1 text-sm text-white/60">High-priority for your daily brief.</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
TSX

###############################################################################
# 4) Implement/normalize API routes that referenced { db } to avoid type/build errors
###############################################################################
say "Normalize API routes that import { db }"

mkdir -p src/app/api/{ask,bills,mps,status,briefings}
mkdir -p src/app/api/bills/[id] src/app/api/mps/[id]

# Simple full-text-ish search over News/Bills/MPs
cat > src/lib/search.ts <<'TS'
import { db } from "./db";
export async function search(q:string){
  const term = q.trim();
  if(!term) return { mps:[], bills:[], news:[] };
  const [mps,bills,news] = await Promise.all([
    db.mP.findMany({ where:{ OR:[{name:{contains:term, mode:"insensitive"}},{electorate:{contains:term,mode:"insensitive"}},{party:{contains:term,mode:"insensitive"}}] }, take:10 }),
    db.bill.findMany({ where:{ OR:[{title:{contains:term, mode:"insensitive"}},{summary:{contains:term,mode:"insensitive"}}] }, orderBy:{ introduced:"desc" }, take:10 }),
    db.news.findMany({ where:{ OR:[{title:{contains:term, mode:"insensitive"}},{source:{contains:term,mode:"insensitive"}}] }, orderBy:{ published:"desc" }, take:10 }),
  ]);
  return { mps,bills,news };
}
TS

# Briefings stub (returns latest items grouped)
cat > src/lib/briefings.ts <<'TS'
import { db } from "./db";
export async function getBriefing(){
  const [bills,news] = await Promise.all([
    db.bill.findMany({ orderBy:{ introduced:"desc" }, take:5 }),
    db.news.findMany({ orderBy:{ published:"desc" }, take:6 })
  ]);
  return { headlineBills:bills, topNews:news };
}
TS

cat > src/app/api/ask/route.ts <<'TS'
import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";
export async function POST(req: NextRequest){
  const { q } = await req.json().catch(()=>({ q:"" }));
  const results = await search(q||"");
  return NextResponse.json({ ok:true, ...results });
}
TS

cat > src/app/api/bills/route.ts <<'TS'
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(){ 
  const bills = await db.bill.findMany({ orderBy:{ introduced:"desc" }});
  return NextResponse.json(bills);
}
TS

cat > src/app/api/bills/[id]/route.ts <<'TS'
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(_:Request,{ params }:{ params:{ id:string } }){
  const bill = await db.bill.findUnique({ where:{ id: params.id } });
  if(!bill) return new NextResponse("Not found",{ status:404 });
  return NextResponse.json(bill);
}
TS

cat > src/app/api/mps/route.ts <<'TS'
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(){ 
  const mps = await db.mP.findMany({ orderBy:{ name:"asc" }});
  return NextResponse.json(mps);
}
TS

cat > src/app/api/mps/[id]/route.ts <<'TS'
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(_:Request,{ params }:{ params:{ id:string } }){
  const mp = await db.mP.findUnique({ where:{ id: params.id } });
  if(!mp) return new NextResponse("Not found",{ status:404 });
  return NextResponse.json(mp);
}
TS

cat > src/app/api/status/route.ts <<'TS'
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(){
  try{
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message||"db error" },{ status:500 });
  }
}
TS

cat > src/app/api/briefings/route.ts <<'TS'
import { NextResponse } from "next/server";
import { getBriefing } from "@/lib/briefings";
export async function GET(){ 
  const data = await getBriefing(); 
  return NextResponse.json(data);
}
TS

###############################################################################
# 5) Rebuild production and restart PM2 processes
###############################################################################
say "Rebuild production bundle"
rm -rf .next
pnpm build >/dev/null

say "Restart PM2 (app + cron)"
pnpm dlx pm2 delete verity-app  >/dev/null 2>&1 || true
pnpm dlx pm2 delete verity-cron >/dev/null 2>&1 || true
pnpm dlx pm2 start "pnpm start -p 3000" --name verity-app --time
pnpm dlx pm2 start "node scripts/ingest.mjs" --name verity-cron --time
pnpm dlx pm2 save >/dev/null

say "Done. Verity is live at http://localhost:3000  | Health: /api/health"
