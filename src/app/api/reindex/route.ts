export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data: sources, error } = await supabaseAdmin.from("source").select("id,name,url,jurisdiction,type").limit(500);
    if (error) throw error;

    // TODO: replace with your real crawler enqueue (e.g., queue, function call)
    // For now, this just returns how many sources would be crawled.
    return NextResponse.json({ ok: true, toCrawl: sources?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
