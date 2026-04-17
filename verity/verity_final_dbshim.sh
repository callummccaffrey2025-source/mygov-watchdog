#!/usr/bin/env bash
set -euo pipefail
say(){ printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }

[ -f package.json ] || { echo "[fail] Run in project root"; exit 1; }

###############################################################################
# 1) Create a lightweight DB shim that matches how your code uses it
#    - Reads from src/data/{mps,bills,news}.json
#    - Implements mP.findMany/findUnique, bill.findMany/findUnique, news.findMany
###############################################################################
say "Write src/lib/db.ts shim"
mkdir -p src/lib src/types src/data

# If news.json is missing, synthesize minimal file so pages don't break
[ -f src/data/news.json ] || cat > src/data/news.json <<'JSON'
[
  {"id":"n-1","title":"Welcome to Verity","source":"Verity","url":"https://localhost","published":"2025-01-01T00:00:00.000Z","summary":"Launch update."}
]
JSON

cat > src/lib/db.ts <<'TS'
/**
 * Minimal DB shim for Verity:
 * - Reads JSON datasets from src/data
 * - Exposes Prisma-like methods your code uses:
 *     db.mP.findMany, db.mP.findUnique
 *     db.bill.findMany, db.bill.findUnique
 *     db.news.findMany
 */
import fs from "fs";
import path from "path";

type MP = { id: string; name: string; party: string; electorate: string };
type Bill = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string | null };
type News = { id: string; title: string; source: string; url?: string; published: string; summary?: string };

function readJson<T>(file: string, fallback: T): T {
  const p = path.join(process.cwd(), "src", "data", file);
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function containsCI(hay: unknown, needle: string) {
  if (typeof hay !== "string") return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}
function orderBy<T extends Record<string, any>>(arr: T[], key: keyof T, dir: "asc"|"desc") {
  return [...arr].sort((a,b) => {
    const av = a[key], bv = b[key];
    // Date aware compare if looks like ISO date
    const isDate = (v:any) => typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v);
    const A = isDate(av) ? Date.parse(av) : av;
    const B = isDate(bv) ? Date.parse(bv) : bv;
    const cmp = A < B ? -1 : A > B ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
}

// Load datasets (cached per process)
let MPS: MP[] = readJson<MP[]>("mps.json", []);
let BILLS: Bill[] = readJson<Bill[]>("bills.json", []);
let NEWS: News[] = readJson<News[]>("news.json", []);

type FindManyOpts<T> = {
  where?: {
    OR?: Array<Record<string, { contains: string; mode?: "insensitive" }>>;
  };
  orderBy?: Record<string, "asc"|"desc">;
  take?: number;
};
type FindUniqueOpts<T> = { where: { id: string } };

function filterContains<T extends Record<string, any>>(rows: T[], where?: FindManyOpts<T>["where"]) {
  if (!where?.OR || where.OR.length === 0) return rows;
  return rows.filter(row => {
    return where.OR!.some(cond => {
      return Object.entries(cond).some(([field, spec]) => {
        const v = row[field];
        return containsCI(v, spec.contains);
      });
    });
  });
}

export const db = {
  mP: {
    async findMany(opts: FindManyOpts<MP> = {}) {
      let out = filterContains<MP>(MPS, opts.where);
      if (opts.orderBy) {
        const [key, dir] = Object.entries(opts.orderBy)[0] as [keyof MP, "asc"|"desc"];
        out = orderBy(out, key, dir);
      }
      if (opts.take) out = out.slice(0, opts.take);
      return out;
    },
    async findUnique(opts: FindUniqueOpts<MP>) {
      return MPS.find(m => m.id === opts.where.id) || null;
    },
  },
  bill: {
    async findMany(opts: FindManyOpts<Bill> = {}) {
      let out = filterContains<Bill>(BILLS, opts.where);
      if (opts.orderBy) {
        const [key, dir] = Object.entries(opts.orderBy)[0] as [keyof Bill, "asc"|"desc"];
        out = orderBy(out, key, dir);
      }
      if (opts.take) out = out.slice(0, opts.take);
      return out;
    },
    async findUnique(opts: FindUniqueOpts<Bill>) {
      return BILLS.find(b => b.id === opts.where.id) || null;
    },
  },
  news: {
    async findMany(opts: FindManyOpts<News> = {}) {
      let out = filterContains<News>(NEWS, opts.where);
      if (opts.orderBy) {
        const [key, dir] = Object.entries(opts.orderBy)[0] as [keyof News, "asc"|"desc"];
        out = orderBy(out, key, dir);
      }
      if (opts.take) out = out.slice(0, opts.take);
      return out;
    },
  },
};

// Optional: default export for places that import default
export default db;
TS

# Type helper (keeps TS happy if strict)
cat > src/types/db-shim.d.ts <<'DTS'
declare module "@/lib/db" {
  export type MP = { id: string; name: string; party: string; electorate: string };
  export type Bill = { id: string; title: string; summary: string; status: string; introduced: string; sponsor?: string | null };
  export type News = { id: string; title: string; source: string; url?: string; published: string; summary?: string };
  export const db: {
    mP: {
      findMany(opts?: any): Promise<MP[]>;
      findUnique(opts: { where: { id: string } }): Promise<MP | null>;
    };
    bill: {
      findMany(opts?: any): Promise<Bill[]>;
      findUnique(opts: { where: { id: string } }): Promise<Bill | null>;
    };
    news: {
      findMany(opts?: any): Promise<News[]>;
    };
  };
  export default db;
}
DTS

###############################################################################
# 2) Ensure tsconfig has @/* -> src/* and includes src/types
###############################################################################
say "Patch tsconfig.json (alias + types include)"
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
const inc = new Set([...(j.include||[]), "src/**/*", ".next/types/**/*.ts", "next-env.d.ts", "src/types/**/*.d.ts"]);
j.include = Array.from(inc);
fs.writeFileSync(p, JSON.stringify(j,null,2));
console.log("patched:", p);
NODE

###############################################################################
# 3) Clean build & start production server
###############################################################################
say "Clean Next cache & build"
rm -rf .next
pnpm build

say "Start production server on :3000"
pkill -f "next start" 2>/dev/null || true
pnpm start -p 3000 &
sleep 2
say "Done. Open http://localhost:3000"
