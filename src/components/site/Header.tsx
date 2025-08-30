"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const items = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function Header() {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const ids = items.map((i) => i.href.slice(1));
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (first) setActive(first.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: [0.1, 0.25, 0.5] }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-semibold">Verity</Link>
        <div className="hidden gap-6 md:flex">
          {items.map((i) => (
            <a
              key={i.href}
              href={i.href}
              className={`text-sm hover:text-zinc-900 ${
                active === i.href.slice(1) ? "text-zinc-900" : "text-zinc-600"
              }`}
            >
              {i.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ask" className="hidden rounded-lg border px-3 py-1.5 text-sm md:inline-flex">
            Open App
          </Link>
          <Link href="/account" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white">
            Join waitlist
          </Link>
        </div>
      </nav>
    </header>
  );
}
