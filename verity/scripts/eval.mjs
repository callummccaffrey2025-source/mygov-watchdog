/**
 * Simple local eval for Verity.
 * Uses Node 20's built-in fetch. No deps.
 * Set BASE to your prod URL to test deploys:
 *   BASE=https://verity.run node scripts/eval.mjs
 */
const BASE = process.env.BASE || "http://localhost:3000";

const tests = [
  { q: "NSW energy rebate 2024-2025" },
  { q: "Low Income Household Rebate NSW" },
  { q: "Who is the NSW premier (as of 2025)?" }
];

const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const run = async () => {
  for (const t of tests) {
    const r = await post("/api/ask", { q: t.q, pageSize: 8 });
    let j;
    try { j = await r.json(); } catch {
      const txt = await r.text();
      console.log("❌", t.q, "— non-JSON response:", txt);
      continue;
    }
    const ok = r.ok && !j.lowConfidence && Array.isArray(j.sources) && j.sources.length > 0;
    const srcs = (j.sources || []).map(s => `[${s.n ?? "?"}] ${s.domain || s.url || ""}`).join("  ");
    console.log(ok ? "✅" : "❌", t.q, srcs ? `— ${srcs}` : "");
    if (!ok) console.dir(j, { depth: null });
  }
};

run().catch((e) => { console.error(e); process.exit(1); });
