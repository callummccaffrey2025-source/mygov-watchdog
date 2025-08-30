// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic"; // always fresh
export const runtime = "nodejs";

function snippet(text: string, q: string, len = 240) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, len) + (text.length > len ? "…" : "");
  const start = Math.max(0, i - Math.floor(len / 3));
  const end = Math.min(text.length, start + len);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  // Basic full-text search using generated tsvector column `content_tsv`
  // Falls back to ILIKE if tsv not present
  const { data, error } = await supabaseAdmin
    .rpc("verity_search_docs", { query: q })
    .select()
    .limit(25);

  // If RPC not installed, try direct query
  let hits: any[] = [];
  if (!error && Array.isArray(data)) {
    hits = data;
  } else {
    const { data: likeData, error: likeErr } = await supabaseAdmin
      .from("document")
      .select("id,title,url,content,published_at")
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .order("published_at", { ascending: false })
      .limit(25);
    if (likeErr) return NextResponse.json({ error: likeErr.message }, { status: 500 });
    hits = likeData ?? [];
  }

  const mapped = hits.map((d: any) => ({
    id: String(d.id),
    title: d.title ?? "",
    url: d.url ?? "",
    published_at: d.published_at ?? null,
    snippet: d.content ? snippet(d.content, q) : undefined,
  }));

  return NextResponse.json({ hits: mapped });
}

