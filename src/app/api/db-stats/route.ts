export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export const runtime = "nodejs";
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("document")
    .select("source_id", { count: "exact", head: true });
  const bySource = await supabaseAdmin
    .rpc("json_agg", {}) // fallback if you don’t have a helper; do simple join
    .select;
  const res = await supabaseAdmin
    .from("source")
    .select("name, id");
  const docCounts = await supabaseAdmin
    .from("document")
    .select("id, source_id");
  const counts: Record<string, number> = {};
  (docCounts.data||[]).forEach(d => {
    counts[d.source_id] = (counts[d.source_id]||0)+1;
  });
  const rows = (res.data||[]).map(s => ({ name: s.name, docs: counts[s.id]||0 }))
    .sort((a,b)=>b.docs-a.docs);
  return NextResponse.json({ rows });
}