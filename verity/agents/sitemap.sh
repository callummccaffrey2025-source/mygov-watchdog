#!/usr/bin/env bash
set -euo pipefail
. agents/.lib.sh

BASE_URL="$(read_env NEXT_PUBLIC_SUPABASE_URL)"
ANON="$(read_env NEXT_PUBLIC_SUPABASE_ANON_KEY)"
SITE="$(read_env NEXT_PUBLIC_SITE_URL)"
: "${BASE_URL:?NEXT_PUBLIC_SUPABASE_URL missing}"
: "${ANON:?NEXT_PUBLIC_SUPABASE_ANON_KEY missing}"
: "${SITE:=http://localhost:3000}"

node - <<JS
import fs from "node:fs";
const base = "${BASE_URL}".replace(/\/$/,"");
const key = "${ANON}";
const site = "${SITE}";
const u = \`\${base}/rest/v1/bills_mv?select=id&limit=5000\`;
const res = await fetch(u, { headers:{ apikey:key, Authorization:\`Bearer \${key}\` }});
if (!res.ok) { console.error("Fetch failed", res.status); process.exit(1); }
const rows = await res.json();
const urls = rows.map(r => \`\${site}/bills/\${r.id}\`);
fs.mkdirSync("public", { recursive:true });
const xml = \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${urls.map(x=>\`  <url><loc>\${x}</loc></url>\`).join("\\n")}
</urlset>\`;
fs.writeFileSync("public/sitemap.xml", xml);
console.log(\`wrote public/sitemap.xml with \${urls.length} URLs\`);
JS
