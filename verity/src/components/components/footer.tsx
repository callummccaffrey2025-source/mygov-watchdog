import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-black/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="font-semibold text-emerald-300">Verity</div>
          <p className="mt-2 text-sm text-neutral-400">Transparency for Australia.</p>
        </div>
        <div className="text-sm">
          <div className="font-medium text-neutral-200">Product</div>
          <ul className="mt-2 space-y-1 text-neutral-400">
            <li><Link href="/product">Overview</Link></li>
            <li><Link href="/pricing">Pricing</Link></li>
            <li><Link href="/compare/theyvoteforme">Compare</Link></li>
            <li><Link href="/roadmap">Roadmap</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="font-medium text-neutral-200">Company</div>
          <ul className="mt-2 space-y-1 text-neutral-400">
            <li><Link href="/trust">Trust</Link></li>
            <li><Link href="/integrity">Integrity</Link></li>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/contact">Contact</Link></li>
            <li className="mt-2"><Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} Verity
      </div>
    </footer>
  );
}
