#!/usr/bin/env node
// scripts/ingest-url.mjs

const [, , rawUrl, ...argv] = process.argv;
if (!rawUrl) {
  console.error("Usage: node scripts/ingest-url.mjs <url> --title \"...\" --jurisdiction \"...\" --official true");
  process.exit(1);
}

// tiny flag parser
const flags = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    flags[k] = v;
  }
}

const title = flags.title || "";
const jurisdiction = flags.jurisdiction || "";
const isOfficial = String(flags.official).toLowerCase() === "true";

async function fetchHtml(u) {
  const r = await fetch(u, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!r.ok) throw new Error(`Fetch failed ${r.status}: ${u}`);
  return await r.text();
}

// very simple HTML→text fallback (no extra deps)
function htmlToText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

try {
  const html = await fetchHtml(rawUrl);
  const text = htmlToText(html);
  console.log(`Extracted text length: ${text.length}`);

  if (text.length < 50) {
    console.error("Extracted text is too short. Pick a content page (not the site home), or pass --text yourself.");
    process.exit(1);
  }

  const res = await fetch("http://localhost:3000/api/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: rawUrl, title, jurisdiction, isOfficial, text }),
  });

  const json = await res.json().catch(() => ({}));
  console.log(`Ingest response: ${res.status}`, json);
  if (!res.ok) process.exit(1);
} catch (e) {
  console.error("INGEST_URL_ERROR:", e?.message || e);
  process.exit(1);
}
