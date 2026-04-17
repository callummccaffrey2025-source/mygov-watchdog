export default function SiteHeader(){
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-emerald-300" />
          <span className="text-lg font-bold tracking-tight">Verity</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live beta
          </span>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-neutral-100 md:flex">
          <a className="hover:text-white" href="/#feed">News</a>
          <a className="hover:text-white" href="/mps">MPs</a>
          <a className="hover:text-white" href="/bills">Bills</a>
          <a className="hover:text-white" href="/pricing">Pricing</a>
          <a className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400" href="/join">Join for $1</a>
        </nav>
      </div>
    </header>
  );
}
