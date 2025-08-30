export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  const since = new Date(Date.now() - 65 * 60 * 1000).toISOString();

  const { data: rules, error: rerr } = await supabaseAdmin
    .from("alert_rule").select("id, user_id, query, jurisdictions, active").eq("active", true);
  if (rerr) return NextResponse.json({ error: rerr.message }, { status: 500 });
  if (!rules?.length) return NextResponse.json({ ok: true, matched: 0 });

  let matched = 0;
  for (const r of rules) {
    const jx = (r.jurisdictions && r.jurisdictions.length) ? r.jurisdictions : ["AU"];
    const { data: docs, error: derr } = await supabaseAdmin
      .from("document")
      .select("id, title, url, summary, published_at, jurisdiction")
      .gte("created_at", since)
      .in("jurisdiction", jx)
      .or(`title.ilike.%${r.query}%,summary.ilike.%${r.query}%`);
    if (derr) continue;
    if (docs?.length) {
      matched += docs.length;
      await log("info", "alert match", { rule_id: r.id, hits: docs.map(d => ({ t: d.title, u: d.url })) });
      // (Later: insert into a notifications table / send email)
    }
  }
  return NextResponse.json({ ok: true, matched });
}