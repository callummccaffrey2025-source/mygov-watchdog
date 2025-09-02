// src/app/api/ask/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { pineconeIndex } from "@/lib/pinecone";
import { supaAdmin } from "@/lib/supabaseAdmin";

// Important: we use the service role (server-only), so force Node runtime
export const runtime = "nodejs";
// (Optional) keep long calls from hanging forever
export const maxDuration = 30;

const Body = z.object({
  question: z.string().min(4, "question too short").max(2000, "question too long"),
  jurisdiction: z.string().trim().toLowerCase().optional(), // e.g., "nsw", "federal"
});

// Hard limits to keep payloads & tokens in check
const TOP_K = 8 as const;
const MAX_CONTEXT_CHARS = 16_000; // ~4k tokens-ish; adjust to your model context
const MAX_DOC_EXCERPT = 2_000;

function clip(s: string, n: number) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n) + "…";
}

export async function POST(req: NextRequest) {
  try {
    // 1) Validate input
    const json = await req.json();
    const { question, jurisdiction } = Body.parse(json);

    // 2) Embed query
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const vector = emb.data?.[0]?.embedding;
    if (!vector) {
      return NextResponse.json({ error: "embedding failed" }, { status: 502 });
    }

    // 3) Vector search (Pinecone v6-style flat args)
    const filter = jurisdiction ? { jurisdiction: { $eq: jurisdiction } } : undefined;
    const pcRes = await pineconeIndex.query({
      topK: TOP_K,
      vector,
      includeMetadata: true,
      filter,
    });

    const matches = pcRes?.matches ?? [];
    const docIds = Array.from(
      new Set(
        matches
          .map((m) => (m?.metadata as Record<string, unknown> | undefined)?.doc_id)
          .filter((x): x is string => typeof x === "string" && x.length > 0),
      ),
    );

    // 4) If we didn’t retrieve any document IDs, return early with context for the UI
    if (docIds.length === 0) {
      return NextResponse.json({
        answer: "I don’t have enough supporting documents to answer confidently.",
        references: [],
        debug: {
          topK: TOP_K,
          jurisdiction: jurisdiction ?? null,
          matches: matches.map((m) => ({ id: m.id, score: m.score })),
        },
      });
    }

    // 5) Fetch doc rows
    const { data: docs, error: docErr } = await supaAdmin
      .from("document")
      .select("id,title,content,url")
      .in("id", docIds);

    if (docErr) {
      return NextResponse.json({ error: `document fetch failed: ${docErr.message}` }, { status: 502 });
    }

    const safeDocs = (docs ?? []).map((d) => ({
      id: d.id,
      title: d.title ?? "Untitled",
      url: d.url ?? null,
      content: clip(d.content ?? "", MAX_DOC_EXCERPT),
    }));

    // Build bounded context
    let context = "";
    for (const d of safeDocs) {
      const block =
        `TITLE: ${d.title}\nURL: ${d.url ?? "N/A"}\n` +
        `${d.content}\n---\n`;
      if (context.length + block.length > MAX_CONTEXT_CHARS) break;
      context += block;
    }

    // 6) If context is still empty (e.g., docs exist but no content), fail gracefully
    if (!context.trim()) {
      return NextResponse.json({
        answer: "I found related documents but they lack extractable content.",
        references: safeDocs.map((d) => d.url).filter(Boolean),
        debug: { docIds, topK: TOP_K },
      });
    }

    // 7) Ask the model (constrained to provided context)
    const system =
      "You are Verity, an Australian political watchdog. Only use the provided CONTEXT. " +
      "Be concise and precise, cite facts conservatively. End with a short 'Key sources' list of URLs, if any.";
    const user = `QUESTION: ${question}\n\nCONTEXT:\n${context}`;

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    });

    const answer = chat.choices?.[0]?.message?.content?.trim() || "No answer.";

    return NextResponse.json({
      answer,
      references: safeDocs.map((d) => d.url).filter(Boolean),
      debug: {
        topK: TOP_K,
        jurisdiction: jurisdiction ?? null,
        usedDocs: safeDocs.map((d) => ({ id: d.id, title: d.title, url: d.url })),
      },
    });
  } catch (e: unknown) {
    // Surface zod, OpenAI, Pinecone, or Supabase errors clearly
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : "ask failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
