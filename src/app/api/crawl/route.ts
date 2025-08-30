export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const J_ALLOWED = ["AU","ACT","NSW","NT","QLD","SA","TAS","VIC","WA"];
const T_ALLOWED = ["generic","parliament","federal","state","territory","court","gazette","agency","news","ngo","party"];

export async function GET() {
  return NextResponse.json({ ok: true, at: "/api/crawl" });
}

export async function POST(req: Request) {
  try {
    const { name, url, jurisdiction, type = "generic" } = await req.json();

    if (!name || !url) return NextResponse.json({ error: "name + url required" }, { status: 400 });
    if (jurisdiction && !J_ALLOWED.includes(jurisdiction)) return NextResponse.json({ error: "invalid jurisdiction" }, { status: 400 });
    if (!T_ALLOWED.includes(type)) return NextResponse.json({ error: "invalid type" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("source")
      .upsert({ name, url, jurisdiction, type }, { onConflict: "url" }) // avoid duplicates
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, source: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
