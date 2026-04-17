"use client";
import { useState } from "react";

export default function AskPage() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onAsk() {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query }),
      });
      const json = await res.json();
      setAnswer(json?.answer ?? "No answer.");
    } catch {
      setAnswer("Ask failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold">Ask</h1>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What does the bill do?"
          className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-3 outline-none"
        />
        <button
          onClick={onAsk}
          disabled={busy}
          className="rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5 disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Ask"}
        </button>
      </div>
      {answer && (
        <article className="rounded-xl border border-white/10 p-4 whitespace-pre-wrap leading-relaxed">
          {answer}
        </article>
      )}
    </main>
  );
}
