type PageProps = { params?: Record<string,string>; searchParams?: Record<string,string|string[]|undefined> };
type Incident = { date: string; title: string; status: string };
type Correction = { date: string; item: string; action: string };
import { loadJSON } from "@/utils/load";
export const dynamic="force-static";
export default async function Trust(){
  const s = (await loadJSON<unknown>("/data/status.json")) as { uptime: string; incidents: Incident[]; corrections: Correction[] };
  return (<div>
    <h1 className="font-extrabold">Trust</h1>
    <p className="mt-2 text-neutral-100">Integrity, methodology, uptime, corrections.</p>
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
      <section className="card p-4">
        <div className="font-semibold">Uptime</div>
        <div className="mt-2 text-emerald-300 text-lg">{s.uptime}</div>
        <ul className="mt-3 text-sm text-neutral-100 space-y-1">{s.incidents.map((i: Incident, idx: number) =><li key={idx}>• {i.date} — {i.title} <span className="text-zinc-500">({i.status})</span></li>)}</ul>
      </section>
      <section className="card p-4">
        <div className="font-semibold">Methodology</div>
        <ul className="mt-2 text-sm text-neutral-100 list-disc pl-5">
          <li>Every claim links to an explicit source (“receipt”).</li>
          <li>Ownership tagging from public filings; updates logged.</li>
          <li>Bias mix = relative weighting of source stances per cluster.</li>
        </ul>
      </section>
      <section className="card p-4">
        <div className="font-semibold">Corrections (append-only)</div>
        <ul className="mt-2 text-sm text-neutral-100 space-y-1">{s.corrections.map((c: Correction, i: number) =><li key={i}>• {c.date}: {c.item} — {c.action}</li>)}</ul>
      </section>
    </div>
  </div>);
}
