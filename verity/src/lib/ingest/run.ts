import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { IngestResult } from "./adapters";

export type JobId = "mps" | "bills" | "divisions" | "news";

export async function runJob(job: JobId, fn: ()=>Promise<IngestResult>, opts?:{ dryRun?: boolean }){
  const dry = !!opts?.dryRun;
  const started = new Date().toISOString();
  const res = await fn().catch((e:any)=>({ error: e instanceof Error ? e.message : String(e) })) as IngestResult & { error?:string };

  // Log to console in dev
  console.log(`[ingest] ${job} ${dry ? "(dry)" : ""} ->`, res);

  if (env.USE_MOCK || dry || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { ok: !res.error, ...res, mock: true };
  }

  const supa = createClient();
  // record run row
  const { data: runRow, error: runErr } = await supa
    .from("ingest_runs")
    .insert({ job_id: job, started_at: started, status: res.error ? "error" : "success", message: res.error ?? res.note ?? null, count: res.count })
    .select("*").single();

  if (runErr) console.error("[ingest] failed to write run", runErr);

  // update job row (upsert)
  const { error: jobErr } = await supa
    .from("ingest_jobs")
    .upsert({
      id: job,
      last_started_at: started,
      last_finished_at: new Date().toISOString(),
      last_status: res.error ? "error" : "success",
      last_message: res.error ?? res.note ?? null,
      last_count: res.count ?? 0,
    });
  if (jobErr) console.error("[ingest] failed to write job", jobErr);

  // TODO: If res.items present, upsert to your domain tables here.

  return { ok: !res.error, ...res, runId: runRow?.id };
}

export async function loadJobSummaries(){
  if (env.USE_MOCK || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    // minimal mock status
    return [
      { id:"mps", last_status:"mock", last_count:0 },
      { id:"bills", last_status:"mock", last_count:0 },
      { id:"divisions", last_status:"mock", last_count:0 },
      { id:"news", last_status:"mock", last_count:0 },
    ];
  }
  const supa = createClient();
  const { data } = await supa.from("ingest_jobs").select("*").order("id");
  return data ?? [];
}
