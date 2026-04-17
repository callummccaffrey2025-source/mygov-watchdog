import Link from "next/link";
import type { ReactNode } from "react";

import { getSiteUrl } from "@/lib/env";

const navItems = [
  { href: "/news", label: "News" },
  { href: "/legislation", label: "Bills" },
  { href: "/mps", label: "MPs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/search", label: "Search" },
  { href: "/join", label: "Join" },
];

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Verity",
  description: "Track real legislation in plain English.",
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col">
      <header className="w-full border-b border-zinc-800 bg-black/70 backdrop-blur px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-semibold text-white hover:text-emerald-400"
        >
          <span aria-hidden="true" className="text-emerald-400">
            |||
          </span>
          Verity
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-zinc-400">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-emerald-400 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-800 px-6 py-6 text-center text-xs text-zinc-500">
        © 2025 Verity — Built for Australians
      </footer>
    </div>
  );
}
