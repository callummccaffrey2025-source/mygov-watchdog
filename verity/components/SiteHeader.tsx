"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/news",  label: "News"  },
  { href: "/bills", label: "Bills" },
  { href: "/mps",   label: "MPs"   },
  { href: "/pricing", label: "Pricing" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-900/70 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
          <span className="font-semibold text-emerald-300">Verity</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {nav.map(({href,label}) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm ${active ? "text-emerald-300" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="hidden sm:inline-flex h-8 items-center rounded-full border border-zinc-800 px-3 text-xs text-zinc-400 hover:text-zinc-200"
          >
            ⌘K Search
          </Link>
          <Link
            href="/join"
            className="inline-flex h-8 items-center rounded-full bg-emerald-500/15 px-3 text-xs font-medium text-emerald-300 ring-1 ring-emerald-600/40 hover:bg-emerald-500/20"
          >
            Join
          </Link>
        </div>
      </div>
    </header>
  );
}
