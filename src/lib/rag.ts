// src/lib/rag.ts
import { pineconeIndex } from "@/lib/pinecone";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function retrieve(query: string, opts?: { jurisdiction?: string; topK?: number }) {
  const topK = opts?.topK ?? 8;

  // 1) Embed the query
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const vector = emb.data[0].embedding;

  // 2) Pinecone nearest neighbours (with optional jurisdiction filter)
  let matches: Array<{ id?: string; score?: number; metadata?: Record<string, any> }> = [];
  try {
    const res = await pineconeIndex.query({
      topK,
      vector,
      includeMetadata: true,
      filter: opts?.jurisdiction ? { jurisdiction: { $eq: opts.jurisdiction } } : undefined,
    });
    matches = res.matches ?? [];
  } catch {
    matches = [];
  }

  // If pinecone has nothing, fall back to trigram LIKE in Supabase
  if (!matches.length) {
    const { data } = await supabaseAdmin
      .from("document")
      .select("id,title,url,content,published_at")
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order("published_at", { ascending: false })
      .limit(topK);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      title: d.title,
      url: d.url,
      content: d.content,
      published_at: d.published_at,
      score: null,
    }));
  }

  // 3) Fetch the underlying docs from Supabase (dedupe doc_ids from metadata)
  const docIds = Array.from(
    new Set(
      matches
        .map((m) => (m.metadata as any)?.doc_id || (m.metadata as any)?.id || m.id)
        .filter(Boolean)
    )
  );

  if (!docIds.length) return [];

  const { data: docs, error } = await supabaseAdmin
    .from("document")
    .select("id,title,url,content,published_at")
    .in("id", docIds)
    .limit(topK);

  if (error) return [];
  // return in pinecone order
  const byId = new Map(docs.map((d: any) => [String(d.id), d]));
  return matches
    .map((m) => {
      const did = String((m.metadata as any)?.doc_id || (m.metadata as any)?.id || m.id);
      const d = byId.get(did);
      if (!d) return null;
      return {
        id: d.id,
        title: d.title,
        url: d.url,
        content: d.content,
        published_at: d.published_at,
        score: m.score ?? null,
      };
    })
    .filter(Boolean) as any[];
}

export function buildPrompt(question: string, docs: Array<{ title?: string; url?: string; content?: string }>) {
  const context = docs
    .slice(0, 6)
    .map((d, i) => `### Doc ${i + 1}\nTitle: ${d.title}\nURL: ${d.url}\nContent:\n${(d.content || "").slice(0, 2000)}`)
    .join("\n\n");
  return [
    { role: "system", content: "You are Verity’s civic analyst. Answer with strict factual precision. If unsure, say so." },
    {
      role: "user",
      content:
        `Question:\n${question}\n\nContext (excerpts from official sources):\n${context}\n\nInstructions:\n- Cite sources inline as [n] matching the doc numbers.\n- If context is insufficient, say what’s missing.`,
    },
  ] as const;
}

