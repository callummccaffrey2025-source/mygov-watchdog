// app/api/ask/route.ts
import { NextRequest } from "next/server";
import { openai } from "@/lib/openai";
import { retrieve, buildPrompt } from "@/lib/rag";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { question, jurisdiction } = await req.json().catch(() => ({}));
  if (!question || typeof question !== "string") {
    return new Response(JSON.stringify({ error: "question required" }), { status: 400 });
  }

  // RAG retrieve
  const docs = await retrieve(question, { jurisdiction, topK: 8 });
  const messages = buildPrompt(question, docs);

  // Stream response
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    stream: true,
    temperature: 0.1,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const token = chunk.choices?.[0]?.delta?.content ?? "";
          if (token) controller.enqueue(encoder.encode(token));
        }
        // Append sources footer once
        if (docs.length) {
          const src = "\n\nSources: " + docs.slice(0, 6).map((d, i) => `[${i + 1}] ${d.title || d.url}`).join("  ");
          controller.enqueue(encoder.encode(src));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}


