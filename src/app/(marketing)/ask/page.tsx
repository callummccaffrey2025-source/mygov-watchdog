"use client";
import { useState } from "react";

export default function AskPage() {
  const [q, setQ] = useState("");
  const [a, setA] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setA(null); setErr(null);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Request failed");
      setA(j.answer || "");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Ask Verity</h1>
      <form className="mt-6 flex gap-2" onSubmit={onAsk}>
        <input className="flex-1 border rounded-lg px-3 py-2" value={q} onChange={e=>setQ(e.target.value)} placeholder="e.g., What did the 2024 federal budget change for first-home buyers?" />
        <button className="rounded-lg border px-4 py-2" disabled={loading || !q.trim()}>{loading ? "Thinking..." : "Ask"}</button>
      </form>
      {err && <p className="mt-4 text-red-600">{err}</p>}
      {a !== null && !err && <div className="mt-6 rounded-2xl border p-4 whitespace-pre-wrap">{a || "No answer."}</div>}
    </div>
  );
}
