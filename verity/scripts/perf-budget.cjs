const fs = require('fs'), path = require('path'), zlib = require('zlib');
const out = path.join('.next','static','chunks');
let total = 0;
try {
  for (const f of fs.readdirSync(out)) {
    if (!/\.(js)$/.test(f)) continue;
    const buf = fs.readFileSync(path.join(out,f));
    const gz = zlib.gzipSync(buf).length;
    total += gz;
  }
} catch {}
const kb = Math.round(total/1024);
const budget = parseInt(process.env.PERF_BUDGET_KB || '300', 10);
if (kb > budget) {
  console.error(`❌ Perf budget exceeded: ${kb}KB gzipped > ${budget}KB (set PERF_BUDGET_KB to adjust)`);
  process.exit(1);
} else {
  console.log(`✅ Perf budget OK: ${kb}KB ≤ ${budget}KB`);
}
