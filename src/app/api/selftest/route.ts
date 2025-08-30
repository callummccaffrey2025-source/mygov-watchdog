export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const out: any = { ok: true, checks: {} };

  const src = await supabaseAdmin.from("source").select("id", { count: "exact", head: true });
  out.checks.sources_count = src.count ?? 0;

  const docs = await supabaseAdmin.from("document").select("id", { count: "exact", head: true });
  out.checks.documents_count = docs.count ?? 0;

  out.env = {
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SERVICE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    PINECONE_INDEX: process.env.PINECONE_INDEX || null,
  };

  return NextResponse.json(out);
}