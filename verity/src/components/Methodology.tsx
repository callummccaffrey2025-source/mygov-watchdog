export type MethodologyItem = { label: string; value: string };
export default function Methodology({
  title = "Methodology",
  items = [],
  limitations = [],
  updated = "Recalculated periodically"
}: { title?: string; items?: MethodologyItem[]; limitations?: string[]; updated?: string }) {
  return (
    <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="grid gap-3">
        {items.map((it, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
            <div className="sm:w-48 text-neutral-400">{it.label}</div>
            <div className="flex-1">{it.value}</div>
          </div>
        ))}
      </div>
      {(limitations?.length ?? 0) > 0 && (
        <div className="mt-5">
          <div className="text-neutral-400 mb-1">Limitations</div>
          <ul className="list-disc pl-5 space-y-1">
            {limitations.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-4 text-sm text-neutral-400">Update cadence: {updated}</div>
    </section>
  );
}
