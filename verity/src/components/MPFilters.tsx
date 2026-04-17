export default function MPFilters() {
  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-zinc-400">Party</label>
        <select className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1">
          <option value="">All</option>
          <option>Liberal</option>
          <option>Labor</option>
          <option>Greens</option>
          <option>Independent</option>
        </select>
        <label className="ml-3 text-zinc-400">State</label>
        <select className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1">
          <option value="">All</option>
          <option>NSW</option><option>VIC</option><option>QLD</option><option>WA</option><option>SA</option><option>TAS</option><option>ACT</option><option>NT</option>
        </select>
      </div>
    </div>
  );
}
