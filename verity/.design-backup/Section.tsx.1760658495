export default function Section({
  id, title, caption, children
}: { id: string; title: string; caption?: string; children: React.ReactNode }) {
  return (<section className="section z-card" className={`section ${typeof className!=="undefined"?className:""}`.trimEnd()}>
      <div className="card p-4 md:p-5">
        <header className="section-header">
          <div className="section-head"><h2 className="section-title" className="section-title">{title}</h2>{caption ? <span className="section-caption">{caption}</span> : null}</div>
          {caption ? <span className="text-xs text-white/60">{caption}</span> : null}
        </header>
        <div className="pt-4">
          <div className="p-3 sm:p-4 md:p-5">{children}</div>
        </div>
      </div>
    </section>
  );
}
