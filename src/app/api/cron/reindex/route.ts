export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

export const runtime = "nodejs";

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const idx = pc.index(process.env.PINECONE_INDEX!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// pick best available text field per row
function pickText(d: any): string {
  const candidates = [
    d.content_text, d.content, d.text, d.body, d.summary, d.excerpt, d.html_text
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}

export async function GET() {
  const { data: docs, error } = await supabaseAdmin
    .from("document")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const batch = (docs ?? []).filter(d => pickText(d).length > 0);
  if (!batch.length) return NextResponse.json({ ok: true, upserted: 0 });

  const inputs = batch.map(d => pickText(d).slice(0, 12000));
  const embs = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: inputs,
  });

  await idx.namespace("AU").upsert(
    batch.map((d, i) => ({
      id: d.id,
      values: embs.data[i].embedding,
      metadata: {
        url: d.url,
        title: d.title,
        jurisdiction: d.jurisdiction ?? "AU",
        source_id: d.source_id ?? null,
      },
    }))
  );

  return NextResponse.json({ ok: true, upserted: batch.length });
}