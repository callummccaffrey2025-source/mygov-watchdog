export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
export async function GET() {
  const { data: sources, error } = await db.from("source").select("id,url").limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // TODO: call your real queue/edge function per source here
  return NextResponse.json({ ok:true, toCrawl: sources?.length ?? 0 });
}
