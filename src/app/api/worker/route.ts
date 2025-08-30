export const dynamic = 'force-dynamic';
import 'server-only';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { openai } from '@/lib/openai';
import { pineconeIndex } from '@/lib/pinecone';
import { supaAdmin } from '@/lib/supabaseAdmin';
import { chunk } from '@/lib/chunk';
import { fetchPageSmart } from '@/lib/fetchPage';

type Job = {
  id: string;
  name: string;
  url: string;
  jurisdiction: string;
  type: string;
  status: 'pending'|'processing'|'done'|'failed';
  attempts: number;
};

async function processJob(job: Job) {
  // Try to claim the job (avoid races)
  const { data: claimed, error: claimErr } = await supaAdmin
    .from('crawl_job')
    .update({ status: 'processing', attempts: (job.attempts ?? 0) + 1 })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (claimErr || !claimed) return { skipped: true };

  // Fetch with fallback
  const fetched = await fetchPageSmart(job.url);
  let text = '';
  if (fetched.source === 'jina' && fetched.text) {
    text = fetched.text;
  } else {
    const $ = cheerio.load(fetched.html || '');
    text = ($('main').text() || $('article').text() || $('body').text() || '').trim();
  }
  text = text.replace(/\s+/g, ' ');
  if (!text || text.length < 30) throw new Error('no text extracted');

  // Upsert/insert document row
  const docHash = crypto.createHash('sha1').update(job.url + text.slice(0, 4000)).digest('hex');
  const { data: docRow, error: docErr } = await supaAdmin
    .from('document')
    .upsert({ title: job.name, url: job.url, jurisdiction: job.jurisdiction, type: job.type, hash: docHash }, { onConflict: 'url' })
    .select()
    .single();
  if (docErr) throw new Error(`supabase: ${docErr.message}`);

  // Chunk + embed
  const parts = chunk(text).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 200);
  const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: parts });

  // Pinecone v6 upsert: pass an array of records
  const records = emb.data.map((e, i) => ({
    id: crypto.createHash('sha1').update(job.url + ':' + i).digest('hex'),
    values: e.embedding,
    metadata: {
      doc_id: docRow.id,
      url: job.url,
      title: job.name,
      jurisdiction: job.jurisdiction,
      type: job.type,
      chunk: parts[i],
    },
  }));
  await pineconeIndex.upsert(records);

  await supaAdmin.from('crawl_job').update({ status: 'done', doc_id: docRow.id, error: null }).eq('id', job.id);
  return { ok: true, doc_id: docRow.id, chunks: parts.length };
}

export async function GET(req: NextRequest) {
  const limit = Number(new URL(req.url).searchParams.get('limit') ?? '1');
  // pull oldest pending OR failed with attempts<3
  const { data: jobs, error } = await supaAdmin
    .from('crawl_job')
    .select('*')
    .in('status', ['pending','failed'])
    .lte('attempts', 2)
    .order('created_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 5));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobs || jobs.length === 0) return NextResponse.json({ processed: 0 });

  const results = [];
  for (const j of jobs) {
    try {
      const r = await processJob(j as Job);
      results.push({ id: j.id, ...r });
    } catch (e: any) {
      const msg = String(e?.message || e);
      await supaAdmin.from('crawl_job').update({ status: 'failed', error: msg }).eq('id', j.id);
      results.push({ id: j.id, error: msg });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

// POST -> same as GET (allows Vercel cron POST calls too)
export const POST = GET;
