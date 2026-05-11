import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/cache';
import { withRetry } from '../lib/retry';

export interface NewsStory {
  id: number;
  headline: string;
  slug: string;
  category: string | null;
  first_seen: string;
  article_count: number;
  left_count: number;
  center_count: number;
  right_count: number;
  image_url: string | null;
  ai_summary: string | null;
  blindspot: string | null;
  avg_factuality: number | null;
  owner_count: number | null;
}

export function useNewsStories(leaning?: string, category?: string, search?: string, limit?: number) {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(true);

  const cacheKey = `news_stories_${leaning ?? 'all'}_${category ?? 'all'}_${search ?? ''}_${limit ?? 50}`;

  const fetch = useCallback(async () => {
    setLoading(true);

    // Show cached data immediately
    if (!search) {
      const cached = await getCached<NewsStory[]>(cacheKey);
      if (cached) setStories(cached);
    }

    let query = supabase
      .from('v_civic_news_stories')
      .select('*')
      .gte('article_count', search ? 1 : 3)
      .order('article_count', { ascending: false })
      .order('first_seen', { ascending: false })
      .limit(search ? 5 : (limit ?? 50));

    if (search) {
      query = query.ilike('headline', `%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (leaning === 'left') {
      query = query.gt('left_count', 0);
    } else if (leaning === 'center') {
      query = query.gt('center_count', 0);
    } else if (leaning === 'right') {
      query = query.gt('right_count', 0);
    }

    try {
      const { data } = await withRetry(async () => {
        const res = await query;
        if (res.error) throw new Error(res.error.message);
        return res;
      }, { maxAttempts: 2 });
      const result = (data as NewsStory[]) || [];
      setStories(result);
      if (!search && result.length > 0) setCached(cacheKey, result);
    } catch {
      // Network/Supabase failure — cached data already shown if available
    }
    setLoading(false);
  }, [leaning, category, search, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { stories, loading, refresh: fetch };
}
