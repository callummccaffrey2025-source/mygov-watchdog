import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function htmlDecode(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function tokenise(text: string): Set<string> {
  const stopWords = new Set([
    'the','a','an','in','on','of','for','to','is','was','are','at','by','with',
    'and','or','that','this','it','be','as','from','has','have','been',
    'he','she','they','we','you','its','after','over','new',
  ]);
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/^-|-$/g, '');
}

function leaningBucket(leaning: string): 'left' | 'center' | 'right' {
  if (leaning === 'left' || leaning === 'center-left') return 'left';
  if (leaning === 'center-right' || leaning === 'right') return 'right';
  return 'center';
}

function parseFeed(
  xml: string,
  sourceId: number,
  leaning: string,
): Array<{ source_id: number; title: string; url: string; published_at: string | null; leaning: string }> {
  const items: Array<{ source_id: number; title: string; url: string; published_at: string | null; leaning: string }> = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s);
    const linkMatch = item.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s)
      || item.match(/<guid[^>]*isPermaLink="true"[^>]*>([^<]+)<\/guid>/);
    const pubMatch = item.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/)
      || item.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/);

    const title = titleMatch ? htmlDecode(titleMatch[1]) : '';
    const url = linkMatch ? linkMatch[1].trim() : '';
    if (!title || !url || !url.startsWith('http')) continue;

    let published_at: string | null = null;
    if (pubMatch) {
      try {
        const d = new Date(pubMatch[1].trim());
        if (!isNaN(d.getTime())) published_at = d.toISOString();
      } catch { /* ignore */ }
    }
    items.push({ source_id: sourceId, title, url, published_at, leaning });
  }
  return items;
}

Deno.serve(async (_req: Request) => {
  const started_at = new Date().toISOString();
  const details: Record<string, unknown> = {};

  try {
    // 1. Load sources with RSS feeds
    const { data: sources, error: srcErr } = await supabase
      .from('news_sources')
      .select('id, name, slug, rss_url, leaning')
      .not('rss_url', 'is', null)
      .limit(80);
    if (srcErr) throw srcErr;
    details.source_count = sources?.length ?? 0;

    // 2. Fetch all RSS feeds in parallel (10s timeout each)
    const fetchResults = await Promise.allSettled(
      (sources || []).map(async (src: any) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch(src.rss_url!, { signal: controller.signal });
          const xml = await res.text();
          return { src, xml };
        } finally {
          clearTimeout(timer);
        }
      })
    );

    // 3. Parse all feeds
    const rawArticles: Array<{ source_id: number; title: string; url: string; published_at: string | null; leaning: string }> = [];
    for (const result of fetchResults) {
      if (result.status === 'fulfilled') {
        const { src, xml } = result.value;
        rawArticles.push(...parseFeed(xml, src.id, src.leaning || 'center'));
      }
    }
    details.raw_article_count = rawArticles.length;

    // 4. Deduplicate by URL
    const seen = new Set<string>();
    const uniqueArticles = rawArticles.filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
    details.unique_article_count = uniqueArticles.length;

    // 5. Upsert articles in batches of 100
    const BATCH = 100;
    for (let i = 0; i < uniqueArticles.length; i += BATCH) {
      const batch = uniqueArticles.slice(i, i + BATCH).map(a => ({
        source_id: a.source_id,
        title: a.title,
        url: a.url,
        published_at: a.published_at,
      }));
      const { error: upsertErr } = await supabase
        .from('news_articles')
        .upsert(batch, { onConflict: 'url', ignoreDuplicates: true });
      if (upsertErr) console.error('article upsert error:', upsertErr.message);
    }

    // 6. Fetch back article IDs by URL
    const allUrls = uniqueArticles.map(a => a.url);
    const articleIdMap = new Map<string, number>(); // url -> id
    for (let i = 0; i < allUrls.length; i += BATCH) {
      const { data: rows } = await supabase
        .from('news_articles')
        .select('id, url')
        .in('url', allUrls.slice(i, i + BATCH));
      for (const row of (rows || [])) articleIdMap.set(row.url, row.id);
    }

    // Build leaning map: url -> leaning bucket
    const leaningMap = new Map<string, 'left' | 'center' | 'right'>();
    for (const a of uniqueArticles) leaningMap.set(a.url, leaningBucket(a.leaning));

    // 7. Load existing DB stories for clustering
    const { data: dbStories } = await supabase
      .from('news_stories')
      .select('id, headline, slug, category, article_count, left_count, center_count, right_count');

    type StoryCluster = {
      dbId: number | null;
      slug: string;
      headline: string;
      category: string;
      tokens: Set<string>;
      articleIds: number[];
      leftDelta: number;
      centerDelta: number;
      rightDelta: number;
      existingCount: number;
      existingLeft: number;
      existingCenter: number;
      existingRight: number;
    };

    const clusters: StoryCluster[] = (dbStories || []).map((s: any) => ({
      dbId: s.id,
      slug: s.slug,
      headline: s.headline,
      category: s.category || 'general',
      tokens: tokenise(s.headline),
      articleIds: [],
      leftDelta: 0,
      centerDelta: 0,
      rightDelta: 0,
      existingCount: s.article_count || 0,
      existingLeft: s.left_count || 0,
      existingCenter: s.center_count || 0,
      existingRight: s.right_count || 0,
    }));

    // 8. Cluster new articles
    const newClusters: StoryCluster[] = [];

    for (const article of uniqueArticles) {
      const articleId = articleIdMap.get(article.url);
      if (!articleId) continue;

      const tokens = tokenise(article.title);
      const bucket = leaningMap.get(article.url) || 'center';

      // Find best matching cluster (DB first, then in-memory new)
      let bestMatch: StoryCluster | null = null;
      let bestScore = 0;
      for (const c of [...clusters, ...newClusters]) {
        const score = jaccard(tokens, c.tokens);
        if (score > bestScore && score >= 0.3) { bestScore = score; bestMatch = c; }
      }

      if (bestMatch) {
        bestMatch.articleIds.push(articleId);
        for (const t of tokens) bestMatch.tokens.add(t);
      } else {
        // New cluster
        newClusters.push({
          dbId: null,
          slug: slugify(article.title) + '-' + Date.now().toString(36),
          headline: article.title,
          category: 'general',
          tokens,
          articleIds: [articleId],
          leftDelta: 0,
          centerDelta: 0,
          rightDelta: 0,
          existingCount: 0,
          existingLeft: 0,
          existingCenter: 0,
          existingRight: 0,
        });
        bestMatch = newClusters[newClusters.length - 1];
      }

      // Tally leaning delta
      if (bucket === 'left') bestMatch.leftDelta++;
      else if (bucket === 'right') bestMatch.rightDelta++;
      else bestMatch.centerDelta++;
    }

    // 9. Persist clusters with new articles
    const activeExisting = clusters.filter(c => c.articleIds.length > 0);
    details.updated_stories = activeExisting.length;
    details.new_stories = newClusters.length;

    // Update existing stories
    for (const c of activeExisting) {
      await supabase
        .from('news_stories')
        .update({
          article_count: c.existingCount + c.articleIds.length,
          left_count: c.existingLeft + c.leftDelta,
          center_count: c.existingCenter + c.centerDelta,
          right_count: c.existingRight + c.rightDelta,
        })
        .eq('id', c.dbId);
    }

    // Insert new stories and collect their IDs
    for (const c of newClusters) {
      if (c.articleIds.length === 0) continue;
      const { data: inserted, error: insErr } = await supabase
        .from('news_stories')
        .insert({
          slug: c.slug,
          headline: c.headline,
          category: c.category,
          article_count: c.articleIds.length,
          left_count: c.leftDelta,
          center_count: c.centerDelta,
          right_count: c.rightDelta,
          first_seen: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();
      if (insErr) { console.error('story insert error:', insErr.message); continue; }
      if (inserted) c.dbId = inserted.id;
    }

    // 10. Upsert junction rows for all active clusters
    const allActive = [...activeExisting, ...newClusters.filter(c => c.dbId !== null)];
    for (const c of allActive) {
      const rows = c.articleIds.map(aid => ({ story_id: c.dbId!, article_id: aid }));
      if (rows.length === 0) continue;
      const { error: jErr } = await supabase
        .from('news_story_articles')
        .upsert(rows, { onConflict: 'story_id,article_id', ignoreDuplicates: true });
      if (jErr) console.error('junction upsert error:', jErr.message);
    }

    // 11. Prune stories older than 14 days
    const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    await supabase.from('news_stories').delete().lt('first_seen', cutoff);

    // Log success
    await supabase.from('pipeline_runs').insert({
      pipeline: 'ingest-news',
      status: 'success',
      started_at,
      finished_at: new Date().toISOString(),
      details,
    });

    return new Response(JSON.stringify({ ok: true, ...details }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    await supabase.from('pipeline_runs').insert({
      pipeline: 'ingest-news',
      status: 'failure',
      started_at,
      finished_at: new Date().toISOString(),
      error: String(err?.message ?? err),
      details,
    });
    return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
