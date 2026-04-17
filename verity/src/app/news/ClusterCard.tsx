export function ClusterCard({
  title, summary, stance, count, updatedAt,
}: { title: string; summary: string; stance: "supportive" | "critical" | "neutral"; count: number; updatedAt: string }) {
  const accent = stance === "supportive" ? "bg-emerald-500" : stance === "critical" ? "bg-rose-500" : "bg-zinc-500";
  return (
    <a className="block rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accent}`} aria-hidden />
        <div className="text-sm text-zinc-400 capitalize">{stance}</div>
        <div className="ml-auto text-xs text-zinc-500">{count} stories · updated {updatedAt}</div>
      </div>
      <div className="mt-2 text-lg font-semibold">{title}</div>
      <p className="mt-1 text-sm text-zinc-300">{summary}</p>
    </a>
  );
}
