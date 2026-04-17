export default function Stats({
  items,
}: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((s) => (
        <div key={s.label} className="card p-5 text-center">
          <div className="text-3xl font-bold tracking-tight">{s.value}</div>
          <div className="mt-1 text-sm text-neutral-100">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
