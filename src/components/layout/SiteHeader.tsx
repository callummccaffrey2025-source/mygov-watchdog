"use client";
import Link from "next/link";

const links = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" }
];

export default function SiteHeader() {
  return (
    <header className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
      <Link href="/" className="font-semibold tracking-tight text-xl">Verity</Link>
      <nav className="hidden md:flex gap-6">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:opacity-80">{l.label}</Link>
        ))}
      </nav>
      <div className="flex gap-3">
        <Link href="/open" className="underline">Open App</Link>
        <Link href="/join" className="rounded-lg border px-3 py-1">Join waitlist</Link>
      </div>
    </header>
  );
}
