'use client';
import Link from "next/link";
import { Menu } from "lucide-react";
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-[-0.02em]">Verity</Link>
        <nav className="hidden md:flex gap-6 text-sm text-white/80">
          <Link href="/ask" className="hover:text-white">Ask</Link>
          <Link href="/search" className="hover:text-white">Search</Link>
          <Link href="/sources" className="hover:text-white">Sources</Link>
          <Link href="/docs" className="hover:text-white">Docs</Link>
          <Link href="/crawl" className="hover:text-white">Admin</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/me" className="px-3 py-1.5 text-sm rounded-md border border-white/15 hover:bg-white/5">Sign in</Link>
          <Link href="/ask" className="px-3 py-1.5 text-sm rounded-md bg.white text-black hover:bg-white/90">Get started</Link>
          <button className="md:hidden p-2" aria-label="Menu"><Menu size={18}/></button>
        </div>
      </div>
    </header>
  );
}
