import { supabase } from './supabase.server';

type Source = { rank:number; score?:number|null; title?:string; url?:string; snippet?:string };

export async function logQuery(opts: {
  userId?: string | null;
  question: string;
  answer?: string;
  sources?: Source[];
}) {
  if (!supabase) return; // logging disabled if env missing
  const { data: q, error } = await supabase
    .from('queries')
    .insert({ user_id: opts.userId ?? null, question: opts.question, answer: opts.answer ?? null })
    .select('id')
    .single();
  if (error || !q) return;

  const srcs = (opts.sources ?? []).map(s => ({
    query_id: q.id,
    rank: s.rank,
    score: s.score ?? null,
    title: s.title ?? null,
    url: s.url ?? null,
    snippet: s.snippet ?? null
  }));
  if (srcs.length) {
    await supabase.from('query_sources').insert(srcs);
  }
}
