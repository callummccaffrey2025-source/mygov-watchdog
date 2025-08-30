export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await db.from("alert_rule").select("*").order("created_at", { ascending:false });
  if(error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, alerts:data });
}
export async function POST(req: Request) {
  const rule = await req.json();
  const { error } = await db.from("alert_rule").insert(rule);
  if(error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true });
}
