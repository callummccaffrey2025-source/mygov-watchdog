"use client";

import { useState } from "react";

export default function SearchPage() {
  const [q, setQ] = useState("");

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Search</h1>
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Try 'preferential voting' or 'climate disclosure'..."
        className="bg-black text-white border border-zinc-700 rounded px-3 py-2 w-full max-w-md text-sm outline-none focus:border-emerald-400"
      />
      <p className="text-zinc-400 text-sm">
        (Coming soon) We’ll search current bills, explain what they mean, and tell you which MPs are backing them.
      </p>
    </main>
  );
}

export const dynamic = "force-dynamic";
