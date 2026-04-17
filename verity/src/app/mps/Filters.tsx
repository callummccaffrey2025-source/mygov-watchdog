export function MPFilters() {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {["All parties", "Labor", "Liberal", "Greens"].map((p) => (
        <button key={p} className="rounded-full border border-zinc-800 px-3 py-1 text-sm hover:border-zinc-700">
          {p}
        </button>
      ))}
      {["All states", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map((s) => (
        <button key={s} className="rounded-full border border-zinc-800 px-3 py-1 text-sm hover:border-zinc-700">
          {s}
        </button>
      ))}
    </div>
  );
}
