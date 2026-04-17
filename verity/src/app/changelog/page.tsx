const entries = [
  { name: "Bias bars v2", date: "2025-09-01", note: "Improved scale calibration & source coverage." },
  { name: "Bill diff viewer", date: "2025-08-15", note: "Semantic + line diffs for AU bills." },
  { name: "Ownership dataset (AU)", date: "2025-08-01", note: "Cross-linked outlet → parent mapping." },
];
export default function Changelog() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl md:text-4xl font-semibold text-zinc-100">Changelog</h1>
      <p className="mt-2 text-neutral-100">What changed and when.</p>
      <ul className="mt-8 space-y-4">
        {entries.map((e) => (
          <li key={e.name} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-medium text-zinc-100">{e.name}</h2>
              <time className="text-sm text-neutral-100">{e.date}</time>
            </div>
            <p className="mt-2 text-sm text-neutral-100">{e.note}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
