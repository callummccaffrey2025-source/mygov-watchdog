export default function HowItWorks() {
  const steps = [
    { t: "Track bills live", d: "We monitor readings, committees, and changes as they happen." },
    { t: "Know your MP", d: "See voting history and positions in one place." },
    { t: "Get alerts", d: "Email alerts when a bill you follow moves." },
  ];
  return (
    <section className="mt-14 rounded-2xl border border-zinc-800 p-6">
      <h2 className="text-lg font-medium text-zinc-100">How it works</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.t} className="rounded-xl border border-zinc-800 p-4">
            <div className="text-emerald-300">{s.t}</div>
            <p className="mt-1 text-sm text-zinc-400">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
