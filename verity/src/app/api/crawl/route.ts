export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const J_ALLOWED = new Set(["AU","ACT","NSW","NT","QLD","SA","TAS","VIC","WA"]);
const T_ALLOWED = new Set(["generic","parliament","federal","state","territory","court","gazette","agency","news","ngo","party"]);

export function GET(){ return NextResponse.json({ ok:true, at:"/api/crawl" }); }

export async function POST(req: NextRequest){
  try{
    const { name, url, jurisdiction, type } = await req.json();
    if(!name || !url) return NextResponse.json({ error: "name & url required" }, { status: 400 });

    const j = (jurisdiction || "AU").toUpperCase();
    const t = (type || "news").toLowerCase();
    if(!J_ALLOWED.has(j)) return NextResponse.json({ error: "jurisdiction not allowed" }, { status: 400 });
    if(!T_ALLOWED.has(t)) return NextResponse.json({ error: "type not allowed" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: src, error: e1 } = await supabase
      .from("source")
      .upsert({ name, url, jurisdiction: j, type: t })
      .select()
      .single();

    if(e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const { error: e2 } = await supabase
      .from("crawl_job")
      .insert({ source_id: (src as any).id, url, status: "queued" });

    if(e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    return NextResponse.json({ ok:true, source: src });
  }catch(e:any){
    return NextResponse.json({ error: e.message??String(e) }, { status:500 });
  }
}
