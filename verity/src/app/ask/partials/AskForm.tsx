"use client";
import { useState } from "react";

export default function AskForm() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q.trim() })
      });
      const json = await res.json().catch(() => ({} as any));
      setAnswer(json?.answer ?? "No answer returned.");
    } catch (err) {
      setAnswer("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about a bill, policy, or politician…"
          className="w-full border px-3 py-2 rounded"
        />
        <button type="submit" className="border px-4 py-2 rounded" disabled={loading}>
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>
      {answer && (
        <div className="mt-4 border rounded p-3 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
