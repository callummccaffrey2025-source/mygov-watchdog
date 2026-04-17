export function DashboardEmpty() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 p-6 text-center">
      <h2 className="text-xl font-semibold">Personalize your feed</h2>
      <p className="mt-1 text-zinc-400">Pick a few topics and your local MPs to get started.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["Digital ID", "Cost of living", "Energy", "Privacy"].map((t) => (
          <button key={t} className="rounded-full border border-zinc-800 px-3 py-1 text-sm hover:border-zinc-700">
            {t}
          </button>
        ))}
      </div>
      <a href="/personalise" className="mt-4 inline-block rounded-xl border border-zinc-700 px-4 py-2 hover:border-zinc-600">
        Open Personalise
      </a>
    </div>
  );
}
