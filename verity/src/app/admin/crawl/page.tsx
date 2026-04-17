export const dynamic = "force-dynamic";

async function fetchStatus(){
  const res = await fetch("/api/status", { cache:"no-store" }).catch(()=>null as any);
  const ok = !!res?.ok;
  let jobs:any[] = [];
  try {
    const r = await fetch("/api/admin/crawl?status=1", { cache:"no-store" }).catch(()=>null as any);
    // If no status endpoint yet, render empty
    jobs = r?.ok ? await r.json() : [];
  } catch {}
  return { ok, jobs };
}

async function run(job: string, dry=false){
  "use server";
  await fetch("/api/admin/crawl", {
    method: "POST",
    headers: { "content-type":"application/json" },
    body: JSON.stringify({ job, dryRun: dry })
  });
}

export default async function CrawlPage(){
  const { jobs } = await fetchStatus().catch(()=>({jobs:[]}));
  const known = ["mps","bills","divisions","news"];
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold mb-6">Crawl &amp; Ingest</h1>

      <form className="grid gap-3" action={async (fd:FormData)=>{
        "use server";
        const job = String(fd.get("job")||"");
        const dry = !!fd.get("dry");
        await fetch("/api/admin/crawl",{
          method:"POST",
          headers:{ "content-type":"application/json" },
          body: JSON.stringify({ job, dryRun: dry })
        });
      }}>
        <div className="grid grid-cols-2 gap-2">
          {known.map(k=>(
            <button key={k} name="job" value={k}
              className="rounded-xl border border-white/10 px-4 py-2 hover:border-emerald-400/40 text-left">
              Run {k}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="dry" /> Dry run (no writes)
        </label>
      </form>

      <div className="mt-8 rounded-xl border border-white/10">
        <div className="p-4 font-medium border-b border-white/10">Job Status</div>
        <div className="p-4 text-sm">
          {jobs?.length ? (
            <ul className="space-y-2">
              {jobs.map((j:any)=>(
                <li key={j.id} className="flex items-center justify-between">
                  <span>{j.id}</span>
                  <span className="text-neutral-400">{j.last_status ?? "—"} · {j.last_count ?? 0}</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-neutral-500">No status yet.</div>}
        </div>
      </div>
    </main>
  );
}
