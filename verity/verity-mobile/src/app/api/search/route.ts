export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
export async function GET(req: Request){
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  if(!q) return NextResponse.json({ error:"q required" }, { status: 400 });
  const { data, error } = await db.rpc("websearch", { q, lim: 20 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, hits: data });
}
