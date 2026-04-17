import { NextResponse } from "next/server";
import { runJob, type JobId } from "@/lib/ingest/run";
import { ingestMPs, ingestBills, ingestDivisions, ingestNews } from "@/lib/ingest/adapters";

const map: Record<JobId, ()=>Promise<any>> = {
  mps: ingestMPs,
  bills: ingestBills,
  divisions: ingestDivisions,
  news: ingestNews,
};

export async function POST(req: Request){
  const body = await req.json().catch(()=>({}));
  const job = body.job as JobId | undefined;
  const dryRun = !!body.dryRun;
  if (!job || !(job in map)) return NextResponse.json({ error: "invalid job" }, { status: 400 });
  const result = await runJob(job, map[job], { dryRun });
  return NextResponse.json(result);
}
