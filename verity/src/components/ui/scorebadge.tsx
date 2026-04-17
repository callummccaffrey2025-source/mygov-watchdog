export function ScoreBadge({ value, label }: { value?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-200">
      {label && <span className="text-zinc-400">{label}</span>}
      <span className="font-semibold">
        {Number.isFinite(value ?? NaN) ? Math.round(value as number) : "—"}
      </span>
    </span>
  );
}
