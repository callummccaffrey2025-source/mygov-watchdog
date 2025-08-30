export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { openai } from "@/lib/openai";
import { index } from "@/lib/pinecone";

export async function POST(req: Request) {
  const { doc_id } = await req.json();
  if(!doc_id) return NextResponse.json({ error:"doc_id required"},{status:400});

  const { data: d, error:e } = await db.from("document")
    .select("id,content,source_id,jurisdiction,title,url,published_at")
    .eq("id", doc_id).single();
  if(e || !d) return NextResponse.json({ error: e?.message || "not found" }, {status:404});

  const text = (d as any).content?.slice(0, 200000) || "";
  if (!text) return NextResponse.json({ ok:true, skipped:"empty" });

  const emb = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  await index.upsert([{
    id: String(d.id),
    values: emb.data[0].embedding as number[],
    metadata: {
      doc_id: d.id, source_id: (d as any).source_id,
      title: (d as any).title, url: (d as any).url,
      jurisdiction: (d as any).jurisdiction, published_at: (d as any).published_at
    }
  }]);
  return NextResponse.json({ ok:true, dims: emb.data[0].embedding.length });
}
