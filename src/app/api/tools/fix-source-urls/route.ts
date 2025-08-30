export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export const runtime = "nodejs";

export async function POST() {
  const { data: sources, error } = await supabaseAdmin
    .from("source")
    .select("id, url")
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let patched = 0;
  for (const s of sources ?? []) {
    const url: string = (s as any).url || "";
    if (!/^\w+:\/\//.test(url)) {
      const fixed = "https://" + url.replace(/^\/+/, "");
      const { error: uerr } = await supabaseAdmin
        .from("source")
        .update({ url: fixed })
        .eq("id", (s as any).id);
      if (!uerr) patched++;
    }
  }
  return NextResponse.json({ ok: true, patched });
}