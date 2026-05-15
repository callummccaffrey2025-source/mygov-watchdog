import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * ask-verity — RAG-powered political Q&A
 *
 * 1. Receives a user question
 * 2. Embeds it via OpenAI text-embedding-3-small
 * 3. KNN search against rag_chunks using pgvector
 * 4. Sends top chunks as context to Claude for answer generation
 * 5. Returns the answer with source citations
 */

const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const EMBEDDING_MODEL = "text-embedding-3-small";
const ANSWER_MODEL = "claude-haiku-4-5-20251001";
const MAX_CHUNKS = 12;

interface RequestBody {
  question: string;
  source_filter?: string; // optional: 'bill', 'hansard', 'donation', etc.
}

interface RagChunk {
  id: string;
  source_type: string;
  source_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { question, source_filter } = body;
  if (!question || question.trim().length < 5) {
    return new Response(
      JSON.stringify({ error: "Question must be at least 5 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Embed the question
    const embResponse = await fetch(OPENAI_EMBEDDING_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: question.slice(0, 4000),
        model: EMBEDDING_MODEL,
      }),
    });

    if (!embResponse.ok) {
      const err = await embResponse.text();
      console.error("Embedding failed:", err);
      return new Response(
        JSON.stringify({ error: "Failed to process question" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const embData = await embResponse.json();
    const queryEmbedding = embData.data[0].embedding;

    // 2. KNN search via pgvector
    const { data: chunks, error: searchError } = await supabase.rpc(
      "match_rag_chunks",
      {
        query_embedding: queryEmbedding,
        match_count: MAX_CHUNKS,
        filter_source_type: source_filter ?? null,
      }
    );

    if (searchError) {
      console.error("Vector search failed:", searchError);
      return new Response(
        JSON.stringify({ error: "Search failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const relevantChunks: RagChunk[] = (chunks ?? []).filter(
      (c: RagChunk) => c.similarity > 0.3
    );

    if (relevantChunks.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "I don't have enough information in my database to answer that question. " +
            "Try asking about specific bills, MPs, donations, government contracts, or party policies.",
          sources: [],
          chunks_searched: 0,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Build context for Claude
    const context = relevantChunks
      .map(
        (c, i) =>
          `[Source ${i + 1} — ${c.source_type}, similarity: ${c.similarity.toFixed(2)}]\n${c.content}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = `You are Verity AI, an Australian political intelligence assistant. You answer questions about Australian federal politics using ONLY the provided source data. You are factual, neutral, and cite your sources.

Rules:
- ONLY use information from the provided sources. Never fabricate data.
- Cite sources using [Source N] notation.
- If the sources don't contain enough information, say so clearly.
- Be concise but thorough. Use plain language.
- For financial data, always include dollar amounts and time periods.
- For voting data, specify how the MP voted and on which bill.
- Never express political opinions or bias.
- Format amounts in AUD with commas.`;

    // 4. Generate answer with Claude
    const claudeResponse = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANSWER_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Based on the following Australian political data sources, answer this question:\n\n**Question:** ${question}\n\n**Sources:**\n${context}`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      console.error("Claude API failed:", err);
      return new Response(
        JSON.stringify({ error: "Failed to generate answer" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeResponse.json();
    const answer =
      claudeData.content?.[0]?.text ?? "Unable to generate an answer.";

    // 5. Build source citations
    const sources = relevantChunks.map((c) => ({
      type: c.source_type,
      id: c.source_id,
      similarity: Math.round(c.similarity * 100),
      metadata: c.metadata,
    }));

    return new Response(
      JSON.stringify({
        answer,
        sources,
        chunks_searched: relevantChunks.length,
        model: ANSWER_MODEL,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ask-verity error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal error",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
