"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SEARCH_INDEX } from "@/lib/searchIndex";

type Item = (typeof SEARCH_INDEX)[number];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [items, setItems] = useState<Item[]>(SEARCH_INDEX.slice(0, 30));
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Toggle palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen(v => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else { setQ(""); setIdx(0); setItems(SEARCH_INDEX.slice(0, 30)); setLoading(false); }
  }, [open]);

  // Debounced server search with local fallback
  useEffect(() => {
    if (!open) return;
    const s = q.trim();
    if (!s) { setItems(SEARCH_INDEX.slice(0, 30)); setLoading(false); return; }

    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(s)}&limit=30`, { cache: "no-store" });
        if (r.ok) {
          const { items } = await r.json();
          setItems(items as Item[]);
          setIdx(0);
        } else {
          // fallback
          const S = s.toLowerCase();
          setItems(SEARCH_INDEX.filter(i => (i.title + " " + (i.group || "")).toLowerCase().includes(S)).slice(0, 30));
        }
      } catch {
        const S = s.toLowerCase();
        setItems(SEARCH_INDEX.filter(i => (i.title + " " + (i.group || "")).toLowerCase().includes(S)).slice(0, 30));
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  // Keep idx in range
  useEffect(() => { if (idx >= items.length) setIdx(0); }, [items.length, idx]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur" role="dialog" aria-modal="true">
      <div className="mx-auto mt-24 w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-950/90 shadow-xl">
        <div className="border-b border-white/10 p-3">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages and sections…"
            className="w-full bg-transparent outline-none placeholder-neutral-500"
            aria-label="Search"
          />
        </div>
        <ul
          className="max-h-[60vh] overflow-auto p-2"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && items[idx]) { go(items[idx].href); }
          }}
        >
          {items.length === 0 && <li className="p-3 text-neutral-500">{loading ? "Searching…" : "No results"}</li>}
          {items.map((it, i) => (
            <li
              key={it.href + i}
              onMouseEnter={() => setIdx(i)}
              onClick={() => go(it.href)}
              className={`cursor-pointer rounded-md px-3 py-2 ${i === idx ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <div className="text-neutral-100">{it.title}</div>
              {it.group && <div className="text-xs text-neutral-500">{it.group}</div>}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-xs text-neutral-500">
          <div>{loading ? "Searching…" : "Enter to open • Esc to close"}</div>
          <div>⌘K / Ctrl-K</div>
        </div>
      </div>
    </div>
  );
}
