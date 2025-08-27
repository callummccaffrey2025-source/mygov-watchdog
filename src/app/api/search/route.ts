import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { pineconeIndex } from '@/lib/pinecone';
import { supaAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const q = sp.get('q') || '';
    const jurisdiction = sp.get('jurisdiction') || undefined;
    if (!q) return NextResponse.json({ results: [] });

    const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: q });

    // v6: flat options
    const res = await pineconeIndex.query({
      topK: 10,
      vector: emb.data[0].embedding,
      includeMetadata: true,
      filter: jurisdiction ? { jurisdiction: { $eq: jurisdiction } } : undefined,
    });

    const ids = Array.from(new Set((res.matches ?? []).map(m => (m.metadata as any)?.doc_id).filter(Boolean)));
    if (!ids.length) return NextResponse.json({ results: [] });

    const { data: docs } = await supaAdmin
      .from('document')
      .select('id,title,url,created_at')
      .in('id', ids);

    return NextResponse.json({ results: docs ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'search failed' }, { status: 500 });
  }
}
