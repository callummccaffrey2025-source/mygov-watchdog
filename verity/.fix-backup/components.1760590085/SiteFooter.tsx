export default function SiteFooter(){
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-10 text-sm text-zinc-500">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded bg-gradient-to-tr from-emerald-500 to-emerald-300" />
            <strong>Verity</strong>
          </div>
          <p className="mt-2 text-xs">AI-powered civic intelligence for Australia.</p>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-neutral-100">Product</div>
          <a className="block hover:text-white" href="/#feed">Feed</a>
          <a className="block hover:text-white" href="/mps">MPs</a>
          <a className="block hover:text-white" href="/bills">Bills</a>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-neutral-100">Company</div>
          <a className="block hover:text-white" href="/pricing">Pricing</a>
          <a className="block hover:text-white" href="#">Terms</a>
          <a className="block hover:text-white" href="#">Privacy</a>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-7xl text-xs">© 2025 Verity. All rights reserved.</p>
    </footer>
  );
}
