"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = { id: string; name: string; url: string; jurisdiction: string; type: string; created_at?: string };

const PAGE = 25;

export default function SourcesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  async function load(p = 0) {
    setLoading(true);
    try {
      const from = p * PAGE;
      const to = from + PAGE - 1;
      const { data, error, count } = await supabase
        .from("source")
        .select("id,name,url,jurisdiction,type,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      const newRows = (data || []) as Row[];
      if (p === 0) setRows(newRows); else setRows(prev => [...prev, ...newRows]);
      setHasMore((count ?? 0) > to + 1);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    const res = await fetch(`/api/source/${id}`, { method: "DELETE" });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const text = await res.text();
    const data = isJson && text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  }

  useEffect(() => { load(0); }, []);

  return (
    <main className="mx-auto max-w-3xl py-10">
      <h1 className="text-2xl font-semibold">Sources</h1>
      {err && <p className="mt-4 text-sm text-red-600">Error: {err}</p>}
      <ul className="mt-6 space-y-3">
        {rows.map(r => (
          <li key={r.id} className="rounded-md border p-3">
            <div className="font-medium">{r.name}</div>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
              {r.url}
            </a>
            <div className="text-sm mt-1">Jurisdiction: {r.jurisdiction} • Type: {r.type}</div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-gray-500">{r.id}</span>
              <button
                onClick={async () => {
                  try { await del(r.id); setRows(rows.filter(x => x.id !== r.id)); }
                  catch (e: any) { setErr(e.message); }
                }}
                className="ml-auto rounded border px-2 py-1 text-xs hover:bg-gray-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={() => { const p = page + 1; setPage(p); load(p).catch(e => setErr(e.message)); }}
          disabled={loading}
          className="mt-4 rounded bg-gray-200 px-3 py-1 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
