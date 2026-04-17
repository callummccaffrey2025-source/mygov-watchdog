import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface StoryArticle {
  id: number;
  title: string;
  description: string | null;
  url: string;
  published_at: string;
  image_url: string | null;
  category: string | null;
  source: {
    id: number;
    name: string;
    slug: string;
    leaning: string;
    website_url: string;
    factuality_numeric: number | null;
    owner: string | null;
  };
}

const LEANING_ORDER = ['left', 'center-left', 'center', 'center-right', 'right'];

export function useNewsStoryArticles(storyId: number | undefined) {
  const [articles, setArticles] = useState<StoryArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) {
      setArticles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setArticles([]);
    let cancelled = false;

    (async () => {
      try {
        const { data: junctionRows, error: err1 } = await supabase
          .from('news_story_articles')
          .select('article_id')
          .eq('story_id', storyId);

        if (err1 || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }

        const articleIds = (junctionRows || []).map((r: any) => r.article_id);
        if (articleIds.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data: articlesData, error: err2 } = await supabase
          .from('news_articles')
          .select('id, title, description, url, published_at, image_url, category, source_id, news_sources(id, name, slug, leaning, website_url, factuality_numeric, owner)')
          .in('id', articleIds)
          .eq('is_civic', true);

        if (err2 || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }

        const raw: StoryArticle[] = ((articlesData as any[]) || [])
          .map((a: any) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            url: a.url,
            published_at: a.published_at,
            image_url: a.image_url,
            category: a.category,
            source: a.news_sources,
          }))
          .filter((a: any) => a.source != null);

        raw.sort((a, b) => {
          const ai = LEANING_ORDER.indexOf(a.source?.leaning ?? '');
          const bi = LEANING_ORDER.indexOf(b.source?.leaning ?? '');
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });

        if (!cancelled) setArticles(raw);
      } catch {
        // Network failure — leave empty
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [storyId]);

  return { articles, loading };
}
