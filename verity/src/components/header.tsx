"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CommandPalette from "./command-palette";

const NAV = [
  { label: "Product", href: "/product" },
  { label: "Pricing", href: "/pricing" },
  { label: "Trust", href: "/trust" },
  { label: "Status", href: "/status" },
  { label: "Search", href: "/search" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => { setOpen(false); }, [pathname]);

  const LinkEl = ({ href, label }: { href: string; label: string }) => {
    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        prefetch
        aria-current={isActive ? "page" : undefined}
        onMouseEnter={() => router.prefetch(href)}
        className={[
          "rounded-md px-3 py-2 text-sm transition",
          isActive ? "bg-white/5 text-emerald-300" : "text-neutral-100 hover:bg-white/5"
        ].join(" ")}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <CommandPalette />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-black focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur supports-[backdrop-filter]:bg-black/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold text-emerald-300">Verity</Link>

          {/* desktop */}
          <nav className="hidden items-center gap-1 md:flex">
        <a href="/features" className="text-sm opacity-80 hover:opacity-100">Features</a>
            {NAV.map((n) => <LinkEl key={n.href} {...n} />)}
            <button
              className="ml-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 hover:bg-white/10"
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              title="Search (⌘K)"
              data-track="palette_open"
            >
              Search ⌘K
            </button>
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
