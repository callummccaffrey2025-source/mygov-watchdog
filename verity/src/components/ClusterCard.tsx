type Cluster = {
  id: string;
  title: string;
  stance?: "Supportive" | "Critical" | "Neutral" | string;
  storyCount?: number;
  summary?: string;
  tags?: string[];
};

const stanceCls = {
  Supportive: "bg-emerald-500/20 text-emerald-300 border-emerald-600/30",
  Critical:   "bg-rose-500/20 text-rose-300 border-rose-600/30",
  Neutral:    "bg-zinc-500/20 text-zinc-300 border-zinc-600/30",
} as const;

export default function ClusterCard({ cluster }: { cluster: Cluster }) {
  const stance = (cluster.stance as "Supportive" | "Critical" | "Neutral") ?? "Neutral";
  const cls = stanceCls[stance] ?? stanceCls.Neutral;
  const count = typeof cluster.storyCount === "number" ? cluster.storyCount : 0;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold">{cluster.title}</h3>
        <span
          data-testid="stance-pill"
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${cls}`}
          role="status"
          aria-label={`Stance: ${stance}`}
        >
          {stance}
        </span>
      </div>

      <div className="mt-1 text-xs text-zinc-400">
        {count} {count === 1 ? "story" : "stories"}
      </div>

      {cluster.summary ? (
        <p className="mt-2 text-sm text-zinc-300">{cluster.summary}</p>
      ) : null}

      {cluster.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {cluster.tags.map((t) => (
            <span key={t} className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs">{t}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
