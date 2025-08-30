'use client';

import { useState } from 'react';

export default function AskPage() {
  const [q, setQ] = useState('What changed in the Safeguard Mechanism reforms?');
  const [jurisdiction, setJurisdiction] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setAnswer(null); setLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q.trim(), jurisdiction: jurisdiction.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');
      setAnswer(data?.answer || 'No answer.');
    } catch (e:any) {
      setErr(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Ask Verity</h1>
      <form onSubmit={onAsk} className="space-y-3">
        <textarea
          value={q}
          onChange={e=>setQ(e.target.value)}
          rows={4}
          className="w-full rounded border px-3 py-2"
          placeholder="Ask about a bill, reform, MP, or regulator decision..."
          required
        />
        <input
          value={jurisdiction}
          onChange={e=>setJurisdiction(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="jurisdiction (optional, e.g., AU, NSW, VIC)"
        />
        <button
          disabled={loading}
          className="px-4 py-2 rounded bg-zinc-900 text-white disabled:opacity-60"
        >
          {loading ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      {err && <div className="rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2">{err}</div>}
      {answer && (
        <div className="rounded border bg-white px-4 py-3 leading-7 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
