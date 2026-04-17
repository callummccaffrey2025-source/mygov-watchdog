export default function Nav(){
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" className="font-semibold tracking-wide text-brand">VERITY</a>
        <div className="flex gap-5 text-sm">
          <a href="/mps" className="hover:text-brand">MPs</a>
          <a href="/bills" className="hover:text-brand">Bills</a>
          <a href="/news" className="hover:text-brand">News</a>
          <a href="/pricing" className="hover:text-brand">Pricing</a>
          <a href="/join" className="rounded-lg bg-brand px-3 py-1.5 text-ink hover:shadow-soft">Join</a>
        </div>
      </nav>
    </header>
  );
}
