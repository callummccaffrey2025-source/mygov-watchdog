export default function Empty({
  title="Nothing here yet", body="Check back soon — we refresh data frequently.", actionHref, actionLabel
}: { title?: string; body?: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="card p-4 text-sm">
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-white/70">{body}</p>
      {actionHref && actionLabel ? (
        <a href={actionHref} className="mt-2 inline-block rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/15">
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}
