export default function StatCard({
  label, value, hint,
}: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint ? <div className="text-xs text-neutral-500 mt-1">{hint}</div> : null}
    </div>
  );
}
