export const runtime = "nodejs";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type Item = {
  id: string;
  kind: "bill" | "hansard" | "vote" | "budget" | "interests";
  title: string; date: string; url: string; body: string;
};

function loadCorpus(): Item[] {
  const p = path.join(process.cwd(), "data", "samples", "corpus.json");
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
const toks = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim();
  const kinds = (u.searchParams.getAll("kind") || []) as Item["kind"][];
  const from = u.searchParams.get("from") || "";
  const to = u.searchParams.get("to") || "";
  const page = Math.max(1, Number(u.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(u.searchParams.get("pageSize") || 10)));

  let items = loadCorpus();
  if (kinds.length) items = items.filter(i => kinds.includes(i.kind));
  if (from) items = items.filter(i => i.date >= from);
  if (to) items = items.filter(i => i.date <= to);

  let scored = items.map(i => ({ item: i, score: 0 }));
  if (q) {
    const qTokens = toks(q);
    scored = scored.map(({ item }) => {
      const hay = (item.title + " " + item.body).toLowerCase();
      const titleTokens = toks(item.title);
      let score = 0;
      for (const t of qTokens) {
        if (hay.includes(t)) score += 1;
        if (titleTokens.includes(t)) score += 1;
      }
      return { item, score };
    });
  }
  scored.sort((a, b) => (b.score - a.score) || b.item.date.localeCompare(a.item.date));

  const start = (page - 1) * pageSize;
  const results = scored.slice(start, start + pageSize).map(x => x.item);
  return NextResponse.json({ q, kinds, from, to, page, pageSize, total: scored.length, results });
}
