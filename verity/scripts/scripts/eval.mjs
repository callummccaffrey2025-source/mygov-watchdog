import fetch from "node-fetch";

const tests = [
  { q: "NSW energy rebate 2024-2025" },
  { q: "Low Income Household Rebate NSW" },
  { q: "Who is NSW premier (as of 2025)?" }
];

for (const t of tests) {
  const r = await fetch("http://localhost:3000/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: t.q, pageSize: 8 })
  });
  const j = await r.json();
  const ok = r.ok && !j.lowConfidence && (j.sources?.length ?? 0) > 0;
  console.log(ok ? "✅" : "❌", t.q);
  if (!ok) console.log(j);
}
