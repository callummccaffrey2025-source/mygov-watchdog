type Props = { title:string; subtitle?:string; href:string; img?:string; meta?:Record<string,string|number> };
export default function PreviewCard({ title, subtitle, href, img, meta }: Props) {
  return (
    <a href={href} className="group block rounded-2xl border border-zinc-800 p-4 hover:border-zinc-600 transition">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800">
        <div className="flex h-full w-full items-center justify-center text-zinc-600 text-sm tracking-wide">preview</div>
      </div>
      <div className="mt-3">
        <div className="text-base font-semibold">{title}</div>
        {subtitle ? <div className="text-sm text-neutral-100">{subtitle}</div> : null}
        {meta ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {Object.entries(meta).map(([k,v]) => <span key={k} className="rounded bg-zinc-900/60 px-2 py-0.5">{k}: {String(v)}</span>)}
          </div>
        ) : null}
      </div>
    </a>
  );
}
