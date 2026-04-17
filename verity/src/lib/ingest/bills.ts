// src/lib/ingest/bills.ts
import { createClient } from "@supabase/supabase-js";

type BillRow = {
  id: string;
  title: string;
  stage?: string;
  introduced?: string;   // ISO date string
  sponsor?: string;
  summary?: string;
  progress?: string;     // e.g. "45%"
};

// tiny CSV parser that supports quotes and commas in fields
function parseCsv(text: string): BillRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        // finish row on first newline (skip \r\n double count)
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = "";
        if (row.some(x => x.length)) rows.push(row);
        row = [];
      } else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }

  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  const out: BillRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const obj: any = {};
    header.forEach((h, j) => obj[h] = r[j]);
    out.push(obj as BillRow);
  }
  return out;
}

async function readDataUrl(url: string) {
  // data:[<mediatype>][;base64],<data>
  const m = url.match(/^data:([^,]*),(.*)$/i);
  if (!m) throw new Error("Bad data: URL");
  const media = m[1] || "text/plain;charset=utf-8";
  let data = decodeURIComponent(m[2]);
  const isBase64 = /;base64/i.test(media);
  if (isBase64) data = Buffer.from(m[2], "base64").toString("utf8");
  return { media, data };
}

function toRows(payload: string, mediaHint?: string): BillRow[] {
  const media = (mediaHint || "").toLowerCase();
  const looksJson = /^\s*[\[{]/.test(payload) || media.includes("json");
  if (looksJson) {
    const a = JSON.parse(payload);
    if (Array.isArray(a)) return a as BillRow[];
    throw new Error("JSON must be an array");
  }
  // assume CSV
  return parseCsv(payload);
}

export async function runIngestBills(url: string) {
  if (!url) throw new Error("No url provided");

  let media = "";
  let text = "";

  if (url.startsWith("data:")) {
    const r = await readDataUrl(url);
    media = r.media; text = r.data;
  } else if (/^https?:\/\//i.test(url)) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
    media = r.headers.get("content-type") || "";
    text = await r.text();
  } else {
    throw new Error("URL must be https:// or data:");
  }

  const rows = toRows(text, media);

  // Upsert into Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE! // service key so we can write
  );

  const { data, error } = await supabase
    .from("bills")
    .upsert(
      rows.map(r => ({
        id: r.id,
        title: r.title,
        stage: r.stage ?? null,
        introduced: r.introduced ?? null,
        sponsor: r.sponsor ?? null,
        summary: r.summary ?? null,
        progress: r.progress ?? null,
      })),
      { onConflict: "id" }
    )
    .select("id");

  if (error) throw error;
  return { ok: true, count: data?.length ?? 0, source: url };
}
