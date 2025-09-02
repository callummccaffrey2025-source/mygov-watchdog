"use client";
import { useEffect, useMemo, useState } from "react";

type Kind = "bill" | "hansard" | "vote" | "budget" | "interests";
type Result = { id: string; kind: Kind; title: string; date: string; url: string; body: string; };
type Clarifier = { text: string; append: string };

export default function AskPage() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [mode, setMode] = useState<"idle"|"clarify"|"answer"|"error">("idle");
  const [clarify, setClarify] = useState<Clarifier[]>([]);
  const [sources, setSources] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("pageSize", "3");
    return p.toString();
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) { setSources([]); return; }
      fetch(`/api/search?${qs}`)
        .then(r => r.json())
        .then(j => setSources(j.results || []))
        .catch(() => setSources([]));
    }, 250);
    return () => clearTimeout(t);
  }, [qs, q]);

  async function onAsk(e?: React.FormEvent) {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;

    setLoading(true); setMode("idle"); setAnswer(""); setClarify([]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: query })
      });
      const data = await res.json();
      if (data?.type === "clarify") {
        setMode("clarify"); setAnswer(data.answer || ""); setClarify(data.clarify || []);
      } else if (data?.type === "answer") {
        setMode("answer"); setAnswer(data.answer || "No answer.");
      } else { setMode("error"); setAnswer("Unexpected response."); }
    } catch {
      setMode("error"); setAnswer("Ask failed. Check your network and try again.");
    } finally { setLoading(false); }
  }

  function pickClarifier(c: Clarifier) {
    const next = (q + c.append).replace(/\s+/g, " ").trim();
    setQ(next);
    setTimeout(() => onAsk(), 0);
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Ask Verity</h1>

      <form onSubmit={onAsk} className="mt-6 flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="e.g., Federal Budget 2024–25 energy rebates"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="border rounded-lg px-4 py-2" disabled={loading || !q.trim()}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {mode !== "idle" && (
        <div className="mt-4 rounded-2xl border p-4">
          <p className="text-sm">{answer}</p>
          {mode === "clarify" && clarify?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {clarify.map(c => (
                <button key={c.text} onClick={() => pickClarifier(c)}
                        className="text-sm border rounded-full px-3 py-1 hover:bg-black hover:text-white transition">
                  {c.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium opacity-70">Top sources</h2>
          <ul className="mt-3 space-y-3">
            {sources.map(s => (
              <li key={s.id} className="rounded-xl border p-3">
                <div className="text-xs opacity-60 flex gap-2">
                  <span className="uppercase">{s.kind}</span>
                  <span>•</span>
                  <time dateTime={s.date}>{new Date(s.date).toLocaleDateString()}</time>
                </div>
                <a className="block mt-0.5 underline-offset-2 hover:underline" href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                <p className="text-sm opacity-80 mt-1">{s.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
