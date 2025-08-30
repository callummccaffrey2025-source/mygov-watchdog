export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  const { data: sources, error } = await supabaseAdmin
    .from("source")
    .select("id, url, is_active, active");
  if (error) {
    await log("error", "enqueue-daily: list sources failed", { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let inserted = 0;
  for (const s of sources ?? []) {
    const isActive = (s as any).is_active ?? (s as any).active ?? true;
    if (!isActive) continue;
    const { error: insErr } = await supabaseAdmin.from("crawl_job").upsert(
      { source_id: (s as any).id, url: (s as any).url, scheduled_for: new Date(), status: "queued" },
      { onConflict: "url" }
    );
    if (!insErr) inserted++;
  }

  await log("info", "enqueue-daily complete", { inserted });
  return NextResponse.json({ ok: true, inserted });
}