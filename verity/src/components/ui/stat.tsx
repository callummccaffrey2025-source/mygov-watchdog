export function Stat({ label, value, suffix }: { label: string; value: number | null | undefined; suffix?: string }) {
  const show = typeof value === "number" && Number.isFinite(value);
  return (
    <div className="rounded-2xl border border-zinc-800 p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">
        {show ? `${value}${suffix ?? ""}` : "—"}
      </div>
    </div>
  );
}
