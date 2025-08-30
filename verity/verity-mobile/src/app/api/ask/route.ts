export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { index } from "@/lib/pinecone";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";

export async function POST(req: Request){
  const { question, jurisdiction } = await req.json();
  if(!question) return NextResponse.json({ error:"question required" }, { status:400 });

  const qemb = await openai.embeddings.create({ model:"text-embedding-3-small", input: question });
  const query = await index.query({
    topK: 8,
    vector: qemb.data[0].embedding as number[],
    includeMetadata: true,
    filter: jurisdiction ? { jurisdiction: { $eq: jurisdiction } } : undefined
  });

  const ids = Array.from(new Set((query.matches||[]).map(m=> String((m.metadata as any)?.doc_id)).filter(Boolean)));
  const { data: docs } = await db.from("document")
    .select("id,title,url,published_at")
    .in("id", ids.length? ids: ["00000000-0000-0000-0000-000000000000"])
    .limit(8);

  const context = (docs||[]).map(d=>`- ${d.title} (${d.url})`).join("\n");
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role:"system", content:"You are a precise, nonpartisan political analyst. Cite sources explicitly if asked."},
      { role:"user", content:`Question: ${question}\nTop sources:\n${context}`}
    ]
  });

  return NextResponse.json({ ok:true, answer: resp.choices[0].message?.content, sources: docs || [] });
}
