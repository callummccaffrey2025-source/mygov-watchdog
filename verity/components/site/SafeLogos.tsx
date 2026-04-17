'use client';
import Link from "next/link";

/** Small, robust "as seen in" strip with text badges (swap for logos later). */
export default function SafeLogos() {
  const items = [
    { label: "ABC", href: "https://www.abc.net.au" },
    { label: "SBS", href: "https://www.sbs.com.au" },
  ];
  return (
    <section aria-label="As seen in" className="mt-8 space-y-3">
      <div className="text-sm text-zinc-400">As seen in</div>
      <div className="flex gap-3">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
