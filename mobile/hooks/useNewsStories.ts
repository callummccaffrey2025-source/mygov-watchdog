import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('news_stories')
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
      const { data } = await query;
      setStories((data as NewsStory[]) || []);
    } catch {
      // Network/Supabase failure — show empty state instead of infinite loading
    }
    setLoading(false);
  }, [leaning, category, search, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { stories, loading, refresh: fetch };
}
