import clsx from "clsx";
export function VotePill({ vote }: { vote?: string }) {
  const v = (vote||"").toLowerCase();
  const color =
    v.startsWith("aye") || v.startsWith("yes") ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40" :
    v.startsWith("no")  || v.startsWith("nay") ? "bg-rose-600/20 text-rose-300 border-rose-500/40" :
    "bg-zinc-600/20 text-zinc-300 border-zinc-500/40";
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs border", color)}>{vote||"—"}</span>;
}

export function LabelValue({ icon, label, children }: { icon?: React.ReactNode, label: string, children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2" aria-label={label}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-zinc-400">{label}</div>
        <div className="text-sm text-zinc-100">{children || <span className="text-zinc-500">—</span>}</div>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 p-4">
      <h2 className="text-sm font-medium text-zinc-300 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function SafeLink({ href, children, className }: { href?: string; children: React.ReactNode; className?: string }) {
  if (!href) return <span className={className}>{children}</span>;
  return <a href={href} className={clsx("hover:underline", className)}>{children}</a>;
}
