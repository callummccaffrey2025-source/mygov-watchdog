"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function SearchHero() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (q: string) => {
    const query = q.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 p-4 md:p-6">
      <div className="relative">
        <input
          ref={inputRef}
          placeholder="Search bills, MPs, or topics…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950/40 px-4 py-3 pr-14 outline-none"
          onKeyDown={(e) => { if (e.key === "Enter") go((e.target as HTMLInputElement).value); }}
          aria-label="Search"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400">/</kbd>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["Privacy Act", "Digital ID", "Jane Hume", "Stage: Second Reading"].map((q) => (
          <button
            key={q}
            onClick={() => go(q)}
            className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-300 hover:border-zinc-700"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
