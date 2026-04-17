import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { getIndex } from "@/lib/pinecone";


export async function POST(req: NextRequest) {
  const { q, pageSize = 3 } = await req.json();
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const index = getIndex("verity-index");
  const queryRes = await index.query({
    topK: pageSize,
    vector: await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: q,
    }).then(r => r.data[0].embedding),
    includeMetadata: true,
  });

  const context = queryRes.matches.map(m => m.metadata?.text).join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are Verity, a political explainer. Cite sources." },
      { role: "user", content: `${q}\n\nContext:\n${context}` },
    ],
  });

  return NextResponse.json({
    answer: completion.choices[0].message.content,
    sources: queryRes.matches.map(m => m.metadata?.url),
  });
}
