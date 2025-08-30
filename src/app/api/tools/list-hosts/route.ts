export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export const runtime = "nodejs";
export async function GET() {
  const { data: jobs } = await supabaseAdmin.from("crawl_job").select("url").limit(2000);
  const set = new Set<string>();
  for (const j of jobs ?? []) { try { set.add(new URL(j.url).hostname.replace(/^www\./,"")); } catch {} }
  return NextResponse.json({ hosts: Array.from(set).sort() });
}