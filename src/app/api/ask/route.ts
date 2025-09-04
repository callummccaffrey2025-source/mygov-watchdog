import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { openai } from "../../../lib/openai";
import { getIndex } from "../../../lib/pinecone";

type Meta = { title?: string; url?: string; date?: string; text?: string };

export async function POST(req: Request) {
  try {
    const { q, pageSize = 3 } = await req.json().catch(() => ({ q: "" }));
    if (!q || typeof q !== "string") {
      return NextResponse.json({ error: "Missing \\"q\\" string" }, { status: 400 });
    }

    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: q,
    });
    const vector = data[0].embedding;

    const index = getIndex();
    const search = await index.query({
      vector,
      topK: Math.max(1, Math.min(10, Number(pageSize) || 3)),
      includeMetadata: true,
    });

    const sources = (search.matches ?? []).map((m, i) => {
      const md = (m.metadata ?? {}) as Meta;
      return {
        id: m.id,
        rank: i + 1,
        score: m.score,
        title: md.title ?? "Untitled",
        url: md.url ?? "",
        date: md.date ?? "",
        snippet: md.text ?? "",
      };
    });

    const context = sources
      .map(s => \`[\${s.rank}] \${s.title}\n\${s.snippet}\nURL: \${s.url}\${s.date ? \`\\nDATE: \${s.date}\` : ""}\`)
      .join("\\n\\n");

    const sys =
      "You are Verity, an Australian politics assistant. Answer using ONLY the provided context. " +
      "If uncertain or missing detail, say what’s missing and ask for clarification. " +
      "Cite sources inline with bracketed numbers like [1], [2]. Keep it brief.";

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: \`Question: \${q}\\n\\nContext:\\n\${context}\` },
      ],
    });

    const answer =
      chat.choices?.[0]?.message?.content?.trim() ||
      "I couldn’t find enough context to answer. Try being more specific.";

    return NextResponse.json({ answer, sources });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
