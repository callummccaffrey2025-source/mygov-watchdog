"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/trust", label: "Trust" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const LinkEl = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href || pathname?.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`px-3 py-2 text-sm transition hover:text-emerald-300 ${
          active ? "text-emerald-300 underline underline-offset-4" : "text-neutral-300"
        }`}
        onClick={() => setOpen(false)}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-black focus:px-3 focus:py-2">
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur supports-[backdrop-filter]:bg-black/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold text-emerald-300">Verity</Link>

          {/* desktop */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => <LinkEl key={n.href} {...n} />)}
            <Link href="/join-waitlist" className="btn-primary ml-2 text-sm">Join waitlist</Link>
          </nav>

          {/* mobile */}
          <button
            aria-label="Menu"
            aria-expanded={open}
            className="md:hidden rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>

        {/* mobile sheet */}
        {open && (
          <div className="md:hidden border-t border-white/10 bg-black/70 p-2">
            <nav className="flex flex-col">
              {NAV.map((n) => <LinkEl key={n.href} {...n} />)}
              <Link href="/join-waitlist" className="btn-primary mt-1 text-center text-sm">Join waitlist</Link>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
