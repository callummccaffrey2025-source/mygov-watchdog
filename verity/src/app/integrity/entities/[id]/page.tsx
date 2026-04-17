import { notFound } from "next/navigation";

async function fetchEntity(id: string) {
  const res = await fetch(`http://localhost:3000/api/corruption/entities`, { cache: "no-store" });
  const data = await res.json();
  return data.items.find((e: any) => e.id === id);
}

async function fetchCases(id: string) {
  const res = await fetch(`http://localhost:3000/api/corruption/cases`, { cache: "no-store" });
  const data = await res.json();
  return data.items.filter((c: any) => c.citations.includes(id));
}

async function fetchSignals(id: string) {
  const res = await fetch(`http://localhost:3000/api/corruption/signals`, { cache: "no-store" });
  const data = await res.json();
  return data.items.filter((s: any) => s.citations.includes(id));
}

export default async function EntityPage({ params }: { params: { id: string } }) {
  const entity = await fetchEntity(params.id);
  if (!entity) return notFound();

  const cases = await fetchCases(params.id);
  const signals = await fetchSignals(params.id);

  // simple scoring: cases*2 + avg(signal score)
  const casePoints = cases.length * 2;
  const avgSignalScore =
    signals.length > 0
      ? signals.reduce((sum: number, s: any) => sum + s.score, 0) / signals.length
      : 0;
  const score = casePoints + avgSignalScore;

  let label = "Good";
  if (score >= 6) label = "Critical";
  else if (score >= 3) label = "Concerning";

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-8">
      <h1 className="text-3xl font-bold">{entity.name}</h1>
      <p className="text-slate-400">
        Type: {entity.type} • Jurisdiction: {entity.jurisdiction}
      </p>

      <div className="p-4 rounded-lg bg-slate-800">
        <span className="text-xl font-semibold">Integrity Score:</span>{" "}
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
        {cases.length ? (
          <ul className="space-y-2">
            {cases.map((c: any) => (
              <li key={c.id} className="p-4 rounded-lg bg-slate-800">
                <div className="font-medium">{c.title}</div>
                <div className="text-sm text-slate-400">
                  Status: {c.status} • Updated: {c.updated}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">No related cases.</p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Related Signals</h2>
        {signals.length ? (
          <ul className="space-y-2">
            {signals.map((s: any) => (
              <li key={s.id} className="p-4 rounded-lg bg-slate-800">
                <div className="font-medium">{s.title}</div>
                <div className="text-sm text-slate-400">{s.reason}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">No related signals.</p>
        )}
      </section>
    </div>
  );
}
