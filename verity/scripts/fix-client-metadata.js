const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name === 'page.tsx') out.push(p);
  }
  return out;
}

let changed = 0;

for (const page of walk('src/app')) {
  let s = fs.readFileSync(page, 'utf8');

  const isClient = s.includes('"use client"') || s.includes("'use client'");
  const hasMeta  = /export\s+const\s+metadata\s*=/.test(s);
  if (!isClient || !hasMeta) continue;

  const m = s.match(/export\s+const\s+metadata\s*=\s*({[\s\S]*?});/m);
  if (!m) continue;
  const meta = m[1];

  const dir = path.dirname(page);
  const layout = path.join(dir, 'layout.tsx');

  const layoutSrc = `import type { ReactNode } from "react";

export const metadata = ${meta}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
`;
  fs.writeFileSync(layout, layoutSrc);

  // Remove metadata export from the client page
  s = s.replace(/export\s+const\s+metadata\s*=\s*{[\s\S]*?};\s*/m, '');

  // Remove ANY existing "use client" lines, then add exactly one at file top
  s = s.replace(/^\s*['"]use client['"];?\s*/gm, '');
  s = `"use client";\n` + s.trimStart();

  fs.writeFileSync(page, s);
  console.log('✔ fixed', page);
  changed++;
}

console.log('Done. Changed', changed, 'page(s).');
