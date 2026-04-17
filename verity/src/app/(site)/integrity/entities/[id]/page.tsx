import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Entity = {
  id: string;
  name: string;
  type: string;
  jurisdiction?: string;
  caseCount?: number;
};
type Signal = { id: string; title: string; reason?: string; score?: number; citations?: any[] };
type Case = { id: string; title: string; status?: string; updated?: string; citations?: any[] };

async function originFromHeaders() {
  const h = headers();
  const host = (await h).get("x-forwarded-host") ?? (await h).get("host") ?? "localhost:3000";
  const proto = (await h).get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function getJSON<T = any>(path: string): Promise<T> {
  const base = originFromHeaders();
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${path}`);
  return res.json();
}

export default async function EntityPage({ params }: { params: { id: string } }) {
  const id = params.id;

  // fetch all three datasets (they're small in your seed; replace with filtered routes later)
  const [{ items: entities }, { items: cases }, { items: signals }] = await Promise.all([
    getJSON<{ items: Entity[] }>("/api/corruption/entities"),
    getJSON<{ items: Case[] }>("/api/corruption/cases"),
    getJSON<{ items: Signal[] }>("/api/corruption/signals"),
  ]);

  const entity = entities.find((e) => e.id === id);
  if (!entity) return notFound();

  // Your mock data doesn't actually link entity IDs in 'citations'.
  // Until you add real relations, show everything as sample, or leave empty.
  const relatedCases: Case[] = [];   // replace with real linking when available
  const relatedSignals: Signal[] = []; // replace with real linking when available

  // simple integrity score: caseCount*2 + avg(signal score)
  const casePoints = (entity.caseCount ?? relatedCases.length) * 2;
  const avgSignalScore =
    relatedSignals.length > 0
      ? relatedSignals.reduce((s, x) => s + (x.score ?? 0), 0) / relatedSignals.length
      : 0;
  const score = Math.round(casePoints + avgSignalScore);

  let label = "Good";
  if (score >= 6) label = "Critical";
  else if (score >= 3) label = "Concerning";

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{entity.name}</h1>
        <p className="text-slate-400">
          Type: {entity.type} • Jurisdiction: {entity.jurisdiction ?? "—"}
        </p>
      </div>

      <div className="p-4 rounded-lg bg-slate-800">
        <span className="text-xl font-semibold">Integrity Score: </span>
        <span
          className={`px-2 py-1 rounded ${
            label === "Critical"
              ? "bg-red-600"
              : label === "Concerning"
              ? "bg-yellow-600"
              : "bg-green-600"
          }`}
        >
          {label} ({score})
        </span>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-2">Related Cases</h2>
        {relatedCases.length ? (
          <ul className="space-y-2">
            {relatedCases.map((c) => (
              <li key={c.id} className="p-4 rounded-lg bg-slate-800">
                <div className="font-medium">{c.title}</div>
                <div className="text-sm text-slate-400">
                  Status: {c.status ?? "—"} • Updated: {c.updated ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">No related cases yet.</p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Related Signals</h2>
        {relatedSignals.length ? (
          <ul className="space-y-2">
            {relatedSignals.map((s) => (
              <li key={s.id} className="p-4 rounded-lg bg-slate-800">
                <div className="font-medium">{s.title}</div>
                <div className="text-sm text-slate-400">{s.reason ?? ""}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">No related signals yet.</p>
        )}
      </section>
    </div>
  );
}
