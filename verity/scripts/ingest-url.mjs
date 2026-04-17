/**
 * Fetch a URL, strip HTML to plain text, and POST to /api/ingest.
 * Usage:
 *   node scripts/ingest-url.mjs "<url>" "<title>" <YYYY-MM-DD> <jurisdiction>
 * Example:
 *   node scripts/ingest-url.mjs "https://www.service.nsw.gov.au/..." "Energy Bill Relief – Service NSW" 2024-07-01 NSW
 */
const BASE = process.env.BASE || "http://localhost:3000";

const url = process.argv[2];
const title = process.argv[3] || "";
const date = process.argv[4] || "";          // YYYY-MM-DD
const jurisdiction = process.argv[5] || "";

if (!url) {
  console.error('Usage: node scripts/ingest-url.mjs "<url>" "<title>" <YYYY-MM-DD> <jurisdiction>');
  process.exit(1);
}

async function fetchHtml(u) {
  const r = await fetch(u, { headers: { "user-agent": "VerityBot/1.0" } });
  if (!r.ok) throw new Error(`Fetch failed ${r.status}: ${u}`);
  const html = await r.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const text = await fetchHtml(url);
const body = { url, title, text, date, jurisdiction, isOfficial: true };

const resp = await fetch(`${BASE}/api/ingest`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const json = await resp.json().catch(() => ({}));
console.log(json);
if (!resp.ok) process.exit(1);
