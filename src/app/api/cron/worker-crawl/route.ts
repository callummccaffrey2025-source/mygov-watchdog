export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { indexPage } from "@/lib/crawlPipeline";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
const BATCH = 3;

async function claimOne(): Promise<null | { id: string; url: string; source_id: string }> {
  const { data, error } = await supabaseAdmin.rpc("claim_crawl_job");
  if (error) throw new Error(error.message);
  return data as any; // data = {id,url,source_id} | null
}

export async function GET() {
  let done = 0, errors = 0;
  for (let i = 0; i < BATCH; i++) {
    const job = await claimOne();
    if (!job) break;

    try {
      await indexPage(job);
      await supabaseAdmin
        .from("crawl_job")
        .update({ status: "done", finished_at: new Date(), error: null })
        .eq("id", job.id);
      done++;
    } catch (e: any) {
      errors++;
      const retryable = !!e?.retryable;
      const backoffMs = 5 * 60 * 1000; // 5m simple backoff
      await supabaseAdmin
        .from("crawl_job")
        .update({
          status: retryable ? "queued" : "error",
          error: `${e?.name || "err"}: ${e?.message || String(e)}`.slice(0, 2000),
          finished_at: new Date(),
          scheduled_for: retryable ? new Date(Date.now() + backoffMs) : new Date(),
        })
        .eq("id", job.id);
      await log("warn", "worker-crawl: job failed", { jobId: job.id, retryable, message: e?.message });
    }
  }
  return NextResponse.json({ ok: true, done, errors });
}