type Story = {
  title: string; excerpt?: string; url: string;
  source: string; stance?: "left" | "center" | "right" | "neutral";
  published_at: string; tags?: string[];
};
function timeAgo(iso: string) {
  const dt = new Date(iso);
  const diff = Math.max(1, Math.floor((Date.now() - dt.getTime()) / 60000)); // minutes
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function StanceDot({ stance }: { stance?: Story["stance"] }) {
  const map: Record<NonNullable<Story["stance"]>, string> = {
    left: "#60a5fa", center: "#a1a1aa", right: "#f87171", neutral: "#22c55e",
  };
  const c = stance ? map[stance] : "#a1a1aa";
  return <span style={{ background: c }} className="inline-block w-2 h-2 rounded-full align-middle mr-1" />;
}
export default function NewsCard({ story }: { story: Story }) {
  return (
    <a href={story.url} className="block rounded-2xl border border-zinc-800 hover:border-emerald-700/60 transition p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs text-neutral-100 flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <StanceDot stance={story.stance} />
            <span className="uppercase tracking-wide">{story.source}</span>
          </span>
          <span>•</span>
          <span>{timeAgo(story.published_at)}</span>
        </div>
        {story.tags?.length ? (
          <div className="hidden sm:flex flex-wrap gap-2">
            {story.tags.map(t => (
              <span key={t} className="rounded bg-zinc-900/70 text-xs text-neutral-100 px-2 py-0.5">{t}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-base font-semibold">{story.title}</div>
      {story.excerpt ? <p className="mt-1 text-sm text-neutral-100">{story.excerpt}</p> : null}
    </a>
  );
}
