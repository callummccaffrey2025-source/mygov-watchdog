export default function Footer(){
  return (
    <footer className="mt-16 border-t border-white/10">
      <div className="container-verity py-10 text-sm text-white/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} Verity — Civic intelligence for Australia.</div>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-white">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
