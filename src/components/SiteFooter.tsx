export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-10 text-sm text-white/60">
      <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 justify-between">
        <div>
          <div className="font-semibold text-white">Verity</div>
          <div className="text-xs">Evidence-first civic intelligence</div>
        </div>
        <nav className="flex gap-6">
          <a href="/privacy" className="hover:text-white">Privacy</a>
          <a href="/terms" className="hover:text-white">Terms</a>
          <a href="/press" className="hover:text-white">Press kit</a>
        </nav>
      </div>
    </footer>
  );
}
