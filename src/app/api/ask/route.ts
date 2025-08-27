import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { pineconeIndex } from '@/lib/pinecone';
import { supaAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { question, jurisdiction } = await req.json();
    if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 });

    const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: question });

    // v6: flat options, no queryRequest wrapper
    const res = await pineconeIndex.query({
      topK: 8,
      vector: emb.data[0].embedding,
      includeMetadata: true,
      filter: jurisdiction ? { jurisdiction: { $eq: jurisdiction } } : undefined,
    });

    const matches = res.matches ?? [];
    const docIds = Array.from(new Set(matches.map(m => (m.metadata as any)?.doc_id).filter(Boolean)));

    const { data: docs } = await supaAdmin
      .from('document')
      .select('id,title,content,url')
      .in('id', docIds);

    const context = (docs ?? [])
      .map(d => `TITLE: ${d.title}\nURL: ${d.url ?? 'N/A'}\n${d.content.slice(0, 2000)}\n---`)
      .join('\n');

    const system = `You are Verity, an Australian political watchdog. Use only the provided CONTEXT. Be concise, then list 'Key sources' as URLs.`;
    const user = `QUESTION: ${question}\n\nCONTEXT:\n${context}`;

    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.2,
    });

    return NextResponse.json({
      answer: chat.choices[0]?.message?.content ?? 'No answer.',
      references: (docs ?? []).map(d => d.url).filter(Boolean),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'ask failed' }, { status: 500 });
  }
}
